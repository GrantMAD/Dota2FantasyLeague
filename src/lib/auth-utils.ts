/**
 * Authentication Utilities
 * 
 * Helper functions for checking authentication and authorization
 */

import { supabaseServer } from '@/lib/supabase';

export interface AuthError {
  status: number;
  message: string;
}

/**
 * Check if a request has valid authentication headers
 * Returns the session if valid, or throws an error
 */
export async function verifyAuth(request: Request): Promise<{
  userId: string;
  email: string;
  role?: string;
}> {
  const authHeader = request.headers.get('authorization');
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookieToken = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('sb-auth-token='))
    ?.slice('sb-auth-token='.length);
  const refreshToken = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('sb-refresh-token='))
    ?.slice('sb-refresh-token='.length);

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

  if ((error || !data.user) && refreshToken) {
    const refreshed = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    data = { user: refreshed.data.user };
    error = refreshed.error;
  }

  if (error || !data.user) {
    throw {
      status: 401,
      message: 'Invalid or expired token',
    } as AuthError;
  }

  return {
    userId: data.user.id,
    email: data.user.email || '',
    role: data.user.user_metadata?.role,
  };
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
