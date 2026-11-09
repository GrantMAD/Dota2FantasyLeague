import { NextRequest } from 'next/server';
import { GET } from './route';

interface QueryBuilder extends PromiseLike<{ data: unknown; error: null }> {
  select: () => QueryBuilder;
  eq: () => QueryBuilder;
  ilike: () => QueryBuilder;
  order: () => QueryBuilder;
  limit: () => QueryBuilder;
  neq: (column: string, value: string) => QueryBuilder;
  or: (filter: string) => QueryBuilder;
}

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

function createQuery(
  data: unknown,
  onOr?: (filter: string) => void,
  onNeq?: (column: string, value: string) => void,
) {
  const query: QueryBuilder = {
    select: jest.fn((): QueryBuilder => query),
    eq: jest.fn((): QueryBuilder => query),
    ilike: jest.fn((): QueryBuilder => query),
    order: jest.fn((): QueryBuilder => query),
    limit: jest.fn((): QueryBuilder => query),
    neq: jest.fn((column: string, value: string) => {
      onNeq?.(column, value);
      return query;
    }),
    or: jest.fn((filter: string) => {
      onOr?.(filter);
      return query;
    }),
    then: (resolve, reject) => Promise.resolve({ data, error: null }).then(resolve, reject),
  };
  return query;
}

describe('GET /api/command-search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: 'manager-1' });
  });

  it('searches players and leagues while restricting private leagues to members', async () => {
    const playerRows = [{ id: 12, name: 'Test Player', in_game_name: 'Tester' }];
    const leagueRows = [{
      id: 42,
      name: 'Test League',
      league_type: 'classic',
      privacy_level: 'private',
      current_participants: 4,
    }];
    const membershipPrivacyFilter = jest.fn();
    const mockFrom = jest.fn((table: string) => {
      if (table === 'professional_players') return createQuery(playerRows);
      if (table === 'league_participants') return createQuery([{ league_id: 42 }]);
      if (table === 'leagues') return createQuery(leagueRows, membershipPrivacyFilter);
      throw new Error(`Unexpected table: ${table}`);
    });
    mockSupabaseServer.mockReturnValue({ from: mockFrom });

    const response = await GET(new NextRequest('http://localhost:3000/api/command-search?query=Test'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ players: playerRows, leagues: leagueRows });
    expect(membershipPrivacyFilter).toHaveBeenCalledWith('privacy_level.neq.private,id.in.(42)');
  });

  it('does not query the database for searches shorter than two characters', async () => {
    mockSupabaseServer.mockReturnValue({ from: jest.fn() });

    const response = await GET(new NextRequest('http://localhost:3000/api/command-search?query=x'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ players: [], leagues: [] });
    expect(mockSupabaseServer).not.toHaveBeenCalled();
  });

  it('excludes private leagues from results when the user has no memberships', async () => {
    const privacyFilter = jest.fn();
    const mockFrom = jest.fn((table: string) => {
      if (table === 'professional_players') return createQuery([]);
      if (table === 'league_participants') return createQuery([]);
      if (table === 'leagues') return createQuery([], undefined, privacyFilter);
      throw new Error(`Unexpected table: ${table}`);
    });
    mockSupabaseServer.mockReturnValue({ from: mockFrom });

    const response = await GET(new NextRequest('http://localhost:3000/api/command-search?query=Test'));

    expect(response.status).toBe(200);
    expect(privacyFilter).toHaveBeenCalledWith('privacy_level', 'private');
    expect(mockFrom).toHaveBeenCalledWith('leagues');
  });
});
