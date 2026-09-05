import { expect, test, type Page } from '@playwright/test';

async function openLevel(page: Page, levelId: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await page.getByTestId('home-lessons-card').click();
  await expect(page.getByTestId('level-select')).toBeVisible();
  await page.getByTestId(`level-card-${levelId}`).click();
  await expect(page.getByTestId('level-hud')).toBeVisible();
}

async function connectHandles(
  page: Page,
  fromNode: string,
  fromType: string,
  fromHandle: string,
  toNode: string,
  toType: string,
  toHandle: string,
) {
  const from = page.locator(`[data-node-id="${fromNode}"][data-node-type="${fromType}"]`);
  const to = page.locator(`[data-node-id="${toNode}"][data-node-type="${toType}"]`);
  await from
    .locator(`.react-flow__handle[data-handleid="${fromHandle}"]`)
    .dragTo(to.locator(`.react-flow__handle[data-handleid="${toHandle}"]`));
}

/** Seed progress with 3-star completions for the given level ids. */
async function seedStars(page: Page, levelIds: string[]): Promise<void> {
  await page.addInitScript(({ ids, key }) => {
    const levels: Record<string, { stars: number; hintsUsed: number }> = {};
    for (const id of ids) levels[id] = { stars: 3, hintsUsed: 0 };
    localStorage.setItem(key, JSON.stringify({ mode: 'lessons', levels, badges: [] }));
  }, { ids: levelIds, key: 'zcircuit.progress' });
}

test('level intro card briefs the mission and does not return on restart', async ({ page }) => {
  await openLevel(page, 'first-circuit.1');

  // The brief shows the story, every objective and the hint offer.
  await expect(page.getByTestId('level-intro-modal')).toBeVisible();
  await expect(page.getByTestId('intro-title')).toHaveText('Make it glow');
  await expect(page.getByTestId('intro-story')).toContainText('Wire them so the lamp lights up');
  await expect(page.getByTestId('intro-objective-0')).toBeVisible();
  await expect(page.getByTestId('intro-objective-1')).toBeVisible();
  await expect(page.getByTestId('level-intro-modal')).toContainText('2 hints available');

  // Start dismisses it; restarting keeps it dismissed (no re-brief on retry).
  await page.getByTestId('intro-start-btn').click();
  await expect(page.getByTestId('level-intro-modal')).not.toBeVisible();
  await page.getByTestId('level-restart-btn').click();
  await expect(page.getByTestId('level-intro-modal')).not.toBeVisible();
});

test('keyboard shortcuts: hint, undo/redo, restart and escape', async ({ page }) => {
  await openLevel(page, 'first-circuit.1');
  await page.getByTestId('intro-start-btn').click();

  // h reveals a hint (capping stars) - visible in the HUD chip.
  await page.keyboard.press('h');
  await expect(page.getByTestId('level-hint-count')).toHaveText(/1/);

  // Wire one conductor, then u undoes it and y redoes it.
  await connectHandles(page, 'sb', 'switchboard', 'way-1-l::src', 'lamp', 'bulb', 'l-in::src');
  await expect(page.getByTestId('wire-edge')).toHaveCount(1);
  await page.keyboard.press('u');
  await expect(page.getByTestId('wire-edge')).toHaveCount(0);
  await page.keyboard.press('y');
  await expect(page.getByTestId('wire-edge')).toHaveCount(1);

  // r restarts from the starter (clears the wire); Escape exits to the select screen.
  await page.keyboard.press('r');
  await expect(page.getByTestId('wire-edge')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('level-select')).toBeVisible();
});

test('completing the final First Circuit level awards the Sparky badge', async ({ page }) => {
  await seedStars(page, ['first-circuit.1', 'first-circuit.2', 'first-circuit.3']);
  await openLevel(page, 'first-circuit.4');
  await page.getByTestId('intro-start-btn').click();

  // Two rooms: one MCB feeding a switch branch per load, both earthed returns.
  await connectHandles(page, 'sb', 'switchboard', 'way-1-l::src', 'mcb', 'mcb', 'l-in::src');
  await connectHandles(page, 'mcb', 'mcb', 'l-out::src', 'sw1', 'switch', 'l-in::src');
  await connectHandles(page, 'sw1', 'switch', 'l-out::src', 'lamp', 'bulb', 'l-in::src');
  await connectHandles(page, 'lamp', 'bulb', 'n-out::src', 'sb', 'switchboard', 'n-out::src');
  await connectHandles(page, 'mcb', 'mcb', 'l-out::src', 'sw2', 'switch', 'l-in::src');
  await connectHandles(page, 'sw2', 'switch', 'l-out::src', 'fan', 'fan', 'l-in::src');
  await connectHandles(page, 'fan', 'fan', 'n-out::src', 'sb', 'switchboard', 'n-out::src');
  await expect(page.getByTestId('wire-edge')).toHaveCount(7);

  // Category complete -> Sparky badge pops in the completion modal.
  const modal = page.getByTestId('level-complete-modal');
  await expect(modal).toBeVisible();
  await expect(page.getByTestId('completion-badge').filter({ hasText: 'Sparky' })).toBeVisible();

  // Back home, the earned badge shows on the rank card.
  await page.getByTestId('back-to-levels-btn').click();
  await page.getByTestId('back-home-btn').click();
  await expect(page.getByTestId('earned-badge').filter({ hasText: 'Sparky' })).toBeVisible();
});