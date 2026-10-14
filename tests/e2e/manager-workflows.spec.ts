import { expect, type Page, test } from '@playwright/test';

const manager = {
  id: 'e2e-manager',
  email: 'e2e-manager@example.test',
};

type Player = {
  id: number;
  name: string;
  in_game_name: string;
  primary_role: string;
  current_price: number;
  recent_points: number;
  gameweek_points: number;
  profile_image_url: null;
  professional_teams: { name: string };
};

const players: Player[] = [
  { id: 1, name: 'Carry One', in_game_name: 'Carry One', primary_role: 'Carry', current_price: 10, recent_points: 20, gameweek_points: 12, profile_image_url: null, professional_teams: { name: 'Team A' } },
  { id: 2, name: 'Mid One', in_game_name: 'Mid One', primary_role: 'Mid', current_price: 9, recent_points: 18, gameweek_points: 11, profile_image_url: null, professional_teams: { name: 'Team B' } },
  { id: 3, name: 'Offlane One', in_game_name: 'Offlane One', primary_role: 'Offlane', current_price: 8, recent_points: 16, gameweek_points: 10, profile_image_url: null, professional_teams: { name: 'Team C' } },
  { id: 4, name: 'Support One', in_game_name: 'Support One', primary_role: 'Support', current_price: 7, recent_points: 15, gameweek_points: 9, profile_image_url: null, professional_teams: { name: 'Team D' } },
  { id: 5, name: 'Hard Support One', in_game_name: 'Hard Support One', primary_role: 'Hard Support', current_price: 6, recent_points: 14, gameweek_points: 8, profile_image_url: null, professional_teams: { name: 'Team E' } },
  { id: 6, name: 'Carry Two', in_game_name: 'Carry Two', primary_role: 'Carry', current_price: 5, recent_points: 13, gameweek_points: 7, profile_image_url: null, professional_teams: { name: 'Team F' } },
  { id: 7, name: 'Mid Two', in_game_name: 'Mid Two', primary_role: 'Mid', current_price: 4, recent_points: 12, gameweek_points: 6, profile_image_url: null, professional_teams: { name: 'Team G' } },
  { id: 8, name: 'Offlane Two', in_game_name: 'Offlane Two', primary_role: 'Offlane', current_price: 3, recent_points: 11, gameweek_points: 5, profile_image_url: null, professional_teams: { name: 'Team H' } },
  { id: 9, name: 'New Carry', in_game_name: 'New Carry', primary_role: 'Carry', current_price: 12, recent_points: 25, gameweek_points: 15, profile_image_url: null, professional_teams: { name: 'Team I' } },
];

async function installFallbackRoutes(page: Page) {
  await page.route('**/api/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
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
        totalPoints: 0,
        globalRank: 1,
        freeTransfers: 2,
        gameweek: null,
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
}

async function signIn(page: Page) {
  await page.route('**/api/auth/signin', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'set-cookie': 'sb-auth-token=e2e-mock-token; Path=/; HttpOnly; SameSite=Lax' },
      body: JSON.stringify({ message: 'Signed in successfully', user: manager, session: null }),
    });
  });

  await page.goto('/login');
  await page.getByLabel('Email').fill(manager.email);
  await page.getByRole('textbox', { name: 'Password' }).fill('E2E-only-password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

function lineupContext(isLocked = false, targetGameweekId = 12, withinTwoHours = false) {
  const isPlanningAhead = targetGameweekId === 13;
  const activeDeadline = isLocked
    ? '2026-10-01T12:00:00.000Z'
    : targetGameweekId === 12 && withinTwoHours
      ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
      : '2026-11-01T12:00:00.000Z';
  const upcomingDeadline = targetGameweekId === 13 && withinTwoHours
    ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
    : '2026-11-08T12:00:00.000Z';
  return {
    fantasySeasonId: 1,
    gameweek: {
      id: targetGameweekId,
      gameweekNumber: targetGameweekId,
      status: isPlanningAhead ? 'upcoming' : 'active',
      deadline: isPlanningAhead ? upcomingDeadline : activeDeadline,
      isLocked,
      hasUpcoming: true,
    },
    defaultGameweekId: 12,
    availableGameweeks: [
      { id: 12, gameweekNumber: 12, status: 'active', deadline: activeDeadline, isLocked },
      { id: 13, gameweekNumber: 13, status: 'upcoming', deadline: upcomingDeadline, isLocked: false },
    ],
    lineup: [],
    ownedPlayers: players.slice(0, 8),
    chips: {
      tripleCaptainUsed: false,
      tripleCaptainGameweekId: null,
      benchBoostUsed: false,
      benchBoostGameweekId: null,
    },
  };
}

test.describe('manager fantasy workflows', () => {
  test('assigns a starting five, sets captaincy, and saves the lineup', async ({ page }) => {
    const savedLineup: { gameweekId?: number; lineup?: unknown[] } = {};
    await installFallbackRoutes(page);
    await page.route('**/api/fantasy/context*', async (route) => {
      const requestedGameweekId = Number(new URL(route.request().url()).searchParams.get('gameweekId') || 12);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(lineupContext(false, requestedGameweekId, true)),
      });
    });
    await page.route('**/api/fantasy/lineup', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.fulfill({ status: 405, body: 'Method not allowed' });
        return;
      }
      Object.assign(savedLineup, route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
    await signIn(page);

    await page.goto('/lineups');
    await page.locator('#lineup-gameweek').selectOption('13');
    await expect(page.getByText('Planning ahead · this lineup is saved separately for Gameweek 13.')).toBeVisible();
    await page.locator('#lineup-carry').selectOption('1');
    await page.locator('#lineup-mid').selectOption('2');
    await page.locator('#lineup-offlane').selectOption('3');
    await page.locator('#lineup-support').selectOption('4');
    await page.locator('#lineup-hard_support').selectOption('5');
    await page.getByLabel('Captain · 2x points').selectOption('1');
    await page.getByLabel('Vice-Captain · backup').selectOption('2');
    await expect(page.getByLabel('Captain', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Vice-captain', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Save Lineup' }).click();

    const deadlineDialog = page.getByRole('dialog', { name: 'Deadline approaching' });
    await expect(deadlineDialog).toBeVisible();
    await expect(deadlineDialog.getByText(/Deadline is in .* for Gameweek 13/)).toBeVisible();
    expect(savedLineup.gameweekId).toBeUndefined();
    await deadlineDialog.getByRole('button', { name: 'Keep Editing' }).click();
    await expect(deadlineDialog).toBeHidden();
    expect(savedLineup.gameweekId).toBeUndefined();
    await page.getByRole('button', { name: 'Save Lineup' }).click();
    await expect(deadlineDialog).toBeVisible();
    await deadlineDialog.getByRole('button', { name: 'Save Lineup' }).click();

    await expect(page.getByText('Lineup Saved')).toBeVisible();
    expect(savedLineup.gameweekId).toBe(13);
    expect(savedLineup.lineup).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerId: 1, slot: 'carry', isCaptain: true, isViceCaptain: false }),
      expect.objectContaining({ playerId: 2, slot: 'mid', isCaptain: false, isViceCaptain: true }),
      expect.objectContaining({ playerId: 3, slot: 'offlane' }),
      expect.objectContaining({ playerId: 4, slot: 'support' }),
      expect.objectContaining({ playerId: 5, slot: 'hard_support' }),
    ]));
  });

  test('keeps lineup editing disabled after the gameweek deadline', async ({ page }) => {
    await installFallbackRoutes(page);
    await page.route('**/api/fantasy/context*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(lineupContext(true)) });
    });
    await signIn(page);

    await page.goto('/lineups');

    await expect(page.getByText('Lineup locked for Gameweek 12')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lineup Locked' })).toBeDisabled();
    await expect(page.locator('#lineup-carry')).toBeDisabled();
  });

  test('completes a role-matched player transfer and updates the budget and transfer count', async ({ page }) => {
    let transferRequest: { fantasySeasonId?: number; transfersIn?: number[]; transfersOut?: number[] } | null = null;
    await installFallbackRoutes(page);
    await page.route('**/api/fantasy/transfer-context', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ fantasySeasonId: 1, budget: 20, freeTransfers: 2, wildcardUsed: false, ownedPlayerIds: players.slice(0, 8).map((player) => player.id) }),
      });
    });
    await page.route('**/api/players?ids=1,2,3,4,5,6,7,8&show_all=true', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: players.slice(0, 8) }) });
    });
    await page.route('**/api/players?limit=20&offset=0&sort=price&desc=true', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: players, total: players.length }) });
    });
    await page.route('**/api/fantasy/transfer', async (route) => {
      transferRequest = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ budget: 18, free_transfers_remaining: 1 }),
      });
    });
    await signIn(page);

    await page.goto('/transfers');
    const newCarryRow = page.getByRole('row').filter({ hasText: 'New Carry' });
    const ownedCarryRow = page.getByRole('row').filter({ hasText: 'Carry One' });
    await newCarryRow.getByTitle('Select to buy').click();
    await ownedCarryRow.getByTitle('In your squad').click();
    await page.getByRole('button', { name: 'Confirm Transfer' }).click();

    await expect(page.getByText('Transfer Complete')).toBeVisible();
    await expect(page.getByText('$18.0M')).toBeVisible();
    await expect(page.getByText('Free Transfers').locator('..').getByText('1', { exact: true })).toBeVisible();
    expect(transferRequest).toEqual({ fantasySeasonId: 1, transfersIn: [9], transfersOut: [1] });
  });
});
