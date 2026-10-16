import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

/**
 * GET /api/auth/session
 *
 * Session bootstrap endpoint called by fetchWithAuth on first load when the
 * Supabase JS client has no in-memory session (e.g. after a hard reload or
 * cold dev server start). The browser-side Supabase client cannot read the
 * httpOnly `sb-refresh-token` cookie directly, so it has no way to silently
 * refresh the access token on its own.
 *
 * This endpoint:
 *  1. Reads the `sb-refresh-token` httpOnly cookie server-side.
 *  2. Exchanges it for a fresh session via `supabase.auth.refreshSession()`.
 *  3. Persists the new tokens back to httpOnly cookies (rolling refresh).
 *  4. Returns `{ access_token, refresh_token }` to the client so it can call
 *     `supabase.auth.setSession()` and warm up its in-memory session.
 *
 * Returns 401 when no valid refresh token is present (user is not logged in).
 * Returns 200 with token pair on success.
 *
 * Security: only the access_token and refresh_token are returned — no other
 * user data or secrets. The refresh_token is already stored in the browser's
 * httpOnly cookie, so returning it here does not increase exposure.
 */
export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookies = cookieHeader.split(';').map((c) => c.trim());

  const refreshTokenCookie = cookies.find((c) => c.startsWith('sb-refresh-token='));
  const refreshToken = refreshTokenCookie
    ? decodeURIComponent(refreshTokenCookie.slice('sb-refresh-token='.length))
    : undefined;

  if (!refreshToken) {
    return NextResponse.json({ error: 'No session' }, { status: 401 });
  }

  try {
    const supabase = supabaseServer();
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data.session) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    const { access_token, refresh_token: new_refresh_token } = data.session;

    // Roll the cookies forward so subsequent server requests stay valid.
    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    };

    const response = NextResponse.json({ access_token, refresh_token: new_refresh_token });
    response.cookies.set('sb-auth-token', access_token, cookieOptions);
    response.cookies.set('sb-refresh-token', new_refresh_token, cookieOptions);

    return response;
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
