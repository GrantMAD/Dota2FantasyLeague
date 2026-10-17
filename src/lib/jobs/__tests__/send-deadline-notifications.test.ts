import { sendDeadlineNotifications } from '../send-deadline-notifications';
import type { PushNotificationCandidate } from '@/lib/push-notifications';

const mockCreateClient = jest.fn();
const mockDeliverPushNotifications = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

jest.mock('@/lib/push-notifications', () => ({
  deliverPushNotifications: (...args: unknown[]) => mockDeliverPushNotifications(...args),
}));

interface Fixture {
  gameweeks?: Record<string, unknown>[];
  fantasySeasons?: Record<string, unknown>[];
  lineups?: Record<number, Record<string, unknown> | null>;
  lineupError?: string;
  existingRegularReminder?: boolean;
  existingLineupReminder?: boolean;
}

interface SupabaseQuery {
  table: string;
  filters: Record<string, unknown>;
  containsFilter: Record<string, unknown> | null;
  select: jest.Mock;
  eq: jest.Mock;
  gte: jest.Mock;
  lte: jest.Mock;
  contains: jest.Mock;
  limit: jest.Mock;
  maybeSingle: jest.Mock;
  insert: jest.Mock;
  then: (
    onfulfilled?: ((value: unknown) => unknown) | null,
    onrejected?: ((reason: unknown) => unknown) | null,
  ) => Promise<unknown>;
}

function createSupabase(fixture: Fixture) {
  const inserts: Record<string, unknown>[] = [];
  const queries: {
    table: string;
    filters: Record<string, unknown>;
    contains: Record<string, unknown> | null;
  }[] = [];

  const client = {
    from: jest.fn((table: string) => {
      const query = {} as SupabaseQuery;
      Object.assign(query, {
        table,
        filters: {},
        containsFilter: null,
        select: jest.fn((): SupabaseQuery => query),
        eq: jest.fn((field: string, value: unknown) => {
          query.filters[field] = value;
          return query;
        }),
        gte: jest.fn(() => query),
        lte: jest.fn(() => query),
        contains: jest.fn((_field: string, value: Record<string, unknown>) => {
          query.containsFilter = value;
          return query;
        }),
        limit: jest.fn(() => query),
        maybeSingle: jest.fn(async () => resolve()),
        insert: jest.fn(async (values: Record<string, unknown>) => {
          inserts.push(values);
          return { error: null };
        }),
        then: (
          onfulfilled?: ((value: unknown) => unknown) | null,
          onrejected?: ((reason: unknown) => unknown) | null,
        ) => Promise.resolve(resolve()).then(onfulfilled, onrejected),
      });

      function resolve() {
        queries.push({
          table,
          filters: { ...query.filters },
          contains: query.containsFilter,
        });
        if (table === 'gameweeks') return { data: fixture.gameweeks ?? [], error: null };
        if (table === 'fantasy_seasons') return { data: fixture.fantasySeasons ?? [], error: null };
        if (table === 'fantasy_lineups') {
          return fixture.lineupError
            ? { data: null, error: { message: fixture.lineupError } }
            : { data: fixture.lineups?.[Number(query.filters.fantasy_season_id)] ?? null, error: null };
        }
        if (table === 'user_notifications') {
          const isLineupReminder = query.containsFilter?.reminder_stage === 'lineup_2h';
          const exists = isLineupReminder
            ? fixture.existingLineupReminder
            : fixture.existingRegularReminder;
          return { data: exists ? { id: 1 } : null, error: null };
        }
        return { data: null, error: null };
      }

      return query;
    }),
  };

  return {
    client,
    inserts,
    queries,
  };
}

describe('deadline notifications', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-17T10:00:00.000Z'));
    mockDeliverPushNotifications.mockResolvedValue({ accepted: 0, errors: [] });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('sends the two-hour reminder only to managers without a complete lineup', async () => {
    const { client, inserts } = createSupabase({
      gameweeks: [{
        id: 8,
        gameweek_number: 4,
        season_id: 2,
        deadline: '2026-10-17T11:30:00.000Z',
      }],
      fantasySeasons: [
        { id: 21, user_id: 'manager-missing-lineup' },
        { id: 22, user_id: 'manager-complete-lineup' },
      ],
      lineups: {
        22: {
          carry_id: 1,
          mid_id: 2,
          offlane_id: 3,
          support_id: 4,
          hard_support_id: 5,
          captain_player_id: 1,
        },
      },
    });
    mockCreateClient.mockReturnValue(client);

    const result = await sendDeadlineNotifications();

    expect(result).toMatchObject({ success: true, gameweeksProcessed: 1, notificationsGenerated: 1 });
    expect(inserts).toEqual([{
      user_id: 'manager-missing-lineup',
      type: 'deadline_reminder',
      title: 'Gameweek 4 lineup deadline within 2 hours',
      message: 'Your Gameweek 4 lineup is not set or is incomplete. The deadline is within 2 hours. Set your lineup now.',
      metadata: { gameweek_id: 8, gameweek_number: 4, reminder_stage: 'lineup_2h' },
    }]);
    expect(mockDeliverPushNotifications).toHaveBeenCalledWith(client, [{
      userId: 'manager-missing-lineup',
      type: 'deadline_reminder',
      metadata: { gameweek_id: 8, gameweek_number: 4 },
      title: 'Gameweek 4 lineup deadline within 2 hours',
      body: 'Your Gameweek 4 lineup is not set or is incomplete. The deadline is within 2 hours. Set your lineup now.',
    } satisfies PushNotificationCandidate]);
  });

  it('does not send a duplicate two-hour reminder for the same gameweek', async () => {
    const { client, inserts } = createSupabase({
      gameweeks: [{
        id: 8,
        gameweek_number: 4,
        season_id: 2,
        deadline: '2026-10-17T11:30:00.000Z',
      }],
      fantasySeasons: [{ id: 21, user_id: 'manager-1' }],
      existingLineupReminder: true,
    });
    mockCreateClient.mockReturnValue(client);

    const result = await sendDeadlineNotifications();

    expect(result).toMatchObject({ success: true, notificationsGenerated: 0 });
    expect(inserts).toHaveLength(0);
    expect(mockDeliverPushNotifications).toHaveBeenCalledWith(client, []);
  });

  it('keeps the general reminder for deadlines more than two hours away', async () => {
    const { client, inserts } = createSupabase({
      gameweeks: [{
        id: 8,
        gameweek_number: 4,
        season_id: 2,
        deadline: '2026-10-17T14:00:00.000Z',
      }],
      fantasySeasons: [{ id: 21, user_id: 'manager-1' }],
    });
    mockCreateClient.mockReturnValue(client);

    const result = await sendDeadlineNotifications();

    expect(result).toMatchObject({ success: true, notificationsGenerated: 1 });
    expect(inserts[0]).toMatchObject({
      user_id: 'manager-1',
      title: 'Gameweek 4 Deadline Approaching!',
      metadata: { gameweek_id: 8, gameweek_number: 4 },
    });
    expect(client.from).not.toHaveBeenCalledWith('fantasy_lineups');
  });

  it('reports lineup lookup errors rather than silently skipping the reminder', async () => {
    const { client, inserts } = createSupabase({
      gameweeks: [{
        id: 8,
        gameweek_number: 4,
        season_id: 2,
        deadline: '2026-10-17T11:30:00.000Z',
      }],
      fantasySeasons: [{ id: 21, user_id: 'manager-1' }],
      lineupError: 'Database unavailable.',
    });
    mockCreateClient.mockReturnValue(client);

    const result = await sendDeadlineNotifications();

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Failed to check lineup for user manager-1 in GW 8: Database unavailable.');
    expect(inserts).toHaveLength(0);
  });
});
