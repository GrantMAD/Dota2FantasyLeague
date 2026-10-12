import { NextRequest } from 'next/server';
import { GET } from './route';

const mockVerifyAuth = jest.fn();
const mockSupabaseServer = jest.fn();
const mockGetOrCreateFantasySeason = jest.fn();
const mockApplyRefreshedTokens = jest.fn();

jest.mock('@/lib/auth-utils', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
  applyRefreshedTokens: (...args: unknown[]) => mockApplyRefreshedTokens(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/fantasy-season', () => ({
  getOrCreateFantasySeason: (...args: unknown[]) => mockGetOrCreateFantasySeason(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

describe('GET /api/user/quick-stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: 'manager-1', email: 'manager@example.test' });
    mockGetOrCreateFantasySeason.mockResolvedValue({
      id: 10,
      season_id: 1,
      budget: 42.5,
      free_transfers: 1,
      total_points: 120,
      global_rank: 7,
    });
  });

  function setupGameweekQueries(
    responses: Array<{ data: unknown; error: { message: string } | null }>,
  ) {
    const query = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(() => Promise.resolve(responses.shift()!)),
    };
    const mockFrom = jest.fn((table: string) => {
      if (table !== 'gameweeks') throw new Error(`Unexpected table: ${table}`);
      return query;
    });
    mockSupabaseServer.mockReturnValue({ from: mockFrom });
    return { mockFrom, query };
  }

  it('returns only the Header HUD fields and current gameweek summary', async () => {
    const gameweek = {
      id: 5,
      gameweek_number: 5,
      deadline: '2026-10-20T12:00:00Z',
      status: 'upcoming',
    };
    const { mockFrom, query } = setupGameweekQueries([{ data: gameweek, error: null }]);

    const response = await GET(new NextRequest('http://localhost:3000/api/user/quick-stats'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      bankBalance: 42.5,
      freeTransfers: 1,
      globalRank: 7,
      totalPoints: 120,
      gameweek,
    });
    expect(mockGetOrCreateFantasySeason).toHaveBeenCalledWith(
      expect.anything(),
      'manager-1',
    );
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(query.in).toHaveBeenCalledWith('status', ['upcoming', 'active']);
    expect(query.select).toHaveBeenCalledWith('id, gameweek_number, deadline, status');
    expect(mockApplyRefreshedTokens).toHaveBeenCalled();
  });

  it('falls back to the latest closed gameweek when no upcoming or active week exists', async () => {
    const closedGameweek = {
      id: 4,
      gameweek_number: 4,
      deadline: '2026-10-10T12:00:00Z',
      status: 'closed',
    };
    const { query } = setupGameweekQueries([
      { data: null, error: null },
      { data: closedGameweek, error: null },
    ]);

    const response = await GET(new NextRequest('http://localhost:3000/api/user/quick-stats'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ gameweek: closedGameweek });
    expect(query.eq).toHaveBeenCalledWith('status', 'closed');
    expect(query.order).toHaveBeenLastCalledWith('id', { ascending: false });
    expect(query.maybeSingle).toHaveBeenCalledTimes(2);
  });

  it('surfaces gameweek query failures as an API error', async () => {
    setupGameweekQueries([{ data: null, error: { message: 'database unavailable' } }]);

    const response = await GET(new NextRequest('http://localhost:3000/api/user/quick-stats'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to load current gameweek: database unavailable',
    });
  });
});
