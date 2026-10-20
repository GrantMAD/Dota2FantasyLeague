import { NextRequest } from 'next/server';
import { GET } from './route';

const mockSupabaseServer = jest.fn();
const mockGetCached = jest.fn();
const mockSetCached = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabaseServer: () => mockSupabaseServer(),
}));

jest.mock('@/lib/response-cache', () => ({
  getCached: (...args: unknown[]) => mockGetCached(...args),
  setCached: (...args: unknown[]) => mockSetCached(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

function createSupabaseClient() {
  const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const results: Record<string, { data: unknown[]; error: null }> = {
    tournaments: {
      data: [{
        id: 10,
        season_id: 2,
        name: 'Test Major',
        slug: 'test-major',
        status: 'eligible',
        tier: 'Tier 1',
        start_date: '2026-10-01',
        end_date: '2026-10-31',
        eligible: true,
        last_synced_at: null,
      }],
      error: null,
    },
    tournament_series: {
      data: [{ id: 30, tournament_id: 10, series_number: 1, best_of: 3, team_a_id: 5, team_b_id: 6 }],
      error: null,
    },
    matches: {
      data: [
        { series_id: 30, status: 'completed', scheduled_time: '2026-10-19T10:00:00.000Z' },
        { series_id: 30, status: 'scheduled', scheduled_time: futureTime },
      ],
      error: null,
    },
    professional_teams: {
      data: [
        { id: 5, name: 'Radiant', logo_url: null },
        { id: 6, name: 'Dire', logo_url: null },
      ],
      error: null,
    },
  };

  return {
    from: (table: string) => {
      const result = results[table];
      const query = {
        select: () => query,
        order: () => query,
        eq: () => query,
        in: () => query,
        then: (resolve: (value: typeof result) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return query;
    },
  };
}

describe('GET /api/tournaments', () => {
  beforeEach(() => {
    mockSupabaseServer.mockReset().mockReturnValue(createSupabaseClient());
    mockGetCached.mockReset().mockReturnValue(null);
    mockSetCached.mockReset();
  });

  it('returns tournament schedule progress and the next scheduled series', async () => {
    const response = await GET(new NextRequest('http://localhost:3000/api/tournaments'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.tournaments[0]).toMatchObject({
      series_count: 1,
      match_count: 2,
      completed_match_count: 1,
      live_match_count: 0,
      best_of_formats: [3],
      upcoming_series: {
        series_number: 1,
        team_a: 'Radiant',
        team_b: 'Dire',
      },
    });
    expect(mockSetCached).toHaveBeenCalledWith(
      'tournaments:',
      expect.objectContaining({ tournaments: expect.any(Array) }),
      60_000,
    );
  });
});
