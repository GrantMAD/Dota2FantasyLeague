import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
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
    const body: unknown = await request.json();

    if (
      typeof body !== 'object' ||
      body === null ||
      !('access_token' in body) ||
      typeof body.access_token !== 'string' ||
      !body.access_token ||
      !('refresh_token' in body) ||
      typeof body.refresh_token !== 'string' ||
      !body.refresh_token
    ) {
      return NextResponse.json({ error: 'Missing tokens' }, { status: 400 });
    }

    const { data, error } = await supabaseServer().auth.getClaims(body.access_token);
    if (error || typeof data?.claims?.sub !== 'string') {
      return NextResponse.json({ error: 'Invalid access token' }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });

    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    };

    response.cookies.set('sb-auth-token', body.access_token, cookieOptions);
    response.cookies.set('sb-refresh-token', body.refresh_token, cookieOptions);

    return response;
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withApiTelemetry('POST', '/api/auth/refresh-session', postHandler);
