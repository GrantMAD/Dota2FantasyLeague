import { sendPriceChangeNotifications } from '../send-price-change-notifications';

const mockCreateClient = jest.fn();
const mockDeliverPushNotifications = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

jest.mock('@/lib/push-notifications', () => ({
  deliverPushNotifications: (...args: unknown[]) => mockDeliverPushNotifications(...args),
}));

interface Query {
  table: string;
  filters: Record<string, unknown>;
  orders: Array<{ field: string; ascending: boolean }>;
  select: jest.Mock;
  eq: jest.Mock;
  neq: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  is: jest.Mock;
  contains: jest.Mock;
  maybeSingle: jest.Mock;
  insert: jest.Mock;
  then: (
    onfulfilled?: ((value: unknown) => unknown) | null,
    onrejected?: ((reason: unknown) => unknown) | null,
  ) => Promise<unknown>;
}

function createSupabase() {
  const inserts: Record<string, unknown>[] = [];
  const queries: Query[] = [];

  const client = {
    from: jest.fn((table: string) => {
      const query = {} as Query;
      Object.assign(query, {
        table,
        filters: {},
        orders: [],
        select: jest.fn(() => query),
        eq: jest.fn((field: string, value: unknown) => {
          query.filters[field] = value;
          return query;
        }),
        neq: jest.fn((field: string, value: unknown) => {
          query.filters[`neq:${field}`] = value;
          return query;
        }),
        order: jest.fn((field: string, options: { ascending: boolean }) => {
          query.orders.push({ field, ascending: options.ascending });
          return query;
        }),
        limit: jest.fn(() => query),
        is: jest.fn((field: string, value: unknown) => {
          query.filters[`is:${field}`] = value;
          return query;
        }),
        contains: jest.fn((field: string, value: unknown) => {
          query.filters[`contains:${field}`] = value;
          return query;
        }),
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
        queries.push(query);
        if (table === 'seasons') return { data: { id: 1 }, error: null };
        if (table === 'gameweeks') return { data: { id: 2, season_id: 1 }, error: null };
        if (table === 'player_prices') {
          return {
            data: [{
              player_id: 509,
              price: 6,
              price_change: 0.5,
              professional_players: { name: 'Ame' },
            }],
            error: null,
          };
        }
        if (table === 'fantasy_squad_members') {
          return {
            data: [{
              fantasy_squads: {
                fantasy_seasons: { user_id: 'manager-1' },
              },
            }],
            error: null,
          };
        }
        if (table === 'user_notifications') return { data: null, error: null };
        return { data: null, error: null };
      }

      return query;
    }),
  };

  return { client, inserts, queries };
}

describe('price change notifications', () => {
  beforeEach(() => {
    mockDeliverPushNotifications.mockResolvedValue({ accepted: 0, errors: [] });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('uses the latest closed gameweek where price changes are written', async () => {
    const { client, inserts, queries } = createSupabase();
    mockCreateClient.mockReturnValue(client);

    const result = await sendPriceChangeNotifications();

    expect(result).toMatchObject({
      success: true,
      priceChangesProcessed: 1,
      notificationsGenerated: 1,
    });
    expect(inserts).toEqual([{
      user_id: 'manager-1',
      type: 'price_change',
      title: 'Ame Price Rise!',
      message: "Ame's price has risen by +0.50m to $6m.",
      metadata: { player_id: 509, gameweek_id: 2, price_change: 0.5 },
    }]);

    const seasonQuery = queries.find((query) => query.table === 'seasons');
    expect(seasonQuery?.orders).toEqual([{ field: 'id', ascending: false }]);
    const gameweekQuery = queries.find((query) => query.table === 'gameweeks');
    expect(gameweekQuery?.filters).toEqual({ season_id: 1, status: 'closed' });
    expect(gameweekQuery?.orders).toEqual([{ field: 'id', ascending: false }]);
    const pricesQuery = queries.find((query) => query.table === 'player_prices');
    expect(pricesQuery?.filters).toEqual({
      season_id: 1,
      gameweek_id: 2,
      'neq:price_change': 0,
    });
  });
});
