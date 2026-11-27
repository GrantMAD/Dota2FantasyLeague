import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_ROUTES = [
  '/dashboard',
  '/squads',
  '/lineups',
  '/leagues',
  '/account',
  '/transfers',
  '/analytics',
  '/friends',
  '/notifications',
  '/profile',
  '/season-recap',
  '/settings',
  '/gameweeks/planner',
  '/admin',
];

const AUTH_ROUTES = ['/', '/login', '/signup'];

function isNonSentinelCookieValue(value: string | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed !== 'null' && trimmed !== 'undefined';
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const json = atob(padded);
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function hasUsableAccessToken(value: string | undefined): boolean {
  if (!isNonSentinelCookieValue(value)) return false;
  const payload = decodeJwtPayload(value.trim());
  if (!payload || typeof payload.sub !== 'string' || payload.sub.length === 0) {
    return false;
  }
  if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
    return false;
  }
  return true;
}

/**
 * Middleware for checking authentication on protected routes
 */
export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // List of auth/landing routes where an already authenticated user should be directed to the dashboard
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  // Check for a usable access JWT or non-empty refresh token in cookies.
  // Full signature/session verification still runs server-side in verifyAuth().
  const authToken = request.cookies.get('sb-auth-token')?.value;
  const refreshToken = request.cookies.get('sb-refresh-token')?.value;
  const hasAuth = hasUsableAccessToken(authToken) || isNonSentinelCookieValue(refreshToken);

  if (isAuthRoute && hasAuth) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (isProtectedRoute) {
    if (!hasAuth) {
      // Redirect to login
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
