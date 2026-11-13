import { NextRequest } from 'next/server';
import { GET } from './route';
import { getTeamDisplayTag } from '@/lib/team-tag';

const mockSupabaseServer = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

function createSupabaseMock() {
  const matchCalls: Array<{ selectOptions?: { head?: boolean }; operations: unknown[][] }> = [];
  const matchRecord = {
    id: 201,
    status: 'scheduled',
    scheduled_time: '2026-10-13T12:00:00.000Z',
    duration_minutes: null,
    gameweek_id: 4,
    series_id: 90,
    match_number: 1,
    team_a_id: 10,
    team_b_id: 11,
    winner_team_id: null,
  };

  return {
    matchCalls,
    client: {
      from(table: string) {
        let selected = '';
        let selectOptions: { head?: boolean } | undefined;
        const operations: unknown[][] = [];
        const query: Record<string, (...args: unknown[]) => unknown> = {};
        const chain = (method: string) => (...args: unknown[]) => {
          operations.push([method, ...args]);
          return query;
        };

        query.select = (...args: unknown[]) => {
          selected = String(args[0] ?? '');
          selectOptions = args[1] as { head?: boolean } | undefined;
          if (table === 'matches') matchCalls.push({ selectOptions, operations });
          return query;
        };
        for (const method of ['eq', 'in', 'or', 'ilike', 'order', 'range', 'limit']) {
          query[method] = chain(method);
        }
        query.then = ((resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
          let result: { data: unknown[] | null; count?: number | null; error: null };
          if (table === 'matches') {
            if (selectOptions?.head) {
              const statusFilter = operations.find(([method, column]) => method === 'eq' && column === 'status')?.[2];
              const count = statusFilter === 'in_progress' ? 3
                : statusFilter === 'completed' ? 26
                  : statusFilter === 'scheduled' ? 13 : statusFilter === undefined ? 42 : 0;
              result = { data: null, count, error: null };
            } else {
              const liveFilter = operations.some(([method, column, value]) =>
                method === 'eq' && column === 'status' && value === 'in_progress'
              );
              const isSeriesSiblingQuery = operations.some(([method, column]) => method === 'in' && column === 'series_id')
                && !operations.some(([method]) => method === 'range');
              result = {
                data: isSeriesSiblingQuery
                  ? [
                      matchRecord,
                      {
                        ...matchRecord,
                        id: 202,
                        status: 'completed',
                        scheduled_time: '2026-10-13T13:00:00.000Z',
                        match_number: null,
                      },
                      {
                        ...matchRecord,
                        id: 203,
                        team_a_id: 12,
                        team_b_id: 13,
                      },
                      {
                        ...matchRecord,
                        id: 204,
                        gameweek_id: 5,
                      },
                    ]
                  : [{ ...matchRecord, status: liveFilter ? 'in_progress' : matchRecord.status }],
                count: 42,
                error: null,
              };
            }
          } else if (table === 'match_player_stats') {
            result = { data: [{ match_id: 201, player_id: 501 }], error: null };
          } else if (table === 'professional_teams' && selected === 'id') {
            result = { data: [{ id: 10 }], error: null };
          } else if (table === 'professional_teams') {
            result = {
              data: [
                { id: 10, name: 'Team Liquid', slug: 'team-liquid', logo_url: null, region: 'EU' },
                { id: 11, name: 'Team Spirit', slug: 'team-spirit', logo_url: null, region: 'EU' },
              ],
              error: null,
            };
          } else if (table === 'tournament_series' && selected === 'id') {
            const byTournamentId = operations.some(([method, column]) => method === 'eq' && column === 'tournament_id');
            result = { data: [{ id: byTournamentId ? 90 : 91 }], error: null };
          } else if (table === 'tournament_series') {
            result = { data: [{ id: 90, tournament_id: 6, best_of: 3, series_number: 1 }], error: null };
          } else if (table === 'tournaments' && selected === 'id') {
            result = { data: [{ id: 7 }], error: null };
          } else if (table === 'tournaments' && selected === 'id, name') {
            result = { data: [{ id: 6, name: 'International' }, { id: 7, name: 'DreamLeague' }], error: null };
          } else {
            result = { data: [{ id: 6, name: 'International', slug: 'international', tier: 'Tier 1' }], error: null };
          }
          return Promise.resolve(result).then(resolve, reject);
        }) as (...args: unknown[]) => unknown;
        return query;
      },
    },
  };
}

describe('GET /api/matches server-side filtering and pagination', () => {
  beforeEach(() => {
    mockSupabaseServer.mockReset();
  });

  it('creates readable initials from the team name instead of reusing provider slugs', () => {
    expect(getTeamDisplayTag('Team Liquid')).toBe('TL');
    expect(getTeamDisplayTag('Team Spirit')).toBe('TS');
    expect(getTeamDisplayTag('T1')).toBe('T1');
  });

  it('applies status, tournament, team/tournament search, and page filters before returning results', async () => {
    const mock = createSupabaseMock();
    mockSupabaseServer.mockReturnValue(mock.client);

    const response = await GET(new NextRequest(
      'http://localhost:3000/api/matches?status=upcoming&tournamentId=6&search=Liquid&page=2&limit=20',
    ));
    const body = await response.json();
    const pageQuery = mock.matchCalls.find(({ selectOptions }) => !selectOptions?.head);
    const pageOperations = pageQuery?.operations ?? [];

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=30, stale-while-revalidate=30');
    expect(pageOperations).toContainEqual(['eq', 'status', 'scheduled']);
    expect(pageOperations).toContainEqual(['in', 'series_id', [90]]);
    expect(pageOperations).toContainEqual(['range', 20, 39]);
    expect(pageOperations).toContainEqual([
      'or',
      'team_a_id.in.(10),team_b_id.in.(10),series_id.in.(91)',
    ]);
    expect(body.pagination).toEqual({ page: 2, limit: 20, total: 42, totalPages: 3 });
    expect(body.counts).toEqual({ all: 42, live: 3, upcoming: 13, completed: 26 });
    expect(body.tournaments).toEqual([
      { id: 6, name: 'International' },
      { id: 7, name: 'DreamLeague' },
    ]);
    expect(body.matches[0].player_ids).toEqual([501]);
    expect(body.matches[0].radiant_team.tag).toBe('TL');
    expect(body.matches[0].dire_team.tag).toBe('TS');
    expect(body.matches[0].series_matches.map((match: { id: number; match_number: number }) => [
      match.id,
      match.match_number,
    ])).toEqual([[201, 1], [202, 2]]);
  });

  it('maps the live filter to the database enum and normalizes in-progress records for the UI', async () => {
    const mock = createSupabaseMock();
    mockSupabaseServer.mockReturnValue(mock.client);

    const response = await GET(new NextRequest(
      'http://localhost:3000/api/matches?page=1&limit=24&status=live',
    ));
    const body = await response.json();
    const pageQuery = mock.matchCalls.find(({ selectOptions }) => !selectOptions?.head);

    expect(response.status).toBe(200);
    expect(pageQuery?.operations).toContainEqual(['eq', 'status', 'in_progress']);
    expect(body.matches[0].status).toBe('live');
  });

  it('filters a batch of team schedules in a single match query', async () => {
    const mock = createSupabaseMock();
    mockSupabaseServer.mockReturnValue(mock.client);

    const response = await GET(new NextRequest(
      'http://localhost:3000/api/matches?teamIds=10,11&status=scheduled&order=asc&limit=100',
    ));
    const pageQuery = mock.matchCalls.find(({ selectOptions }) => !selectOptions?.head);

    expect(response.status).toBe(200);
    expect(pageQuery?.operations).toContainEqual([
      'or',
      'team_a_id.in.(10,11),team_b_id.in.(10,11)',
    ]);
    expect(pageQuery?.operations).toContainEqual(['eq', 'status', 'scheduled']);
  });

  it('rejects invalid batched team IDs', async () => {
    const response = await GET(new NextRequest(
      'http://localhost:3000/api/matches?teamIds=10,invalid&status=scheduled',
    ));

    expect(response.status).toBe(400);
    expect(mockSupabaseServer).not.toHaveBeenCalled();
  });

  it('rejects oversized page limits instead of silently truncating results', async () => {
    const response = await GET(new NextRequest('http://localhost:3000/api/matches?limit=101'));

    expect(response.status).toBe(400);
    expect(mockSupabaseServer).not.toHaveBeenCalled();
  });
});
