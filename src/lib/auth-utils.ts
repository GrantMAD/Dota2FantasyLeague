/**
 * Authentication Utilities
 * 
 * Helper functions for checking authentication and authorization
 */

import { supabaseServer } from '@/lib/supabase';
import { recordRefreshedAuthTokens } from '@/lib/auth-token-context';
export { applyRefreshedTokens, withAuthTokenPersistence } from '@/lib/auth-token-context';

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

export interface VerifyAuthOptions {
  /** Load the current profile role instead of relying on the access-token claim. */
  requireFreshRole?: boolean;
}

function readCookieValue(cookies: string[], names: string[]): string | undefined {
  const cookie = cookies.find((item) => {
    const separator = item.indexOf('=');
    return separator > -1 && names.includes(item.slice(0, separator));
  });
  if (!cookie) return undefined;
  const value = cookie.slice(cookie.indexOf('=') + 1);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Verify a signed access token and read its role claim. Admin checks can request
 * a fresh profile role to avoid honoring a revoked role until token expiry.
 */
export async function verifyAuth(
  request: Request,
  options: VerifyAuthOptions = {},
): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization');
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  const cookieToken = readCookieValue(cookies, ['sb-auth-token']);
  const refreshToken = readCookieValue(cookies, ['sb-refresh-token']);

  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : cookieToken;

  if (!token && !refreshToken) {
    throw {
      status: 401,
      message: 'Missing or invalid authorization header',
    } as AuthError;
  }

  const supabase = supabaseServer();

  // Verify the signed JWT claims locally when the project uses asymmetric keys.
  // Supabase falls back to server verification for symmetric signing keys.
  const claimsResult = token ? await supabase.auth.getClaims(token) : null;
  let data = claimsResult?.data ?? null;
  let error = claimsResult?.error ?? null;

  let refreshedAccessToken: string | undefined;
  let refreshedRefreshToken: string | undefined;

  if ((!token || error || !data?.claims) && refreshToken) {
    const refreshed = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (refreshed.data.session?.access_token) {
      refreshedAccessToken = refreshed.data.session.access_token;
      refreshedRefreshToken = refreshed.data.session.refresh_token ?? undefined;
      const verified = await supabase.auth.getClaims(refreshed.data.session.access_token);
      data = verified.data;
      error = verified.error;
    } else {
      data = null;
      error = refreshed.error ?? error;
    }
  }

  const claims = data?.claims;
  if (error || !claims || typeof claims.sub !== 'string') {
    throw {
      status: 401,
      message: 'Invalid or expired token',
    } as AuthError;
  }

  if (refreshedAccessToken) {
    recordRefreshedAuthTokens({ refreshedAccessToken, refreshedRefreshToken });
  }

  const appMetadata = typeof claims.app_metadata === 'object' && claims.app_metadata !== null
    ? claims.app_metadata
    : undefined;
  let role = typeof claims.user_role === 'string'
    ? claims.user_role
    : typeof appMetadata?.role === 'string'
      ? appMetadata.role
      : undefined;

  if (options.requireFreshRole) {
    const { data: userProfile, error: profileError } = await supabase.from('users')
      .select('role')
      .eq('id', claims.sub)
      .maybeSingle();
    if (profileError) {
      throw {
        status: 500,
        message: 'Unable to verify the current user role',
      } as AuthError;
    }
    role = userProfile?.role;
  }

  return {
    userId: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : '',
    role,
    refreshedAccessToken,
    refreshedRefreshToken,
  };
}

/**
 * Check if user has admin role
 */
export async function verifyAdminAuth(request: Request): Promise<string> {
  const auth = await verifyAuth(request, { requireFreshRole: true });

  // Check if user has an administrator role from a trusted source.
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
