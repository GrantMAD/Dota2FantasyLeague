import { NextRequest } from 'next/server';
import { GET } from './route';

const mockSupabaseServer = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

describe('GET /api/matches/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 for invalid match id', async () => {
    const request = new NextRequest('http://localhost:3000/api/matches/invalid');
    const response = await GET(request, { params: Promise.resolve({ id: 'invalid' }) });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid match ID.');
  });

  it('returns 404 when match is not found', async () => {
    mockSupabaseServer.mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      })),
    });

    const request = new NextRequest('http://localhost:3000/api/matches/999');
    const response = await GET(request, { params: Promise.resolve({ id: '999' }) });
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('Match not found.');
  });

  it('returns match details with player stats and fantasy breakdown', async () => {
    const matchRecord = {
      id: 101,
      status: 'completed',
      scheduled_time: '2026-10-15T10:00:00Z',
      duration_minutes: 42,
      gameweek_id: 2,
      series_id: 10,
      team_a_id: 1,
      team_b_id: 2,
      winner_team_id: 1,
    };

    mockSupabaseServer.mockReturnValue({
      from: jest.fn((table: string) => {
        const query: Record<string, unknown> = {};
        const returnThis = () => query;
        query.select = jest.fn(returnThis);
        query.eq = jest.fn(returnThis);
        query.in = jest.fn(returnThis);
        query.order = jest.fn(returnThis);
        query.limit = jest.fn(returnThis);

        if (table === 'matches') {
          query.maybeSingle = jest.fn().mockResolvedValue({ data: matchRecord, error: null });
        } else if (table === 'professional_teams') {
          query.then = (resolve: (val: unknown) => unknown) =>
            resolve({
              data: [
                { id: 1, name: 'Team Liquid', slug: 'team-liquid', logo_url: null, region: 'WEU' },
                { id: 2, name: 'Gaimin Gladiators', slug: 'gaimin-gladiators', logo_url: null, region: 'WEU' },
              ],
              error: null,
            });
        } else if (table === 'tournament_series') {
          query.maybeSingle = jest.fn().mockResolvedValue({
            data: { id: 10, tournament_id: 5, best_of: 3, series_number: 1 },
            error: null,
          });
        } else if (table === 'tournaments') {
          query.maybeSingle = jest.fn().mockResolvedValue({
            data: { id: 5, name: 'The International', slug: 'ti', tier: 'Tier 1' },
            error: null,
          });
        } else if (table === 'gameweeks') {
          query.maybeSingle = jest.fn().mockResolvedValue({
            data: { id: 2, gameweek_number: 2, status: 'completed' },
            error: null,
          });
        } else if (table === 'match_player_stats') {
          query.then = (resolve: (val: unknown) => unknown) =>
            resolve({
              data: [
                {
                  id: 1,
                  player_id: 10,
                  team_id: 1,
                  hero_name: 'Pudge',
                  kills: 10,
                  deaths: 2,
                  assists: 15,
                  gold_per_minute: 600,
                  experience_per_minute: 700,
                  hero_damage: 25000,
                  wards_placed: 4,
                  healing: 1000,
                  professional_players: { id: 10, name: 'Boxi', in_game_name: 'Boxi', primary_role: 'Support' },
                },
              ],
              error: null,
            });
        } else if (table === 'player_performances') {
          query.then = (resolve: (val: unknown) => unknown) =>
            resolve({
              data: [
                {
                  id: 50,
                  player_id: 10,
                  fantasy_points_breakdown: {
                    total_points: 38.5,
                    combat_points: 15.0,
                    economy_points: 8.0,
                    objective_points: 5.5,
                    teamfight_points: 6.0,
                    win_points: 4.0,
                  },
                },
              ],
              error: null,
            });
        } else if (table === 'match_player_substitutions') {
          query.then = (resolve: (val: unknown) => unknown) => resolve({ data: [], error: null });
        } else {
          query.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
          query.then = (resolve: (val: unknown) => unknown) => resolve({ data: [], error: null });
        }

        return query;
      }),
    });

    const request = new NextRequest('http://localhost:3000/api/matches/101');
    const response = await GET(request, { params: Promise.resolve({ id: '101' }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.match).toBeDefined();
    expect(body.match.id).toBe(101);
    expect(body.match.radiant_team.name).toBe('Team Liquid');
    expect(body.playerStats).toHaveLength(1);
    expect(body.playerStats[0].hero_name).toBe('Pudge');
    expect(body.fantasyBreakdown).toHaveLength(1);
    expect(body.fantasyBreakdown[0].total_points).toBe(38.5);
    expect(body.fantasyBreakdown[0].combat_points).toBe(15.0);
  });
});
