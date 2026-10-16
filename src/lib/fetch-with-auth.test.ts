import { fetchWithAuth } from './fetch-with-auth';

const mockGetSession = jest.fn();
const mockRefreshSession = jest.fn();
const mockSetSession = jest.fn();
let currentSession: { access_token: string; refresh_token: string } | null = null;

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
      setSession: (...args: unknown[]) => mockSetSession(...args),
    },
  },
}));

describe('fetchWithAuth', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    currentSession = { access_token: 'initial-access', refresh_token: 'initial-refresh' };
    mockGetSession.mockImplementation(async () => ({ data: { session: currentSession } }));
    mockSetSession.mockImplementation(async (session: typeof currentSession) => {
      currentSession = session;
      return { data: { session }, error: null };
    });
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('attaches the bearer token from the active session', async () => {
    currentSession = { access_token: 'my-access-token', refresh_token: 'my-refresh-token' };
    mockGetSession.mockResolvedValue({ data: { session: currentSession } });
    (global.fetch as jest.Mock).mockResolvedValueOnce(new Response(null, { status: 200 }));

    const response = await fetchWithAuth('/api/test');

    expect(response.status).toBe(200);
    const calls = (global.fetch as jest.Mock).mock.calls;
    // Find the actual API call (not the /api/auth/session bootstrap)
    const apiCall = calls.find(([url]: [string]) => url === '/api/test');
    expect(apiCall).toBeDefined();
    const headers = apiCall[1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer my-access-token');
  });

  it('bootstraps via server session endpoint when no in-memory session exists', async () => {
    // No in-memory session
    currentSession = null;
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const freshSession = { access_token: 'server-fresh', refresh_token: 'server-refresh' };
    mockSetSession.mockResolvedValue({ data: { session: freshSession }, error: null });

    (global.fetch as jest.Mock)
      // /api/auth/session bootstrap succeeds
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: 'server-fresh', refresh_token: 'server-refresh' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      // Actual API call succeeds
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const response = await fetchWithAuth('/api/protected');

    expect(response.status).toBe(200);
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'server-fresh',
      refresh_token: 'server-refresh',
    });
  });

  it('retries once on 401 after refreshing the session', async () => {
    const freshSession = { access_token: 'refreshed-token', refresh_token: 'refreshed-refresh' };

    mockRefreshSession.mockResolvedValue({
      data: { session: freshSession },
      error: null,
    });
    mockSetSession.mockResolvedValue({ data: { session: freshSession }, error: null });

    (global.fetch as jest.Mock)
      // bootstrap 401 (no httpOnly cookie in test)
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      // first API attempt → 401
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      // retry after refresh → 200
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const response = await fetchWithAuth('/api/protected');

    expect(response.status).toBe(200);
  });

  it('shares a single refresh promise when concurrent requests both need a new session', async () => {
    // Simulate no in-memory session so both requests need to refresh
    currentSession = null;
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const freshSession = { access_token: 'fresh-access', refresh_token: 'fresh-refresh' };
    // bootstrap returns 401 (no server cookie in test env) → falls through to refreshSession
    // refreshSession succeeds on first call, providing the shared result
    mockRefreshSession.mockResolvedValue({ data: { session: freshSession }, error: null });
    mockSetSession.mockResolvedValue({ data: { session: freshSession }, error: null });

    (global.fetch as jest.Mock)
      // Only ONE bootstrap call happens: refreshClientSession() is deduplicated via
      // refreshSessionPromise, so bootstrapSessionFromServer() runs exactly once.
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      // Two actual API calls — succeed
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const [firstResponse, secondResponse] = await Promise.all([
      fetchWithAuth('/api/first'),
      fetchWithAuth('/api/second'),
    ]);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    // Only one Supabase refresh call should have been made (deduplication)
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
  });

});
