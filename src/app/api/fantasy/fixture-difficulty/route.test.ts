import { NextRequest } from 'next/server';
import { GET } from './route';
import { verifyAuth } from '@/lib/auth-utils';

const mockSupabaseServer = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

jest.mock('@/lib/auth-utils', () => ({
  verifyAuth: jest.fn(),
}));

describe('GET /api/fantasy/fixture-difficulty', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(verifyAuth).mockResolvedValue({ userId: 'user-1', email: 'user@example.com' });
  });

  it('rejects invalid and duplicate team IDs', async () => {
    const invalidRequest = new NextRequest('http://localhost:3000/api/fantasy/fixture-difficulty?teamIds=1,nope');
    const duplicateRequest = new NextRequest('http://localhost:3000/api/fantasy/fixture-difficulty?teamIds=1,1');

    expect((await GET(invalidRequest)).status).toBe(400);
    expect((await GET(duplicateRequest)).status).toBe(400);
    expect(mockSupabaseServer).not.toHaveBeenCalled();
  });

  it('requires an authenticated manager', async () => {
    jest.mocked(verifyAuth).mockRejectedValue({ status: 401, message: 'Missing authorization.' });
    const request = new NextRequest('http://localhost:3000/api/fantasy/fixture-difficulty?teamIds=7');

    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(mockSupabaseServer).not.toHaveBeenCalled();
  });

  it('returns recent-form ratings for each requested team', async () => {
    const teamIds = [7, 8];
    const queryForTeam = (teamId: number) => {
      const query: Record<string, unknown> = {};
      const returnThis = () => query;
      query.select = jest.fn(returnThis);
      query.eq = jest.fn(returnThis);
      query.not = jest.fn(returnThis);
      query.or = jest.fn((condition: string) => {
        expect(condition).toBe(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`);
        return query;
      });
      query.lte = jest.fn(returnThis);
      query.order = jest.fn(returnThis);
      query.limit = jest.fn(returnThis);
      query.then = (resolve: (value: unknown) => unknown) => resolve({
        data: Array.from({ length: 10 }, (_, index) => ({
          team_a_id: teamId,
          team_b_id: 100 + index,
          winner_team_id: index < (teamId === 7 ? 8 : 3) ? teamId : 100 + index,
          scheduled_time: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
        })),
        error: null,
      });
      return query;
    };

    let lookupIndex = 0;
    mockSupabaseServer.mockReturnValue({
      from: jest.fn((table: string) => {
        expect(table).toBe('matches');
        return queryForTeam(teamIds[lookupIndex++] ?? 7);
      }),
    });

    const request = new NextRequest('http://localhost:3000/api/fantasy/fixture-difficulty?teamIds=7,8');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ratingsByTeam: {
        7: { games: 10, wins: 8, winRate: 80, rating: 5, label: 'Very Hard' },
        8: { games: 10, wins: 3, winRate: 30, rating: 2, label: 'Easy' },
      },
    });
  });
});
