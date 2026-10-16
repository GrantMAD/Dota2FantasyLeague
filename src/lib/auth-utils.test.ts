import { NextResponse } from 'next/server';
import { applyRefreshedTokens, verifyAuth } from './auth-utils';

const mockSupabaseServer = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

describe('auth-utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function setupAuth({
    initialUser,
    refreshedUser,
    refreshSession,
  }: {
    initialUser: unknown;
    refreshedUser?: unknown;
    refreshSession?: unknown;
  }) {
    const getUser = jest.fn()
      .mockResolvedValueOnce({ data: { user: initialUser }, error: initialUser ? null : { message: 'expired' } });
    if (refreshSession) {
      getUser.mockResolvedValueOnce({ data: { user: refreshedUser }, error: null });
    }
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { role: 'manager' }, error: null }),
    };
    const supabase = {
      auth: {
        getUser,
        refreshSession: jest.fn().mockResolvedValue(refreshSession ?? { data: null, error: { message: 'unused' } }),
      },
      from: jest.fn(() => query),
    };
    mockSupabaseServer.mockReturnValue(supabase);
    return { supabase, query };
  }

  it('refreshes expired bearer tokens using the custom refresh cookie created at sign-in', async () => {
    const user = { id: 'manager-1', email: 'manager@example.test', app_metadata: {} };
    const { supabase } = setupAuth({
      initialUser: null,
      refreshedUser: user,
      refreshSession: {
        data: {
          user,
          session: { access_token: 'fresh-access', refresh_token: 'fresh-refresh' },
        },
        error: null,
      },
    });

    const result = await verifyAuth(new Request('http://localhost/api/test', {
      headers: {
        Authorization: 'Bearer stale-access',
        Cookie: 'sb-auth-token=stale-access; sb-refresh-token=refresh-cookie-token',
      },
    }));

    expect(supabase.auth.refreshSession).toHaveBeenCalledWith({ refresh_token: 'refresh-cookie-token' });
    expect(result).toMatchObject({
      userId: 'manager-1',
      refreshedAccessToken: 'fresh-access',
      refreshedRefreshToken: 'fresh-refresh',
    });
  });

  it('reads the custom access cookie when no bearer token is provided', async () => {
    const user = { id: 'manager-2', email: 'other@example.test', app_metadata: {} };
    const { supabase } = setupAuth({ initialUser: user });

    const result = await verifyAuth(new Request('http://localhost/api/test', {
      headers: { Cookie: 'sb-auth-token=cookie-access-token' },
    }));

    expect(supabase.auth.getUser).toHaveBeenCalledWith('cookie-access-token');
    expect(result.userId).toBe('manager-2');
  });

  it('writes the refreshed access and refresh tokens back to the cookies used at sign-in', async () => {
    const response = NextResponse.json({});

    applyRefreshedTokens(response, {
      userId: 'manager-1',
      email: 'manager@example.test',
      refreshedAccessToken: 'fresh-access',
      refreshedRefreshToken: 'fresh-refresh',
    });

    expect(response.cookies.get('sb-auth-token')?.value).toBe('fresh-access');
    expect(response.cookies.get('sb-refresh-token')?.value).toBe('fresh-refresh');
  });
});
