import { NextResponse } from 'next/server';
import {
  applyRefreshedTokens,
  verifyAdminAuth,
  verifyAuth,
} from './auth-utils';
import { withAuthTokenPersistence } from './auth-token-context';

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
    const makeClaims = (user: unknown) => {
      if (!user || typeof user !== 'object') return { data: null, error: { message: 'expired' } };
      const authUser = user as { id: string; email: string; app_metadata?: Record<string, unknown> };
      return {
        data: {
          claims: {
            sub: authUser.id,
            email: authUser.email,
            user_role: 'manager',
            app_metadata: authUser.app_metadata ?? {},
          },
        },
        error: null,
      };
    };
    const getClaims = jest.fn().mockResolvedValueOnce(makeClaims(initialUser));
    if (refreshSession) getClaims.mockResolvedValueOnce(makeClaims(refreshedUser));
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { role: 'manager' }, error: null }),
    };
    const supabase = {
      auth: {
        getClaims,
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
    expect(supabase.auth.getClaims).toHaveBeenNthCalledWith(2, 'fresh-access');
    expect(result).toMatchObject({
      userId: 'manager-1',
      role: 'manager',
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

    expect(supabase.auth.getClaims).toHaveBeenCalledWith('cookie-access-token');
    expect(result.userId).toBe('manager-2');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('refreshes a session when only the refresh cookie is present', async () => {
    const user = { id: 'manager-3', email: 'cookie@example.test', app_metadata: {} };
    const { supabase } = setupAuth({ initialUser: user });
    supabase.auth.getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: user.id,
          email: user.email,
          user_role: 'manager',
          app_metadata: {},
        },
      },
      error: null,
    });
    supabase.auth.refreshSession.mockResolvedValue({
      data: {
        user,
        session: { access_token: 'fresh-cookie-access', refresh_token: 'fresh-cookie-refresh' },
      },
      error: null,
    } as never);

    const result = await verifyAuth(new Request('http://localhost/api/test', {
      headers: { Cookie: 'sb-refresh-token=refresh-cookie-token' },
    }));

    expect(supabase.auth.getClaims).toHaveBeenCalledWith('fresh-cookie-access');
    expect(supabase.auth.refreshSession).toHaveBeenCalledWith({ refresh_token: 'refresh-cookie-token' });
    expect(result.userId).toBe(user.id);
  });

  it('uses the current profile role when a fresh role is required', async () => {
    const user = { id: 'admin-1', email: 'admin@example.test', app_metadata: {} };
    const { supabase } = setupAuth({ initialUser: user });

    const result = await verifyAuth(
      new Request('http://localhost/api/admin/test', {
        headers: { Authorization: 'Bearer access-token' },
      }),
      { requireFreshRole: true },
    );

    expect(supabase.from).toHaveBeenCalledWith('users');
    expect(result.role).toBe('manager');
  });

  it('rejects a stale admin claim when the current profile role is no longer admin', async () => {
    const user = { id: 'admin-1', email: 'admin@example.test', app_metadata: {} };
    const { supabase } = setupAuth({ initialUser: user });
    supabase.auth.getClaims.mockReset().mockResolvedValueOnce({
      data: {
        claims: {
          sub: user.id,
          email: user.email,
          user_role: 'admin',
          app_metadata: {},
        },
      },
      error: null,
    });

    await expect(verifyAdminAuth(new Request('http://localhost/api/admin/test', {
      headers: { Authorization: 'Bearer access-token' },
    }))).rejects.toMatchObject({ status: 403 });
  });

  it('fails explicitly when the current profile role cannot be verified', async () => {
    const user = { id: 'admin-1', email: 'admin@example.test', app_metadata: {} };
    const { query } = setupAuth({ initialUser: user });
    query.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'database unavailable' },
    });

    await expect(verifyAuth(
      new Request('http://localhost/api/admin/test', {
        headers: { Authorization: 'Bearer access-token' },
      }),
      { requireFreshRole: true },
    )).rejects.toMatchObject({ status: 500 });
  });

  it('does not grant admin access when the current profile is missing', async () => {
    const user = { id: 'admin-1', email: 'admin@example.test', app_metadata: { role: 'admin' } };
    const { supabase, query } = setupAuth({ initialUser: user });
    supabase.auth.getClaims.mockReset().mockResolvedValueOnce({
      data: {
        claims: {
          sub: user.id,
          email: user.email,
          user_role: 'admin',
          app_metadata: user.app_metadata,
        },
      },
      error: null,
    });
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(verifyAdminAuth(new Request('http://localhost/api/admin/test', {
      headers: { Authorization: 'Bearer access-token' },
    }))).rejects.toMatchObject({ status: 403 });
  });

  it('writes the refreshed access and refresh tokens back to the cookies used at sign-in', async () => {
    const response = NextResponse.json({});

    applyRefreshedTokens(response, {
      refreshedAccessToken: 'fresh-access',
      refreshedRefreshToken: 'fresh-refresh',
    });

    expect(response.cookies.get('sb-auth-token')?.value).toBe('fresh-access');
    expect(response.cookies.get('sb-refresh-token')?.value).toBe('fresh-refresh');
  });

  it('automatically persists refreshed cookies on handler error responses', async () => {
    const user = { id: 'manager-4', email: 'manager@example.test', app_metadata: {} };
    setupAuth({
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

    const response = await withAuthTokenPersistence(async () => {
      await verifyAuth(new Request('http://localhost/api/test', {
        headers: {
          Authorization: 'Bearer stale-access',
          Cookie: 'sb-refresh-token=refresh-cookie-token',
        },
      }));
      return NextResponse.json({ error: 'downstream failure' }, { status: 500 });
    });

    expect(response.status).toBe(500);
    expect(response.headers.get('set-cookie')).toContain('sb-auth-token=fresh-access');
    expect(response.headers.get('set-cookie')).toContain('sb-refresh-token=fresh-refresh');
  });

  it('retains refreshed cookies when the route returns a plain Response', async () => {
    const user = { id: 'manager-5', email: 'manager@example.test', app_metadata: {} };
    setupAuth({
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

    const response = await withAuthTokenPersistence(async () => {
      await verifyAuth(new Request('http://localhost/api/test', {
        headers: {
          Authorization: 'Bearer stale-access',
          Cookie: 'sb-refresh-token=refresh-cookie-token',
        },
      }));
      return Response.json({ error: 'forbidden' }, { status: 403 });
    });

    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie')).toContain('sb-auth-token=fresh-access');
    expect(response.headers.get('set-cookie')).toContain('sb-refresh-token=fresh-refresh');
  });
});
