import { NextRequest } from 'next/server';
import { proxy } from './proxy';

function createMockJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.mock-signature`;
}

function createRequest(path: string, cookies?: { authToken?: string; refreshToken?: string }) {
  const cookieParts: string[] = [];
  if (cookies?.authToken !== undefined) cookieParts.push(`sb-auth-token=${cookies.authToken}`);
  if (cookies?.refreshToken !== undefined) cookieParts.push(`sb-refresh-token=${cookies.refreshToken}`);
  const headers = cookieParts.length > 0 ? { headers: { cookie: cookieParts.join('; ') } } : undefined;
  return new NextRequest(new URL(path, 'http://localhost:3000'), headers);
}

describe('proxy route protection', () => {
  it.each([
    '/dashboard',
    '/squads',
    '/lineups',
    '/leagues/42',
    '/account',
    '/transfers?player=7',
    '/analytics',
    '/friends',
    '/notifications',
    '/profile',
    '/season-recap',
    '/settings',
    '/gameweeks/planner',
    '/admin',
    '/admin/users',
  ])('redirects unauthenticated visits to protected route %s', (path) => {
    const response = proxy(createRequest(path));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/login');
  });

  it.each([
    '/players',
    '/matches',
    '/gameweeks',
    '/tournaments',
    '/leaderboard',
    '/rules',
    '/learn',
    '/help',
    '/report-issue',
    '/premium',
  ])('keeps public browsing route %s accessible without a session', (path) => {
    const response = proxy(createRequest(path));

    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('does not treat a path sharing a protected route prefix as protected', () => {
    const response = proxy(createRequest('/settings-help'));

    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('redirects authenticated users away from sign-in routes', () => {
    const token = createMockJwt({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 });
    const response = proxy(createRequest('/login', { authToken: token }));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/dashboard');
  });

  it.each([
    { authToken: 'null' },
    { authToken: 'undefined' },
    { authToken: 'not-a-jwt' },
    { refreshToken: 'null' },
    { authToken: createMockJwt({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) - 60 }) },
  ])('treats invalid or expired access-only cookies %j as unauthenticated', (cookies) => {
    const protectedResp = proxy(createRequest('/dashboard', cookies));
    expect(protectedResp.status).toBe(307);
    expect(new URL(protectedResp.headers.get('location')!).pathname).toBe('/login');

    const loginResp = proxy(createRequest('/login', cookies));
    expect(loginResp.headers.get('x-middleware-next')).toBe('1');
  });

  it('allows expired access token when a usable refresh token cookie is present', () => {
    const expiredToken = createMockJwt({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) - 60 });
    const response = proxy(createRequest('/dashboard', { authToken: expiredToken, refreshToken: 'valid-refresh' }));

    expect(response.headers.get('x-middleware-next')).toBe('1');
  });
});
