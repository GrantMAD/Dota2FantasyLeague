/**
 * Authentication Utilities
 * 
 * Helper functions for checking authentication and authorization
 */

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export interface AuthError {
  status: number;
  message: string;
}

export interface AuthResult {
  userId: string;
  email: string;
  role?: string;
  /** If the access token was silently refreshed, this is the new access token to write back to the cookie */
  refreshedAccessToken?: string;
  /** If the access token was silently refreshed, this is the new refresh token */
  refreshedRefreshToken?: string;
}

/**
 * Check if a request has valid authentication headers
 * Returns the session if valid, or throws an error
 */
export async function verifyAuth(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization');
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  // Supabase JS v2 uses the pattern: sb-<project-ref>-auth-token
  const authCookie = cookies.find(
    (c) => c.startsWith('sb-') && c.includes('-auth-token=')
  );
  const cookieToken = authCookie
    ? authCookie.slice(authCookie.indexOf('=') + 1)
    : undefined;
  const refreshCookie = cookies.find(
    (c) => c.startsWith('sb-') && c.includes('-refresh-token=')
  );
  const refreshToken = refreshCookie
    ? refreshCookie.slice(refreshCookie.indexOf('=') + 1)
    : undefined;

  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : cookieToken;

  if (!token) {
    throw {
      status: 401,
      message: 'Missing or invalid authorization header',
    } as AuthError;
  }

  const supabase = supabaseServer();

  // Verify the access token and renew it through the persistent refresh token
  // when the short-lived access token has expired.
  let { data, error } = await supabase.auth.getUser(token);

  let refreshedAccessToken: string | undefined;
  let refreshedRefreshToken: string | undefined;

  if ((error || !data.user) && refreshToken) {
    const refreshed = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    data = { user: refreshed.data.user };
    error = refreshed.error;
    // Capture new tokens so the caller can persist them back to the browser cookie
    if (refreshed.data.session?.access_token) {
      refreshedAccessToken = refreshed.data.session.access_token;
      refreshedRefreshToken = refreshed.data.session.refresh_token ?? undefined;
    }
  }

  if (error || !data.user) {
    throw {
      status: 401,
      message: 'Invalid or expired token',
    } as AuthError;
  }

  // Query role from public.users table (fallback to metadata if user row not yet found)
  let role: string | undefined = data.user.user_metadata?.role;
  const { data: userProfile } = await (supabase.from('users') as any)
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle();

  if (userProfile?.role) {
    role = userProfile.role;
  }

  return {
    userId: data.user.id,
    email: data.user.email || '',
    role,
    refreshedAccessToken,
    refreshedRefreshToken,
  };
}

/**
 * Apply refreshed auth cookies to a NextResponse when the access token was silently renewed.
 * Call this after verifyAuth whenever the returned refreshedAccessToken is set.
 */
export function applyRefreshedTokens(response: NextResponse, auth: AuthResult): void {
  if (!auth.refreshedAccessToken) return;
  const persistentCookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  };
  response.cookies.set('sb-auth-token', auth.refreshedAccessToken, persistentCookieOptions);
  if (auth.refreshedRefreshToken) {
    response.cookies.set('sb-refresh-token', auth.refreshedRefreshToken, persistentCookieOptions);
  }
}

/**
 * Check if user has admin role
 */
export async function verifyAdminAuth(request: Request): Promise<string> {
  const auth = await verifyAuth(request);

  // Check if user has admin role (stored in user metadata)
  if (auth.role !== 'admin') {
    throw {
      status: 403,
      message: 'Admin access required. Your role: ' + (auth.role || 'user'),
    } as AuthError;
  }

  return auth.userId;
}

/**
 * Create a JSON error response
 */
export function createErrorResponse(error: AuthError | Error): Response {
  if ('status' in error) {
    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: error.status }
    );
  }

  return Response.json(
    {
      success: false,
      error: error.message,
    },
    { status: 500 }
  );
}
