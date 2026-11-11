import { AsyncLocalStorage } from 'node:async_hooks';
import { NextResponse } from 'next/server';

export interface RefreshedAuthTokens {
  refreshedAccessToken?: string;
  refreshedRefreshToken?: string;
}

interface AuthTokenContext {
  refreshedTokens?: RefreshedAuthTokens;
}

const authTokenContext = new AsyncLocalStorage<AuthTokenContext>();

export function recordRefreshedAuthTokens(tokens: RefreshedAuthTokens): void {
  const context = authTokenContext.getStore();
  if (context) context.refreshedTokens = tokens;
}

export async function withAuthTokenPersistence(
  handler: () => Response | Promise<Response>,
): Promise<Response> {
  const context: AuthTokenContext = {};
  return authTokenContext.run(context, async () => {
    const response = await handler();
    return applyRefreshedTokens(response, context.refreshedTokens);
  });
}

export function applyRefreshedTokens(
  response: Response,
  auth: RefreshedAuthTokens | undefined = authTokenContext.getStore()?.refreshedTokens,
): Response {
  if (!auth?.refreshedAccessToken) return response;
  const nextResponse = response instanceof NextResponse
    ? response
    : new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
  const persistentCookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  };
  nextResponse.cookies.set('sb-auth-token', auth.refreshedAccessToken, persistentCookieOptions);
  if (auth.refreshedRefreshToken) {
    nextResponse.cookies.set('sb-refresh-token', auth.refreshedRefreshToken, persistentCookieOptions);
  }
  return nextResponse;
}
