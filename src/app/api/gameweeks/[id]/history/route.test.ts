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

function createSupabaseClient(options?: {
  gameweekStatus?: string;
  hasLineup?: boolean;
  activeChip?: 'triple_captain' | 'bench_boost' | 'wildcard' | null;
}) {
  const gameweekStatus = options?.gameweekStatus ?? 'closed';
  const hasLineup = options?.hasLineup ?? true;
  const activeChip = options?.activeChip ?? null;

  return {
    from: (table: string) => {
      let result: { data: unknown; error: unknown } = { data: [], error: null };

      if (table === 'gameweeks') {
        result = {
          data: { id: 42, season_id: 1, gameweek_number: 4, status: gameweekStatus },
          error: null,
        };
      } else if (table === 'fantasy_seasons') {
        result = {
          data: [
            {
              id: 10,
              season_id: 1,
              triple_captain_gameweek_id: activeChip === 'triple_captain' ? 42 : null,
              bench_boost_gameweek_id: activeChip === 'bench_boost' ? 42 : null,
              wildcard_used_gameweek_id: activeChip === 'wildcard' ? 42 : null,
            },
          ],
          error: null,
        };
      } else if (table === 'fantasy_lineups') {
        result = {
          data: hasLineup
            ? [
                {
                  fantasy_season_id: 10,
                  total_points: 65.5,
                  captain_player_id: 1,
                  vice_captain_player_id: 2,
                  carry_id: 1,
                  mid_id: 2,
                  offlane_id: 3,
                  support_id: 4,
                  hard_support_id: 5,
                  bench_1_id: 6,
                  bench_2_id: 7,
                  bench_3_id: null,
                },
              ]
            : [],
          error: null,
        };
      } else if (table === 'professional_players') {
        result = {
          data: [
            { id: 1, name: 'Yatoro', in_game_name: 'Yatoro', primary_role: 'Carry', profile_image_url: '/yatoro.png' },
            { id: 2, name: 'bzm', in_game_name: 'bzm', primary_role: 'Mid', profile_image_url: '/bzm.png' },
            { id: 3, name: 'Collapse', in_game_name: 'Collapse', primary_role: 'Offlane', profile_image_url: null },
            { id: 4, name: 'XinQ', in_game_name: 'XinQ', primary_role: 'Support', profile_image_url: null },
            { id: 5, name: 'Miposhka', in_game_name: 'Miposhka', primary_role: 'Hard Support', profile_image_url: null },
            { id: 6, name: 'skiter', in_game_name: 'skiter', primary_role: 'Carry', profile_image_url: null },
            { id: 7, name: 'Sneyking', in_game_name: 'Sneyking', primary_role: 'Support', profile_image_url: null },
          ],
          error: null,
        };
      } else if (table === 'player_performances') {
        result = {
          data: [
            { player_id: 1, fantasy_points_breakdown: { total_points: 15.0 } },
            { player_id: 2, fantasy_points_breakdown: { total_points: 10.0 } },
            { player_id: 3, fantasy_points_breakdown: { total_points: 8.5 } },
            { player_id: 4, fantasy_points_breakdown: { total_points: 7.0 } },
            { player_id: 5, fantasy_points_breakdown: { total_points: 5.0 } },
            { player_id: 6, fantasy_points_breakdown: { total_points: 12.0 } },
          ],
          error: null,
        };
      }

      const query: Record<string, unknown> = {
        select: () => query,
        eq: () => query,
        in: () => query,
        not: () => query,
        maybeSingle: () => Promise.resolve(result),
        then: (resolve: (value: typeof result) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return query;
    },
  };
}

describe('GET /api/gameweeks/[id]/history', () => {
  beforeEach(() => {
    mockVerifyAuth.mockReset();
    mockSupabaseServer.mockReset();
  });

  it('returns lineup with 2x captain multiplier and starters for closed gameweeks', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'test-user-id' });
    mockSupabaseServer.mockReturnValue(createSupabaseClient({ gameweekStatus: 'closed' }));

    const req = new NextRequest('http://localhost:3000/api/gameweeks/42/history');
    const res = await GET(req, { params: Promise.resolve({ id: '42' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.gameweek.id).toBe(42);
    expect(data.gameweek.status).toBe('closed');
    expect(data.starters).toHaveLength(5);
    expect(data.bench).toHaveLength(2);

    // Captain Yatoro (id 1) raw points 15.0 -> 30.0 effective points with 2x multiplier
    const captain = data.starters.find((p: { id: number }) => p.id === 1);
    expect(captain).toBeDefined();
    expect(captain.isCaptain).toBe(true);
    expect(captain.multiplier).toBe(2);
    expect(captain.rawPoints).toBe(15.0);
    expect(captain.points).toBe(30.0);
  });

  it('supports active gameweeks and applies triple captain multiplier when chip was active', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'test-user-id' });
    mockSupabaseServer.mockReturnValue(createSupabaseClient({
      gameweekStatus: 'active',
      activeChip: 'triple_captain',
    }));

    const req = new NextRequest('http://localhost:3000/api/gameweeks/42/history');
    const res = await GET(req, { params: Promise.resolve({ id: '42' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.gameweek.status).toBe('active');
    expect(data.activeChip).toBe('triple_captain');

    // Captain Yatoro (id 1) raw points 15.0 -> 45.0 with 3x Triple Captain
    const captain = data.starters.find((p: { id: number }) => p.id === 1);
    expect(captain.multiplier).toBe(3);
    expect(captain.points).toBe(45.0);
  });

  it('returns empty starters when user has no lineup for this gameweek', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'test-user-id' });
    mockSupabaseServer.mockReturnValue(createSupabaseClient({ hasLineup: false }));

    const req = new NextRequest('http://localhost:3000/api/gameweeks/42/history');
    const res = await GET(req, { params: Promise.resolve({ id: '42' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.starters).toEqual([]);
    expect(data.bench).toEqual([]);
    expect(data.managerScore).toBeNull();
  });

  it('returns 400 for invalid gameweek id', async () => {
    mockVerifyAuth.mockResolvedValue({ userId: 'test-user-id' });
    const req = new NextRequest('http://localhost:3000/api/gameweeks/abc/history');
    const res = await GET(req, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(400);
  });
});

