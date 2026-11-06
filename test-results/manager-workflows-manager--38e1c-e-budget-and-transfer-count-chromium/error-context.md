# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: manager-workflows.spec.ts >> manager fantasy workflows >> completes a role-matched player transfer and updates the budget and transfer count
- Location: tests\e2e\manager-workflows.spec.ts:190:7

# Error details

```
Error: locator.click: Target crashed 
Call log:
  - waiting for getByRole('row').filter({ hasText: 'New Carry' }).getByTitle('Select to buy')
    - locator resolved to <button type="button" title="Select to buy" class="transfer-action-button inline-flex items-center justify-center p-2 rounded-lg font-medium text-xs transition-all shadow-sm bg-slate-700/80 hover:bg-emerald-600 text-white border border-slate-600/60">…</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - performing click action

```

# Test source

```ts
  119 |   test('assigns a starting five, sets captaincy, and saves the lineup', async ({ page }) => {
  120 |     const savedLineup: { gameweekId?: number; lineup?: unknown[] } = {};
  121 |     await installFallbackRoutes(page);
  122 |     await page.route('**/api/fantasy/context*', async (route) => {
  123 |       const requestedGameweekId = Number(new URL(route.request().url()).searchParams.get('gameweekId') || 12);
  124 |       await route.fulfill({
  125 |         status: 200,
  126 |         contentType: 'application/json',
  127 |         body: JSON.stringify(lineupContext(false, requestedGameweekId, true)),
  128 |       });
  129 |     });
  130 |     await page.route('**/api/fantasy/lineup', async (route) => {
  131 |       if (route.request().method() !== 'PUT') {
  132 |         await route.fulfill({ status: 405, body: 'Method not allowed' });
  133 |         return;
  134 |       }
  135 |       Object.assign(savedLineup, route.request().postDataJSON());
  136 |       await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  137 |     });
  138 |     await signIn(page);
  139 | 
  140 |     await page.goto('/lineups');
  141 |     await page.locator('#lineup-gameweek').selectOption('13');
  142 |     await expect(page.getByText('Planning ahead · this lineup is saved separately for Gameweek 13.')).toBeVisible();
  143 |     await page.locator('#lineup-carry').selectOption('1');
  144 |     await page.locator('#lineup-mid').selectOption('2');
  145 |     await page.locator('#lineup-offlane').selectOption('3');
  146 |     await page.locator('#lineup-support').selectOption('4');
  147 |     await page.locator('#lineup-hard_support').selectOption('5');
  148 |     await page.getByLabel('Captain · 2x points').selectOption('1');
  149 |     await page.getByLabel('Vice-Captain · backup').selectOption('2');
  150 |     await expect(page.getByLabel('Captain', { exact: true })).toBeVisible();
  151 |     await expect(page.getByLabel('Vice-captain', { exact: true })).toBeVisible();
  152 |     await page.getByRole('button', { name: 'Save Lineup' }).click();
  153 | 
  154 |     const deadlineDialog = page.getByRole('dialog', { name: 'Deadline approaching' });
  155 |     await expect(deadlineDialog).toBeVisible();
  156 |     await expect(deadlineDialog.getByText(/Deadline is in .* for Gameweek 13/)).toBeVisible();
  157 |     expect(savedLineup.gameweekId).toBeUndefined();
  158 |     await deadlineDialog.getByRole('button', { name: 'Keep Editing' }).click();
  159 |     await expect(deadlineDialog).toBeHidden();
  160 |     expect(savedLineup.gameweekId).toBeUndefined();
  161 |     await page.getByRole('button', { name: 'Save Lineup' }).click();
  162 |     await expect(deadlineDialog).toBeVisible();
  163 |     await deadlineDialog.getByRole('button', { name: 'Save Lineup' }).click();
  164 | 
  165 |     await expect(page.getByText('Lineup Saved')).toBeVisible();
  166 |     expect(savedLineup.gameweekId).toBe(13);
  167 |     expect(savedLineup.lineup).toEqual(expect.arrayContaining([
  168 |       expect.objectContaining({ playerId: 1, slot: 'carry', isCaptain: true, isViceCaptain: false }),
  169 |       expect.objectContaining({ playerId: 2, slot: 'mid', isCaptain: false, isViceCaptain: true }),
  170 |       expect.objectContaining({ playerId: 3, slot: 'offlane' }),
  171 |       expect.objectContaining({ playerId: 4, slot: 'support' }),
  172 |       expect.objectContaining({ playerId: 5, slot: 'hard_support' }),
  173 |     ]));
  174 |   });
  175 | 
  176 |   test('keeps lineup editing disabled after the gameweek deadline', async ({ page }) => {
  177 |     await installFallbackRoutes(page);
  178 |     await page.route('**/api/fantasy/context*', async (route) => {
  179 |       await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(lineupContext(true)) });
  180 |     });
  181 |     await signIn(page);
  182 | 
  183 |     await page.goto('/lineups');
  184 | 
  185 |     await expect(page.getByText('Lineup locked for Gameweek 12')).toBeVisible();
  186 |     await expect(page.getByRole('button', { name: 'Lineup Locked' })).toBeDisabled();
  187 |     await expect(page.locator('#lineup-carry')).toBeDisabled();
  188 |   });
  189 | 
  190 |   test('completes a role-matched player transfer and updates the budget and transfer count', async ({ page }) => {
  191 |     let transferRequest: { fantasySeasonId?: number; transfersIn?: number[]; transfersOut?: number[] } | null = null;
  192 |     await installFallbackRoutes(page);
  193 |     await page.route('**/api/fantasy/transfer-context', async (route) => {
  194 |       await route.fulfill({
  195 |         status: 200,
  196 |         contentType: 'application/json',
  197 |         body: JSON.stringify({ fantasySeasonId: 1, budget: 20, freeTransfers: 2, wildcardUsed: false, ownedPlayerIds: players.slice(0, 8).map((player) => player.id) }),
  198 |       });
  199 |     });
  200 |     await page.route('**/api/players?ids=1,2,3,4,5,6,7,8&show_all=true', async (route) => {
  201 |       await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: players.slice(0, 8) }) });
  202 |     });
  203 |     await page.route('**/api/players?limit=20&offset=0&sort=price&desc=true', async (route) => {
  204 |       await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: players, total: players.length }) });
  205 |     });
  206 |     await page.route('**/api/fantasy/transfer', async (route) => {
  207 |       transferRequest = route.request().postDataJSON();
  208 |       await route.fulfill({
  209 |         status: 200,
  210 |         contentType: 'application/json',
  211 |         body: JSON.stringify({ budget: 18, free_transfers_remaining: 1 }),
  212 |       });
  213 |     });
  214 |     await signIn(page);
  215 | 
  216 |     await page.goto('/transfers');
  217 |     const newCarryRow = page.getByRole('row').filter({ hasText: 'New Carry' });
  218 |     const ownedCarryRow = page.getByRole('row').filter({ hasText: 'Carry One' });
> 219 |     await newCarryRow.getByTitle('Select to buy').click();
      |                                                   ^ Error: locator.click: Target crashed 
  220 |     await ownedCarryRow.getByTitle('In your squad').click();
  221 |     await page.getByRole('button', { name: 'Confirm Transfer' }).click();
  222 | 
  223 |     await expect(page.getByText('Transfer Complete')).toBeVisible();
  224 |     await expect(page.getByText('$18.0M')).toBeVisible();
  225 |     await expect(page.getByText('Free Transfers').locator('..').getByText('1', { exact: true })).toBeVisible();
  226 |     expect(transferRequest).toEqual({ fantasySeasonId: 1, transfersIn: [9], transfersOut: [1] });
  227 |   });
  228 | });
  229 | 
```