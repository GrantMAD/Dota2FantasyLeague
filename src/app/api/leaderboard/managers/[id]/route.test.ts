import { NextRequest } from 'next/server';
import { GET } from './route';

const mockVerifyAuth = jest.fn();
const mockSupabaseServer = jest.fn();
let mockQueries: Array<{ table: string; filters: Array<[string, unknown]> }> = [];

jest.mock('@/lib/auth-utils', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
  applyRefreshedTokens: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

function createQuery(table: string) {
  const filters: Array<[string, unknown]> = [];
  const query: Record<string, (...args: never[]) => unknown> = {};
  const chain = () => query;
  query.select = jest.fn(chain);
  query.eq = jest.fn((column: string, value: unknown) => {
    filters.push([column, value]);
    return query;
  });
  query.in = jest.fn((column: string, value: unknown) => {
    filters.push([column, value]);
    return query;
  });
  query.order = jest.fn(chain);
  query.limit = jest.fn(chain);
  query.maybeSingle = jest.fn(async () => ({
    data: table === 'fantasy_seasons'
      ? {
          season_id: 1,
          total_points: 125,
          global_rank: 4,
          gameweek_points_latest: 18,
          users: {
            username: 'manager',
            display_name: 'Fantasy Manager',
            avatar_url: null,
            bio: 'A short bio',
            country_code: 'US',
            created_at: '2024-01-01T00:00:00.000Z',
          },
          fantasy_squads: [{
            name: 'Team Name',
            fantasy_squad_members: [
              {
                player_id: 7,
                removed_date: null,
                professional_players: {
                  id: 7,
                  name: 'Player Name',
                  in_game_name: 'Player',
                  primary_role: 'Carry',
                  profile_image_url: null,
                  professional_teams: { name: 'Team Alpha' },
                },
              },
              {
                player_id: 8,
                removed_date: '2025-01-01T00:00:00.000Z',
                professional_players: null,
              },
            ],
          }],
        }
      : null,
    error: null,
  }));
  query.then = (resolve: (value: unknown) => unknown) => resolve(table === 'gameweeks'
    ? {
      data: [
        { id: 6, gameweek_number: 6, status: 'closed' },
        { id: 5, gameweek_number: 5, status: 'locked' },
      ],
      error: null,
    }
    : {
      data: [
        { gameweek_id: 6, total_points: 18 },
        { gameweek_id: 5, total_points: 12 },
      ],
      error: null,
    });
  mockQueries.push({ table, filters });
  return query;
}

describe('GET /api/leaderboard/managers/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueries = [];
    mockVerifyAuth.mockResolvedValue({ userId: 'viewer' });
    mockSupabaseServer.mockReturnValue({
      from: (table: string) => createQuery(table),
    });
  });

  it('returns safe profile, active squad, and recent gameweek details', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/leaderboard/managers/123'),
      { params: Promise.resolve({ id: '123' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.manager).toMatchObject({
      username: 'manager',
      country: 'United States',
      teamName: 'Team Name',
      totalPoints: 125,
      globalRank: 4,
      gameweekPoints: 18,
    });
    expect(body.squad).toEqual([{
      id: 7,
      name: 'Player',
      role: 'Carry',
      team: 'Team Alpha',
      profileImageUrl: null,
    }]);
    expect(body.recentGameweeks).toEqual([
      { gameweekNumber: 6, status: 'closed', points: 18 },
      { gameweekNumber: 5, status: 'locked', points: 12 },
    ]);
    expect(mockQueries.some(({ table, filters }) =>
      table === 'gameweeks' && filters.some(([column, value]) =>
        column === 'status' && Array.isArray(value) && value.includes('closed') && value.includes('locked'),
      ),
    )).toBe(true);
    expect(body).not.toHaveProperty('budget');
  });

  it('rejects invalid manager IDs', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/leaderboard/managers/nope'),
      { params: Promise.resolve({ id: 'nope' }) },
    );

    expect(response.status).toBe(400);
    expect(mockSupabaseServer).not.toHaveBeenCalled();
  });
});
