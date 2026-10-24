import { NextRequest } from 'next/server';
import { GET } from './route';

const mockVerifyAuth = jest.fn();
const mockSupabaseServer = jest.fn();
const mockGetCached = jest.fn();
const mockSetCached = jest.fn();
let mockQueries: Array<{ table: string; filters: Array<[string, unknown]> }> = [];
let mockCurrentUserEntry: Record<string, unknown> | null = null;
let mockCurrentUserId: string | null = null;

jest.mock('@/lib/auth-utils', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
}));

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

const firstEntry = {
  id: 10,
  season_id: 3,
  global_rank: 1,
  total_points: 120,
  gameweek_points_latest: 20,
  user_id: 'manager-1',
  users: {
    id: 'manager-1',
    username: 'alpha',
    display_name: 'Alpha',
    avatar_url: null,
    bio: null,
    country_code: 'US',
  },
  fantasy_squads: [{ id: 100, name: 'Alpha Squad' }],
};

const topEntry = { ...firstEntry, gameweek_points_latest: 20 };

function createQuery(table: string) {
  const filters: Array<[string, unknown]> = [];
  const query: Record<string, (...args: never[]) => unknown> = {};
  const chain = () => query;

  query.select = jest.fn(chain);
  query.order = jest.fn(chain);
  query.eq = jest.fn((column: string, value: unknown) => {
    filters.push([column, value]);
    return query;
  });
  query.in = jest.fn(chain);
  query.is = jest.fn(chain);
  query.not = jest.fn(chain);
  query.lt = jest.fn(chain);
  query.limit = jest.fn(chain);
  query.range = jest.fn(async () => ({
    data: table === 'fantasy_seasons' ? [firstEntry] : [],
    count: 60,
    error: null,
  }));
  query.maybeSingle = jest.fn(async () => {
    if (table === 'job_execution_log') {
      return { data: { completed_at: '2026-10-14T12:00:00.000Z' }, error: null };
    }
    if (table === 'fantasy_seasons') {
      const isCurrentUserQuery = filters.some(([column]) => column === 'user_id');
      return {
        data: isCurrentUserQuery ? mockCurrentUserEntry : topEntry,
        error: null,
      };
    }
    return { data: null, error: null };
  });
  query.then = (resolve: (value: unknown) => unknown) => {
    if (table === 'gameweeks') {
      return resolve({
        data: [
          { id: 9, season_id: 3, end_date: '2026-10-15', status: 'closed' },
          { id: 8, season_id: 3, end_date: '2026-10-08', status: 'closed' },
        ],
        error: null,
      });
    }
    if (table === 'season_standings') {
      return resolve({
        data: [
          { fantasy_season_id: 10, rank: 2 },
          { fantasy_season_id: 11, rank: 57 },
        ],
        error: null,
      });
    }
    return resolve({ data: [], error: null });
  };
  mockQueries.push({ table, filters });
  return query;
}

describe('GET /api/leaderboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueries = [];
    mockCurrentUserEntry = null;
    mockCurrentUserId = null;
    mockGetCached.mockReturnValue(null);
    mockVerifyAuth.mockImplementation(async () => {
      if (!mockCurrentUserId) throw { status: 401 };
      return { userId: mockCurrentUserId };
    });
    mockSupabaseServer.mockReturnValue({
      from: (table: string) => createQuery(table),
    });
  });

  it('filters by country, returns previous-gameweek rank movement, and identifies the top scorer', async () => {
    const response = await GET(new NextRequest('http://localhost/api/leaderboard?country=us'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=60, stale-while-revalidate=30');
    expect(body.leaderboard[0]).toMatchObject({
      rank: 1,
      previous_rank: 2,
      fantasy_teams: {
        name: 'Alpha Squad',
        profiles: { country: 'United States' },
      },
    });
    expect(body.topGameweekScorer).toEqual({ id: 10, manager: 'Alpha Squad', points: 20 });
    expect(mockQueries.some(({ filters }) => filters.some(([column, value]) => column === 'users.country_code' && value === 'US'))).toBe(true);
  });

  it('pins the authenticated manager when their entry is not in the current page', async () => {
    mockCurrentUserId = 'manager-2';
    mockCurrentUserEntry = {
      id: 11,
      season_id: 3,
      global_rank: 57,
      total_points: 75,
      gameweek_points_latest: 8,
      user_id: 'manager-2',
      users: {
        id: 'manager-2',
        username: 'bravo',
        display_name: 'Bravo',
        country_code: 'CA',
      },
      fantasy_squads: [{ id: 101, name: 'Bravo Squad' }],
    };

    const response = await GET(new NextRequest('http://localhost/api/leaderboard?page=1&limit=50'));
    const body = await response.json();

    expect(body.leaderboard).toHaveLength(2);
    expect(body.leaderboard[1]).toMatchObject({
      rank: 57,
      previous_rank: 57,
      is_pinned: true,
      fantasy_teams: { user_id: 'manager-2', name: 'Bravo Squad' },
    });
    expect(body.currentUserId).toBe('manager-2');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('returns only the authenticated manager position without fetching the public leaderboard payload', async () => {
    mockCurrentUserId = 'manager-2';
    mockCurrentUserEntry = {
      id: 11,
      season_id: 3,
      global_rank: 57,
      total_points: 75,
      gameweek_points_latest: 8,
      user_id: 'manager-2',
      users: { id: 'manager-2', username: 'bravo', display_name: 'Bravo', country_code: 'CA' },
      fantasy_squads: [{ id: 101, name: 'Bravo Squad' }],
    };

    const response = await GET(new NextRequest('http://localhost/api/leaderboard?currentUserOnly=true'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(body.currentUserId).toBe('manager-2');
    expect(body.currentUserEntry).toMatchObject({
      rank: 57,
      previous_rank: 57,
      fantasy_teams: { user_id: 'manager-2', name: 'Bravo Squad' },
    });
    expect(mockQueries.map(({ table }) => table)).toEqual(['fantasy_seasons', 'gameweeks', 'season_standings']);
    expect(mockGetCached).not.toHaveBeenCalled();
  });
});
