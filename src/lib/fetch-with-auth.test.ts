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
    currentSession = { access_token: 'stale-access', refresh_token: 'stale-refresh' };
    mockGetSession.mockImplementation(async () => ({ data: { session: currentSession } }));
    mockSetSession.mockImplementation(async (session: typeof currentSession) => {
      currentSession = session;
      return { error: null };
    });
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('shares a single refresh when concurrent requests receive 401 responses', async () => {
    let resolveRefresh!: (value: unknown) => void;
    mockRefreshSession.mockImplementation(() => new Promise((resolve) => {
      resolveRefresh = resolve;
    }));
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const firstRequest = fetchWithAuth('/api/first');
    const secondRequest = fetchWithAuth('/api/second');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    resolveRefresh({
      data: {
        session: { access_token: 'fresh-access', refresh_token: 'fresh-refresh' },
      },
      error: null,
    });

    const [firstResponse, secondResponse] = await Promise.all([firstRequest, secondRequest]);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(mockSetSession).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });
});
