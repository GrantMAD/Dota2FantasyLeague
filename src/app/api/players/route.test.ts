import { NextRequest } from 'next/server';
import { GET } from './route';

const mockSupabaseServer = jest.fn();
const unavailablePlayer = {
  id: 17,
  name: 'Unavailable Player',
  availability_status: 'injured',
};

type QueryResult = {
  data: typeof unavailablePlayer[];
  count?: number;
  error: null;
};

type MockQuery = {
  select: () => MockQuery;
  eq: (column: string, value: string) => MockQuery;
  not: () => MockQuery;
  in: () => MockQuery;
  order: () => MockQuery;
  limit: (count: number) => MockQuery;
  range: () => MockQuery;
  or: () => MockQuery;
  then: Promise<QueryResult>['then'];
};

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/response-cache', () => ({
  getCached: () => null,
  setCached: jest.fn(),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

function createQuery(
  table: string,
  availabilityFilters: string[],
  rowLimits: Record<string, number>,
) {
  const result: QueryResult = table === 'professional_players'
    ? { data: [unavailablePlayer], count: 1, error: null }
    : { data: [], error: null };

  const query: MockQuery = {
    select: () => query,
    eq: (column, value) => {
      if (table === 'professional_players' && column === 'availability_status') {
        availabilityFilters.push(value);
      }
      return query;
    },
    not: () => query,
    in: () => query,
    order: () => query,
    limit: (count) => {
      rowLimits[table] = count;
      return query;
    },
    range: () => query,
    or: () => query,
    then: (onfulfilled, onrejected) => Promise.resolve(result).then(onfulfilled, onrejected),
  };

  return query;
}

describe('GET /api/players availability filtering', () => {
  beforeEach(() => {
    mockSupabaseServer.mockReset();
  });

  it('includes unavailable owned players when show_all=true is requested by ID', async () => {
    const availabilityFilters: string[] = [];
    const rowLimits: Record<string, number> = {};
    mockSupabaseServer.mockReturnValue({
      from: (table: string) => createQuery(table, availabilityFilters, rowLimits),
    });

    const response = await GET(new NextRequest(
      'http://localhost:3000/api/players?ids=17&show_all=true',
    ));

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([expect.objectContaining(unavailablePlayer)]);
    expect(availabilityFilters).toEqual([]);
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=60, stale-while-revalidate=30');
  });

  it('continues to filter unavailable players from the default market listing', async () => {
    const availabilityFilters: string[] = [];
    const rowLimits: Record<string, number> = {};
    mockSupabaseServer.mockReturnValue({
      from: (table: string) => createQuery(table, availabilityFilters, rowLimits),
    });

    const response = await GET(new NextRequest('http://localhost:3000/api/players'));

    expect(response.status).toBe(200);
    expect(availabilityFilters).toEqual(['available']);
  });

  it('enriches player data with price_history', async () => {
    const availabilityFilters: string[] = [];
    const rowLimits: Record<string, number> = {};
    mockSupabaseServer.mockReturnValue({
      from: (table: string) => {
        if (table === 'player_prices') {
          const priceRows = [
            { player_id: 17, price: 8.5, price_change: 0.5, gameweek_id: 3 },
            { player_id: 17, price: 8.0, price_change: 0.2, gameweek_id: 2 },
            { player_id: 17, price: 7.8, price_change: 0.0, gameweek_id: 1 },
          ];
          return {
            select: () => ({
              in: () => ({
                order: () => ({
                  limit: (count: number) => {
                    rowLimits[table] = count;
                    return Promise.resolve({ data: priceRows, error: null });
                  },
                }),
              }),
            }),
          };
        }
        if (table === 'gameweek_scores') {
          return {
            select: () => ({
              in: () => ({
                order: () => ({
                  limit: (count: number) => {
                    rowLimits[table] = count;
                    return Promise.resolve({ data: [], error: null });
                  },
                }),
              }),
            }),
          };
        }
        return createQuery(table, availabilityFilters, rowLimits);
      },
    });

    const response = await GET(new NextRequest('http://localhost:3000/api/players?ids=17&show_all=true'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data[0].price_history).toEqual([7.8, 8.0, 8.5]);
    expect(body.data[0].current_price).toBe(8.5);
    expect(body.data[0].price_change).toBe(0.5);
    expect(rowLimits.player_prices).toBe(7);
    expect(rowLimits.gameweek_scores).toBe(5);
  });
});
