import { NextRequest } from 'next/server';
import { GET } from './route';

const mockSupabaseServer = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

type QueryBuilder = {
  select: jest.Mock<QueryBuilder, []>;
  eq: jest.Mock<QueryBuilder, [string, number]>;
  order: jest.Mock<QueryBuilder, [string, { ascending: boolean }]>;
  limit: jest.Mock<QueryBuilder, [number]>;
  maybeSingle: jest.Mock<Promise<QueryResult>, []>;
  then: Promise<QueryResult>['then'];
};

function createQuery(result: QueryResult, onLimit?: (limit: number) => void) {
  const query: QueryBuilder = {
    select: jest.fn<QueryBuilder, []>(() => query),
    eq: jest.fn<QueryBuilder, [string, number]>(() => query),
    order: jest.fn<QueryBuilder, [string, { ascending: boolean }]>(() => query),
    limit: jest.fn<QueryBuilder, [number]>((limit) => {
      onLimit?.(limit);
      return query;
    }),
    maybeSingle: jest.fn<Promise<QueryResult>, []>(() => Promise.resolve(result)),
    then: (onfulfilled, onrejected) =>
      Promise.resolve(result).then(onfulfilled, onrejected),
  };
  return query;
}

function createSupabase(overrides: {
  playerResult?: QueryResult;
  priceResult?: QueryResult;
  performanceResult?: QueryResult;
  pointTotalsResult?: QueryResult;
} = {}) {
  const recentLimit = jest.fn();
  const playerQuery = createQuery(overrides.playerResult ?? {
    data: { id: 17, name: 'Test Player' },
    error: null,
  });
  const priceQuery = createQuery(overrides.priceResult ?? {
    data: [{ gameweek_id: 8, price: 10.5, ownership_percentage: 12, price_change: 0.2 }],
    error: null,
  });
  const performanceQuery = createQuery(overrides.performanceResult ?? {
    data: [{ id: 301, gameweek_id: 8, kills: 4, deaths: 2, assists: 7 }],
    error: null,
  }, recentLimit);
  const rpc = jest.fn().mockResolvedValue(overrides.pointTotalsResult ?? {
    data: [{ total_season_points: '123.45', last_gw_points: '18.5' }],
    error: null,
  });

  mockSupabaseServer.mockReturnValue({
    from: (table: string) => {
      if (table === 'professional_players') return playerQuery;
      if (table === 'player_prices') return priceQuery;
      if (table === 'player_performances') return performanceQuery;
      throw new Error(`Unexpected table: ${table}`);
    },
    rpc,
  });

  return { rpc, recentLimit };
}

function playerRequest(id = '17') {
  return new NextRequest(`http://localhost:3000/api/players/${id}`);
}

describe('GET /api/players/:id', () => {
  beforeEach(() => {
    mockSupabaseServer.mockReset();
  });

  it('uses database-aggregated points and limits full performance details to recent rows', async () => {
    const { rpc, recentLimit } = createSupabase();

    const response = await GET(playerRequest(), { params: Promise.resolve({ id: '17' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('get_player_detail_point_totals', { p_player_id: 17 });
    expect(recentLimit).toHaveBeenCalledWith(15);
    expect(body.player).toMatchObject({
      total_season_points: 123.5,
      last_gw_points: 18.5,
      performances: [{ id: 301, gameweek_id: 8 }],
    });
  });

  it.each([
    ['player_prices', 'Failed to fetch player prices.'],
    ['player_performances', 'Failed to fetch player performances.'],
  ])('returns an explicit error when the %s query fails', async (table, message) => {
    createSupabase(table === 'player_prices'
      ? { priceResult: { data: null, error: { message: 'database unavailable' } } }
      : { performanceResult: { data: null, error: { message: 'database unavailable' } } });

    const response = await GET(playerRequest(), { params: Promise.resolve({ id: '17' }) });

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: message });
  });

  it('returns an explicit error when the point aggregation fails', async () => {
    createSupabase({
      pointTotalsResult: { data: null, error: { message: 'function unavailable' } },
    });

    const response = await GET(playerRequest(), { params: Promise.resolve({ id: '17' }) });

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: 'Failed to calculate player points.' });
  });

  it('returns 404 when the player does not exist', async () => {
    createSupabase({
      playerResult: { data: null, error: null },
    });

    const response = await GET(playerRequest(), { params: Promise.resolve({ id: '17' }) });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: 'Player not found.' });
  });

  it('rejects a non-numeric player ID', async () => {
    const response = await GET(playerRequest('invalid'), { params: Promise.resolve({ id: 'invalid' }) });

    expect(response.status).toBe(400);
    expect(mockSupabaseServer).not.toHaveBeenCalled();
  });
});
