import { expect, test } from '@playwright/test';
import { e2eManager, installMockSignIn } from './helpers/auth';

test.describe('manager sign-in core flow', () => {
  test('signs in and reviews the manager dashboard points and squad value', async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await installMockSignIn(page);

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
    await page.getByLabel('Email').fill(e2eManager.email);
    await page.getByRole('textbox', { name: 'Password' }).fill('E2E-only-password');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('Total Points', { exact: true })).toBeVisible();
    await expect(page.getByText('4271.05', { exact: true })).toBeVisible();
    await expect(page.getByText('43.0M', { exact: true })).toBeVisible();
    await expect(page.getByText('57.0M', { exact: true })).toBeVisible();
  });
});
