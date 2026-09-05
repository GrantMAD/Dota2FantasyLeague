import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for checking authentication on protected routes
 */
export function proxy(request: NextRequest) {
  // List of protected routes that require authentication
  const protectedRoutes = ['/dashboard', '/squads', '/lineups', '/leagues', '/account'];
  
  const isProtectedRoute = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );
  
  // List of auth/landing routes where an already authenticated user should be directed to the dashboard
  const authRoutes = ['/', '/login', '/signup'];
  const isAuthRoute = authRoutes.includes(request.nextUrl.pathname);

  // Check for auth token or refresh token in cookies
  const hasAuth = Boolean(
    request.cookies.get('sb-auth-token')?.value ||
    request.cookies.get('sb-refresh-token')?.value
  );

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
