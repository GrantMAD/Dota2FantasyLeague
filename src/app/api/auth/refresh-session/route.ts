import { NextRequest, NextResponse } from 'next/server';
import { withApiTelemetry } from '@/lib/api-telemetry';


/**
 * POST /api/auth/refresh-session
 *
 * Called by the client-side SessionProvider whenever Supabase JS auto-refreshes
 * the access token (TOKEN_REFRESHED event). Writes the new tokens back to the
 * server-side httpOnly cookies so middleware and server-rendered pages stay in sync.
 *
 * Body: { access_token: string, refresh_token: string }
 */
async function postHandler(request: NextRequest) {
  try {
    const { access_token, refresh_token } = await request.json();

    if (!access_token || !refresh_token) {
      return NextResponse.json({ error: 'Missing tokens' }, { status: 400 });
    }

    const response = NextResponse.json({ ok: true });

    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    };

    response.cookies.set('sb-auth-token', access_token, cookieOptions);
    response.cookies.set('sb-refresh-token', refresh_token, cookieOptions);

    return response;
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withApiTelemetry('POST', '/api/auth/refresh-session', postHandler);
