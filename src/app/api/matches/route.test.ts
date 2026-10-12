import { NextRequest } from 'next/server';
import { GET } from './route';
import { getTeamDisplayTag } from '@/lib/team-tag';

const mockSupabaseServer = jest.fn();
const mockGetCached = jest.fn();
const mockSetCached = jest.fn();

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
              result = {
                data: [{ ...matchRecord, status: liveFilter ? 'in_progress' : matchRecord.status }],
                count: 42,
                error: null,
              };
            }
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
    mockGetCached.mockReset().mockReturnValue(null);
    mockSetCached.mockReset();
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
    expect(body.matches[0].radiant_team.tag).toBe('TL');
    expect(body.matches[0].dire_team.tag).toBe('TS');
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

  it('rejects oversized page limits instead of silently truncating results', async () => {
    const response = await GET(new NextRequest('http://localhost:3000/api/matches?limit=101'));

    expect(response.status).toBe(400);
    expect(mockSupabaseServer).not.toHaveBeenCalled();
  });
});
