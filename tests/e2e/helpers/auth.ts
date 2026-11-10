import { expect, type Page } from '@playwright/test';

export const e2eManager = {
  id: 'e2e-manager',
  email: 'e2e-manager@example.test',
};

const password = 'E2E-only-password';

export async function installMockSignIn(page: Page) {
  const now = Math.floor(Date.now() / 1000);
  const accessToken = [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({
      sub: e2eManager.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: e2eManager.email,
      iat: now,
      exp: now + 60 * 60,
    })).toString('base64url'),
    'e2e-test-signature',
  ].join('.');
  const refreshToken = 'e2e-test-refresh-token';
  const session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'bearer',
    expires_in: 60 * 60,
    expires_at: now + 60 * 60,
    user: e2eManager,
  };

  await page.route(/\/auth\/v1\/user(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...e2eManager,
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: {},
        created_at: new Date(now * 1000).toISOString(),
      }),
    });
  });

  await page.route('**/api/auth/signin', async (route) => {
    const requestBody = route.request().postDataJSON() as { email?: string; password?: string };
    expect(requestBody).toEqual({ email: e2eManager.email, password });

    await page.context().addCookies([
      {
        name: 'sb-auth-token',
        value: accessToken,
        url: new URL(route.request().url()).origin,
        httpOnly: true,
        sameSite: 'Lax',
      },
      {
        name: 'sb-refresh-token',
        value: refreshToken,
        url: new URL(route.request().url()).origin,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Signed in successfully',
        user: e2eManager,
        session,
      }),
    });
  });
}
