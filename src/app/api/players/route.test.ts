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

function createQuery(table: string, availabilityFilters: string[]) {
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
    mockSupabaseServer.mockReturnValue({
      from: (table: string) => createQuery(table, availabilityFilters),
    });

    const response = await GET(new NextRequest(
      'http://localhost:3000/api/players?ids=17&show_all=true',
    ));

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([expect.objectContaining(unavailablePlayer)]);
    expect(availabilityFilters).toEqual([]);
  });

  it('continues to filter unavailable players from the default market listing', async () => {
    const availabilityFilters: string[] = [];
    mockSupabaseServer.mockReturnValue({
      from: (table: string) => createQuery(table, availabilityFilters),
    });

    const response = await GET(new NextRequest('http://localhost:3000/api/players'));

    expect(response.status).toBe(200);
    expect(availabilityFilters).toEqual(['available']);
  });
});
