import { notifyLiveSquadMembers } from '../live-squad-match-notifications';

const mockDeliverPushNotifications = jest.fn();

jest.mock('@/lib/push-notifications', () => ({
  deliverPushNotifications: (...args: unknown[]) => mockDeliverPushNotifications(...args),
}));

interface MockQuery {
  table: string;
  selected: string;
  inserted: unknown;
  filters: Record<string, unknown>;
  select: jest.Mock;
  in: jest.Mock;
  eq: jest.Mock;
  is: jest.Mock;
  insert: jest.Mock;
  then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise<unknown>;
}

function createSupabase(options?: {
  enabledUsers?: Array<{ id: string }>;
  existingNotifications?: Array<{ user_id: string }>;
}) {
  const inserted: Array<Record<string, unknown>> = [];
  const queries: MockQuery[] = [];
  const supabase = {
    from(table: string) {
      const query: MockQuery = {
        table,
        selected: '',
        inserted: null,
        filters: {},
        select: jest.fn((columns: string) => {
          query.selected = columns;
          return query;
        }),
        in: jest.fn((column: string, value: unknown[]) => {
          query.filters[column] = value;
          return query;
        }),
        eq: jest.fn((column: string, value: unknown) => {
          query.filters[column] = value;
          return query;
        }),
        is: jest.fn((column: string, value: unknown) => {
          query.filters[column] = value;
          return query;
        }),
        insert: jest.fn((value: unknown) => {
          query.inserted = value;
          inserted.push(...(Array.isArray(value) ? value : [value]) as Array<Record<string, unknown>>);
          return query;
        }),
        then(resolve, reject) {
          let result: unknown = { data: [], error: null };
          if (table === 'professional_players') {
            result = {
              data: [
                { id: 501, name: 'Carry Pro', in_game_name: 'Carry', data_provider_id: '76561197960265851' },
                { id: 502, name: 'Different Pro', in_game_name: 'Other', data_provider_id: '456' },
              ],
              error: null,
            };
          } else if (table === 'fantasy_squad_members') {
            result = {
              data: [{
                player_id: 501,
                fantasy_squads: { fantasy_seasons: { user_id: 'manager-1' } },
              }],
              error: null,
            };
          } else if (table === 'users') {
            result = { data: options?.enabledUsers ?? [{ id: 'manager-1' }], error: null };
          } else if (table === 'user_notifications' && query.inserted === null) {
            result = { data: options?.existingNotifications ?? [], error: null };
          }
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      queries.push(query);
      return query;
    },
  };
  return { supabase, inserted, queries };
}

describe('notifyLiveSquadMembers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeliverPushNotifications.mockResolvedValue({ accepted: 1, errors: [] });
  });

  it('creates one notification listing exact owned participants and sends push candidates', async () => {
    const { supabase, inserted } = createSupabase();

    const result = await notifyLiveSquadMembers(supabase, [{
      id: 200,
      externalMatchId: '9090050956',
      playerAccountIds: ['123'],
    }]);

    expect(result).toMatchObject({ notificationsCreated: 1, pushNotificationsSent: 1, errors: [] });
    expect(inserted).toEqual([{
      user_id: 'manager-1',
      type: 'live_squad_match',
      title: 'Your squad is in a live match',
      message: 'Carry is playing in a live match.',
      metadata: {
        match_id: 200,
        external_match_id: '9090050956',
        player_ids: [501],
        player_names: ['Carry'],
      },
    }]);
    expect(mockDeliverPushNotifications).toHaveBeenCalledWith(supabase, [{
      userId: 'manager-1',
      type: 'live_squad_match',
      metadata: inserted[0].metadata,
      title: 'Your squad is in a live match',
      body: 'Carry is playing in a live match.',
    }]);
  });

  it('does not create alerts for opted-out users or for a match already notified', async () => {
    const optedOut = createSupabase({ enabledUsers: [] });
    const optedOutResult = await notifyLiveSquadMembers(optedOut.supabase, [{
      id: 200,
      externalMatchId: '9090050956',
      playerAccountIds: ['123'],
    }]);
    expect(optedOutResult.notificationsCreated).toBe(0);

    const alreadyNotified = createSupabase({
      existingNotifications: [{ user_id: 'manager-1' }],
    });
    const duplicateResult = await notifyLiveSquadMembers(alreadyNotified.supabase, [{
      id: 200,
      externalMatchId: '9090050956',
      playerAccountIds: ['123'],
    }]);
    expect(duplicateResult.notificationsCreated).toBe(0);
    expect(alreadyNotified.inserted).toHaveLength(0);
    expect(mockDeliverPushNotifications).not.toHaveBeenCalled();
  });
});
