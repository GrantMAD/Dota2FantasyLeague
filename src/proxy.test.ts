import { NextRequest } from 'next/server';
import { proxy } from './proxy';

function createRequest(path: string, cookie?: string) {
  const headers = cookie ? { headers: { cookie: `sb-auth-token=${cookie}` } } : undefined;
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
    const response = proxy(createRequest('/login', 'present'));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/dashboard');
  });
});
