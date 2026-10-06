import { expect, test } from '@playwright/test';

const manager = {
  id: 'e2e-manager',
  email: 'e2e-manager@example.test',
};

test.describe('manager sign-in core flow', () => {
  test('signs in and reviews the manager dashboard points and squad value', async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.route('**/api/auth/signin', async (route) => {
      const requestBody = route.request().postDataJSON() as { email?: string; password?: string };
      expect(requestBody.email).toBe(manager.email);
      expect(requestBody.password).toBe('E2E-only-password');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'set-cookie': 'sb-auth-token=e2e-mock-token; Path=/; HttpOnly; SameSite=Lax' },
        body: JSON.stringify({
          message: 'Signed in successfully',
          user: manager,
          session: null,
        }),
      });
    });

    await page.route('**/api/dashboard/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          fantasySeasonId: 1,
          activeSquadCount: 1,
          squadValue: 43,
          bankBalance: 57,
          totalPoints: 4271.05,
          globalRank: 1,
          freeTransfers: 2,
          gameweek: { gameweek_number: 2, deadline: '2026-10-06T12:00:00Z', status: 'active' },
          captain: null,
          viceCaptain: null,
          starters: [],
          leagueStandings: [],
        }),
      });
    });

    await page.route('**/api/dashboard/whats-new', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ events: [], gameweek: null, updates: [] }),
      });
    });

    await page.goto('/login');
    await page.getByLabel('Email').fill(manager.email);
    await page.getByRole('textbox', { name: 'Password' }).fill('E2E-only-password');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('Total Points', { exact: true })).toBeVisible();
    await expect(page.getByText('4271.05', { exact: true })).toBeVisible();
    await expect(page.getByText('43.0M', { exact: true })).toBeVisible();
    await expect(page.getByText('57.0M', { exact: true })).toBeVisible();
  });
});
