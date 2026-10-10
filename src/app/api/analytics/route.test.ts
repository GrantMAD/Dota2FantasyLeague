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

describe('GET /api/analytics - Finding 31: Dynamic gameweek resolution and role-based Dream Team', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: 'manager-42', email: 'manager42@example.test' });
  });

  it('dynamically resolves to latest closed gameweek and selects authentic Dream Team role distribution', async () => {
    let queriedGameweekId: number | null = null;

    const mockFrom = jest.fn((table: string) => {
      if (table === 'fantasy_seasons') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              id: 10,
              season_id: 1,
              budget: 100,
              total_points: 250,
              global_rank: 5,
              free_transfers: 2,
            },
            error: null,
          }),
        };
      }

      if (table === 'fantasy_lineups') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          then: (resolve: (val: unknown) => void) => {
            // User has NO saved lineups yet -> tests dynamic fallback gameweek resolution!
            resolve({ data: [], error: null });
          },
        };
      }

      if (table === 'gameweeks') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: 7 }, // Latest closed gameweek is GW 7 (NOT hardcoded 2!)
            error: null,
          }),
        };
      }

      if (table === 'fantasy_squads') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: 100, fantasy_squad_members: [] },
            error: null,
          }),
        };
      }

      if (table === 'player_performances') {
        const query: Record<string, unknown> = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn((col: string, val: number) => {
            if (col === 'gameweek_id') queriedGameweekId = val;
            return query;
          }),
          not: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          then: (resolve: (val: unknown) => void) => {
            // Provide 6 Carries and 2 Supports, where all 6 Carries scored high.
            // Under old naive slice(0, 8), Dream Team would pick all 6 Carries with 0 Offlane, 0 Mid, 0 Hard Support.
            // Under the fix, it MUST pick 1 Carry, 1 Mid, 1 Offlane, 1 Support, 1 Hard Support, plus 3 bench!
            resolve({
              data: [
                // 4 Top scoring carries
                { player_id: 1, fantasy_points_breakdown: { total_points: 50 }, professional_players: { id: 1, in_game_name: 'Carry 1', primary_role: 'Carry', team_id: 1, professional_teams: { name: 'Team Liquid' } } },
                { player_id: 2, fantasy_points_breakdown: { total_points: 48 }, professional_players: { id: 2, in_game_name: 'Carry 2', primary_role: 'Carry', team_id: 1, professional_teams: { name: 'Team Liquid' } } },
                { player_id: 3, fantasy_points_breakdown: { total_points: 46 }, professional_players: { id: 3, in_game_name: 'Carry 3', primary_role: 'Carry', team_id: 1, professional_teams: { name: 'Team Liquid' } } },
                { player_id: 4, fantasy_points_breakdown: { total_points: 44 }, professional_players: { id: 4, in_game_name: 'Carry 4', primary_role: 'Carry', team_id: 1, professional_teams: { name: 'Team Liquid' } } },
                { player_id: 5, fantasy_points_breakdown: { total_points: 42 }, professional_players: { id: 5, in_game_name: 'Carry 5', primary_role: 'Carry', team_id: 1, professional_teams: { name: 'Team Liquid' } } },
                // 1 Mid
                { player_id: 6, fantasy_points_breakdown: { total_points: 30 }, professional_players: { id: 6, in_game_name: 'Mid 1', primary_role: 'Mid', team_id: 2, professional_teams: { name: 'Team Spirit' } } },
                // 1 Offlane
                { player_id: 7, fantasy_points_breakdown: { total_points: 25 }, professional_players: { id: 7, in_game_name: 'Offlane 1', primary_role: 'Offlane', team_id: 2, professional_teams: { name: 'Team Spirit' } } },
                // 1 Support
                { player_id: 8, fantasy_points_breakdown: { total_points: 20 }, professional_players: { id: 8, in_game_name: 'Support 1', primary_role: 'Support', team_id: 3, professional_teams: { name: 'Gaimin' } } },
                // 1 Hard Support
                { player_id: 9, fantasy_points_breakdown: { total_points: 18 }, professional_players: { id: 9, in_game_name: 'Hard Support 1', primary_role: 'Hard Support', team_id: 3, professional_teams: { name: 'Gaimin' } } },
              ],
              error: null,
            });
          },
        };
        return query;
      }

      if (table === 'player_prices') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    mockSupabaseServer.mockReturnValue({ from: mockFrom });

    const response = await GET(new NextRequest('http://localhost:3000/api/analytics'));
    expect(response.status).toBe(200);

    const json = await response.json();
    // 1. Verify dynamic gameweek resolution: queried GW 7 instead of hardcoded 2!
    expect(queriedGameweekId).toBe(7);

    // 2. Verify Dream Team composition: 8 players total
    expect(json.dreamTeam).toHaveLength(8);

    // Verify all 5 starter roles are represented
    const roles = json.dreamTeam.map((p: { role: string }) => p.role);
    expect(roles).toContain('Carry');
    expect(roles).toContain('Mid');
    expect(roles).toContain('Offlane');
    expect(roles).toContain('Support');
    expect(roles).toContain('Hard Support');

    // The top scorers for the 5 positions should be:
    // Carry 1 (50 pts), Mid 1 (30 pts), Offlane 1 (25 pts), Support 1 (20 pts), Hard Support 1 (18 pts)
    // Plus top 3 remaining bench: Carry 2 (48 pts), Carry 3 (46 pts), Carry 4 (44 pts)
    const playerNames = json.dreamTeam.map((p: { playerName: string }) => p.playerName);
    expect(playerNames).toContain('Carry 1');
    expect(playerNames).toContain('Mid 1');
    expect(playerNames).toContain('Offlane 1');
    expect(playerNames).toContain('Support 1');
    expect(playerNames).toContain('Hard Support 1');
    expect(playerNames).toContain('Carry 2');
    expect(playerNames).toContain('Carry 3');
    expect(playerNames).toContain('Carry 4');
    expect(playerNames).not.toContain('Carry 5'); // 5th carry omitted because squad size is 8
  });
});
