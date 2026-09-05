import { expect, test, type Page } from '@playwright/test';

async function connectHandles(
  page: Page,
  fromType: string,
  fromHandle: string,
  toType: string,
  toHandle: string,
) {
  const fromNode = page.locator(`[data-node-type="${fromType}"]`);
  const toNode = page.locator(`[data-node-type="${toType}"]`);
  await fromNode
    .locator(`.react-flow__handle[data-handleid="${fromHandle}"]`)
    .dragTo(toNode.locator(`.react-flow__handle[data-handleid="${toHandle}"]`));
}

/** Wire L1's starter: switchboard Way 1 -> lamp L and lamp N -> board N bus. */
async function wireLevel1(page: Page) {
  await connectHandles(page, 'switchboard', 'way-1-l::src', 'bulb', 'l-in::src');
  await connectHandles(page, 'bulb', 'n-out::src', 'switchboard', 'n-out::src');
  await expect(page.getByTestId('wire-edge')).toHaveCount(2);
}

async function openLevelOne(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await page.getByTestId('home-lessons-card').click();
  await expect(page.getByTestId('level-select')).toBeVisible();
  await page.getByTestId('level-card-first-circuit.1').click();
  await expect(page.getByTestId('level-hud')).toBeVisible();
  await expect(page.getByTestId('level-title')).toContainText('Make it glow');
  // The level intro card briefs the mission; dismiss it to reach the canvas.
  await page.getByTestId('intro-start-btn').click();
  await expect(page.getByTestId('level-intro-modal')).not.toBeVisible();
}

test('app boots to the lessons home with both modes reachable', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(page.getByTestId('home-lessons-card')).toBeVisible();
  await expect(page.getByTestId('home-playground-card')).toBeVisible();
  await expect(page.getByTestId('rank-chip')).toBeVisible();

  // Playground is one click away and keeps the full editor.
  await page.getByTestId('home-playground-card').click();
  await expect(page.getByTestId('wiring-canvas')).toBeVisible();
  await expect(page.getByTestId('component-palette')).toBeVisible();
  await expect(page.getByTestId('undo-btn')).toBeVisible();

  // And back to lessons.
  await page.getByTestId('mode-tab-lessons').click();
  await expect(page.getByTestId('home-screen')).toBeVisible();
});

test('level select locks levels behind the linear chain', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('home-lessons-card').click();
  await expect(page.getByTestId('level-select')).toBeVisible();

  const l1 = page.getByTestId('level-card-first-circuit.1');
  const l2 = page.getByTestId('level-card-first-circuit.2');
  const l4 = page.getByTestId('level-card-first-circuit.4');
  await expect(l1).toBeEnabled();
  await expect(l2).toHaveAttribute('data-locked', 'true');
  await expect(l4).toHaveAttribute('data-locked', 'true');
  await expect(page.getByTestId('category-locked-first-circuit')).not.toBeVisible(); // unlocked card section
});

test('first circuit level: wire the starter and complete with three stars', async ({ page }) => {
  await openLevelOne(page);

  // Starter circuit is preloaded: switchboard + lamp, two component nodes.
  await expect(page.getByTestId('component-node')).toHaveCount(2);
  await expect(page.locator('[data-node-type="switchboard"]')).toBeVisible();
  await expect(page.locator('[data-node-type="bulb"]')).toBeVisible();

  // Objectives render; the lamp is unpowered until wired.
  const rows = page.getByTestId('objective-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: /Power Bulb/ })).toHaveAttribute('data-pass', 'false');

  // Wiring the loop lights the bulb live (no Run gate) and completes the level.
  await wireLevel1(page);
  await expect(rows.filter({ hasText: /Power Bulb/ })).toHaveAttribute('data-pass', 'true');
  await expect(page.getByTestId('level-progress')).toContainText('2/2');

  // Completion modal with a full star reveal (no hints used, no errors, par met).
  const modal = page.getByTestId('level-complete-modal');
  await expect(modal).toBeVisible();
  await expect(page.getByTestId('completion-star-3')).toHaveAttribute('data-filled', 'true');
  await expect(page.getByTestId('next-level-btn')).toBeVisible();

  // Next level loads its own starter (switch added) and stays in the chain.
  await page.getByTestId('next-level-btn').click();
  await expect(page.getByTestId('level-title')).toContainText('Shut it off');
  await expect(page.getByTestId('component-node')).toHaveCount(3);
  await expect(page.locator('[data-node-type="switch"]')).toBeVisible();
});

test('using a hint caps the level at two stars', async ({ page }) => {
  await openLevelOne(page);

  await page.getByTestId('level-hint-btn').click();
  await expect(page.getByTestId('level-hint-count')).toHaveText(/\u0031/);

  await wireLevel1(page);
  const modal = page.getByTestId('level-complete-modal');
  await expect(modal).toBeVisible();
  await expect(page.getByTestId('completion-star-2')).toHaveAttribute('data-filled', 'true');
  await expect(page.getByTestId('completion-star-3')).toHaveAttribute('data-filled', 'false');
});

test('progress persists across a reload and unlocks the next level', async ({ page }) => {
  await openLevelOne(page);
  await wireLevel1(page);
  await expect(page.getByTestId('level-complete-modal')).toBeVisible();
  await page.getByTestId('back-to-levels-btn').click();

  // L2 is now unlocked in the select screen.
  await expect(page.getByTestId('level-select')).toBeVisible();
  const l2 = page.getByTestId('level-card-first-circuit.2');
  await expect(l2).toBeEnabled();

  // Reload: rank + stars survive; L2 stays unlocked.
  await page.reload();
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await page.getByTestId('home-lessons-card').click();
  await expect(page.getByTestId('level-card-first-circuit.1')).toBeEnabled();
  await expect(page.getByTestId('level-card-first-circuit.2')).toBeEnabled();
  await expect(page.getByTestId('rank-chip')).toContainText(/★/);
});

test('restart resets the starter circuit and objective rows', async ({ page }) => {
  await openLevelOne(page);
  await connectHandles(page, 'switchboard', 'way-1-l::src', 'bulb', 'l-in::src');
  await expect(page.getByTestId('wire-edge')).toHaveCount(1);

  await page.getByTestId('level-restart-btn').click();
  await expect(page.getByTestId('wire-edge')).toHaveCount(0);
  await expect(page.getByTestId('component-node')).toHaveCount(2);
});
