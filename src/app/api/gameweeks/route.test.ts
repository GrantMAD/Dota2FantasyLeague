import { NextRequest } from 'next/server';
import { GET } from './route';

const mockVerifyAuth = jest.fn();
const mockSupabaseServer = jest.fn();

jest.mock('@/lib/auth-utils', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

function createSupabaseClient(userId: string) {
  return {
    rpc: jest.fn().mockResolvedValue({
      data: [{ gameweek_id: 71, global_average: 14.5 }],
      error: null,
    }),
    from: (table: string) => {
      const result = table === 'fantasy_seasons'
        ? { data: [{ id: userId === 'manager-a' ? 101 : 202 }], error: null }
        : table === 'fantasy_lineups'
          ? { data: [{ gameweek_id: 71, total_points: userId === 'manager-a' ? 12 : 27 }], error: null }
          : table === 'gameweeks'
            ? { data: [{ id: 71, season_id: 4, gameweek_number: 3 }], error: null }
            : table === 'matches'
              ? { data: [{ gameweek_id: 71, series_id: null, status: 'in_progress' }], error: null }
              : { data: [], error: null };
      const query = {
        select: () => query,
        eq: () => query,
        limit: () => query,
        in: () => query,
        order: () => query,
        not: () => query,
        then: (resolve: (value: typeof result) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return query;
    },
  };
}

function createPublicSupabaseClient() {
  return {
    rpc: jest.fn().mockResolvedValue({
      data: [{ gameweek_id: 71, global_average: 14.5 }],
      error: null,
    }),
    from: (table: string) => {
      const result = table === 'gameweeks'
        ? { data: [{ id: 71, season_id: 4, gameweek_number: 3 }], error: null }
        : table === 'matches'
          ? { data: [{ gameweek_id: 71, series_id: null, status: 'in_progress' }], error: null }
          : { data: [], error: null };
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: () => query,
        in: () => query,
        not: () => query,
        then: (resolve: (value: typeof result) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return query;
    },
  };
}

function request() {
  return new NextRequest('http://localhost:3000/api/gameweeks?status=closed');
}

describe('GET /api/gameweeks cache privacy', () => {
  beforeEach(() => {
    mockVerifyAuth.mockReset();
    mockSupabaseServer.mockReset();
  });

  it('returns each authenticated manager score privately', async () => {
    mockVerifyAuth
      .mockResolvedValueOnce({ userId: 'manager-a' })
      .mockResolvedValueOnce({ userId: 'manager-b' });
    mockSupabaseServer
      .mockReturnValueOnce(createSupabaseClient('manager-a'))
      .mockReturnValueOnce(createSupabaseClient('manager-b'));

    const responseA = await GET(request());
    const responseB = await GET(request());

    expect((await responseA.json()).gameweeks[0].user_score).toBe(12);
    expect((await responseB.json()).gameweeks[0].user_score).toBe(27);
    expect(responseA.headers.get('Cache-Control')).toBe('private, no-store');
    expect(responseB.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('returns public gameweek data without a user score for unauthenticated requests', async () => {
    mockVerifyAuth.mockRejectedValue({ status: 401, message: 'Missing authorization' });
    mockSupabaseServer.mockReturnValue(createPublicSupabaseClient());

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.gameweeks[0].user_score).toBeNull();
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=60, stale-while-revalidate=30');
    expect(body.gameweeks[0].global_average).toBe(14.5);
    expect(body.gameweeks[0].match_count).toBe(1);
    expect(body.gameweeks[0].live_match_count).toBe(1);
    expect(mockSupabaseServer.mock.results[0].value.rpc).toHaveBeenCalledWith(
      'get_global_gameweek_averages',
      { p_gameweek_ids: [71] },
    );
  });
});
