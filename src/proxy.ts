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
  
  if (isProtectedRoute) {
    // Check for auth token in cookies
    const authToken = request.cookies.get('sb-auth-token')?.value;
    
    if (!authToken) {
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
