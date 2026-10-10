import { NextRequest } from 'next/server';
import { GET } from './route';

const mockVerifyAuth = jest.fn();
const mockSupabaseServer = jest.fn();
const mockGetCached = jest.fn();
const mockSetCached = jest.fn();
const publicGameweeks = {
  gameweeks: [{
    id: 71,
    season_id: 4,
    gameweek_number: 3,
    match_count: 2,
    tournaments: [],
    flags: [],
    top_scorer: null,
  }],
};

jest.mock('@/lib/auth-utils', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/response-cache', () => ({
  getCached: (...args: unknown[]) => mockGetCached(...args),
  setCached: (...args: unknown[]) => mockSetCached(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

function createSupabaseClient(userId: string) {
  return {
    from: (table: string) => {
      const result = table === 'fantasy_seasons'
        ? { data: [{ id: userId === 'manager-a' ? 101 : 202 }], error: null }
        : { data: [{ gameweek_id: 71, total_points: userId === 'manager-a' ? 12 : 27 }], error: null };
      const query = {
        select: () => query,
        eq: () => query,
        limit: () => query,
        in: () => query,
        then: (resolve: (value: typeof result) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return query;
    },
  };
}

function createPublicSupabaseClient() {
  return {
    from: (table: string) => {
      const result = table === 'gameweeks'
        ? { data: [{ id: 71, season_id: 4, gameweek_number: 3 }], error: null }
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

describe('GET /api/gameweeks cached user scores', () => {
  beforeEach(() => {
    mockVerifyAuth.mockReset();
    mockSupabaseServer.mockReset();
    mockGetCached.mockReset();
    mockSetCached.mockReset();
    mockGetCached.mockReturnValue(publicGameweeks);
  });

  it('derives user scores after a shared public cache hit', async () => {
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
    expect(mockGetCached).toHaveBeenCalledWith('gameweeks:v2:status=closed');
    expect(mockSetCached).not.toHaveBeenCalled();
  });

  it('never returns another users score to an unauthenticated request with a warm cache', async () => {
    mockVerifyAuth.mockRejectedValue({ status: 401, message: 'Missing authorization' });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.gameweeks[0].user_score).toBeNull();
    expect(mockSupabaseServer).not.toHaveBeenCalled();
    expect(mockSetCached).not.toHaveBeenCalled();
  });

  it('stores only public gameweek fields in the shared cache', async () => {
    mockVerifyAuth.mockRejectedValue({ status: 401, message: 'Missing authorization' });
    mockGetCached.mockReturnValue(null);
    mockSupabaseServer.mockReturnValue(createPublicSupabaseClient());

    const response = await GET(request());
    const body = await response.json();
    const [, cachedValue] = mockSetCached.mock.calls[0];

    expect(response.status).toBe(200);
    expect(body.gameweeks[0].user_score).toBeNull();
    expect(cachedValue.gameweeks[0]).not.toHaveProperty('user_score');
  });
});
