import { getInitialMatchesData } from './matches-initial-data';

const mockSupabaseServer = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

function createQuery(table: string) {
  let selected = '';
  let options: { head?: boolean } | undefined;
  const operations: unknown[][] = [];
  const query: Record<string, (...args: unknown[]) => unknown> = {};
  const chain = (method: string) => (...args: unknown[]) => {
    operations.push([method, ...args]);
    return query;
  };

  query.select = (...args: unknown[]) => {
    selected = String(args[0] ?? '');
    options = args[1] as { head?: boolean } | undefined;
    return query;
  };
  for (const method of ['eq', 'in', 'order', 'range', 'limit']) {
    query[method] = chain(method);
  }
  query.maybeSingle = jest.fn(async () => ({ data: { id: 8 }, error: null }));
  query.then = ((resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
    let result: { data: unknown[] | null; count?: number | null; error: null };
    if (table === 'matches') {
      result = options?.head
        ? { data: null, count: 1, error: null }
        : {
            data: (() => {
              const match = {
                id: 101,
                status: 'completed',
                scheduled_time: '2026-11-01T12:00:00Z',
                duration_minutes: 40,
                gameweek_id: 8,
                series_id: 3,
                match_number: 1,
                team_a_id: 10,
                team_b_id: 11,
                winner_team_id: 10,
              };
              const isSiblingQuery = operations.some(([method, column]) => method === 'in' && column === 'series_id')
                && !operations.some(([method]) => method === 'range');
              return isSiblingQuery
                ? [
                    match,
                    { ...match, id: 102, team_a_id: 12, team_b_id: 13 },
                    { ...match, id: 103, gameweek_id: 9 },
                  ]
                : [match];
            })(),
            count: 1,
            error: null,
          };
    } else if (table === 'match_player_stats') {
      result = { data: [{ match_id: 101, player_id: 501 }], error: null };
    } else if (table === 'professional_teams') {
      result = {
        data: [
          { id: 10, name: 'Team A', slug: 'team-a', logo_url: null, region: null },
          { id: 11, name: 'Team B', slug: 'team-b', logo_url: null, region: null },
        ],
        error: null,
      };
    } else if (table === 'tournament_series') {
      result = { data: [{ id: 3, tournament_id: 4, best_of: 3, series_number: 1 }], error: null };
    } else if (table === 'tournaments' && selected === 'id, name') {
      result = { data: [{ id: 4, name: 'Tournament' }], error: null };
    } else if (table === 'tournaments') {
      result = { data: [{ id: 4, name: 'Tournament', slug: 'tournament', tier: 'Tier 1' }], error: null };
    } else {
      result = { data: [], error: null };
    }
    return Promise.resolve(result).then(resolve, reject);
  }) as (...args: unknown[]) => unknown;
  return query;
}

describe('getInitialMatchesData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseServer.mockReturnValue({ from: (table: string) => createQuery(table) });
  });

  it('includes actual player participation in initial match data', async () => {
    const data = await getInitialMatchesData();

    expect(data.matches[0].player_ids).toEqual([501]);
    expect(data.matches[0].series_matches?.map((match) => match.id)).toEqual([101]);
    expect(data.matches[0].match_number).toBe(1);
  });
});
