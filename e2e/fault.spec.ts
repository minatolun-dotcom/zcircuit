import { expect, test, type Page } from '@playwright/test';

/** Seed progress so every level up to (and including) the given one is starred. */
async function unlockThrough(page: Page, lastLevelId: string): Promise<void> {
  await page.addInitScript(({ levels, key }) => {
    const all: Record<string, { stars: number; hintsUsed: number }> = {};
    for (const id of levels) all[id] = { stars: 3, hintsUsed: 0 };
    localStorage.setItem(key, JSON.stringify({ mode: 'lessons', levels: all, badges: [] }));
  }, { levels: chainUpTo(lastLevelId), key: 'zcircuit.progress' });
}

/** The linear unlock chain (mirrors the curriculum's ordering). */
function chainUpTo(lastLevelId: string): string[] {
  const ids = [
    'first-circuit.1', 'first-circuit.2', 'first-circuit.3', 'first-circuit.4',
    'getting-wired.5', 'getting-wired.6', 'getting-wired.7', 'getting-wired.8',
    'safety-first.9', 'safety-first.10', 'safety-first.11', 'safety-first.12',
    'fault-clinic.13', 'fault-clinic.14', 'fault-clinic.15', 'fault-clinic.16',
  ];
  const i = ids.indexOf(lastLevelId);
  return ids.slice(0, i + 1);
}

async function openLevel(page: Page, levelId: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await page.getByTestId('home-lessons-card').click();
  await expect(page.getByTestId('level-select')).toBeVisible();
  await page.getByTestId(`level-card-${levelId}`).click();
  await expect(page.getByTestId('level-hud')).toBeVisible();
}

/**
 * Select a wire by clicking a point on its routed path that is clear of every
 * component box (Playwright's bbox-center click can land under a node, and a
 * planted loose wire can even run straight through one).
 */
async function clickWire(page: Page, edgeId: string): Promise<void> {
  const path = page.locator(`[data-edge-id="${edgeId}"] [data-testid="wire-path"]`);
  const polyline: { x: number; y: number }[] = JSON.parse((await path.getAttribute('data-polyline')) ?? '[]');
  expect(polyline.length).toBeGreaterThan(1);

  const viewport = page.locator('.react-flow__viewport');
  const style = await viewport.getAttribute('style');
  const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+)\)/.exec(style ?? '');
  const tx = m ? Number(m[1]) : 0;
  const ty = m ? Number(m[2]) : 0;
  const z = m ? Number(m[3]) : 1;
  const canvasBox = await page.locator('.react-flow').boundingBox();
  expect(canvasBox).not.toBeNull();
  const toPage = (p: { x: number; y: number }) => ({ x: canvasBox!.x + p.x * z + tx, y: canvasBox!.y + p.y * z + ty });

  const nodeBoxes: { x: number; y: number; width: number; height: number }[] = [];
  for (const node of await page.locator('[data-node-type]').all()) {
    const b = await node.boundingBox();
    if (b) nodeBoxes.push(b);
  }

  let best: { x: number; y: number } | null = null;
  let bestDist = -1;
  for (let i = 1; i < polyline.length; i++) {
    const mid = { x: (polyline[i - 1].x + polyline[i].x) / 2, y: (polyline[i - 1].y + polyline[i].y) / 2 };
    const p = toPage(mid);
    const dist = Math.min(
      ...nodeBoxes.map((b) =>
        Math.max(
          0,
          Math.hypot(
            Math.max(b.x - p.x, p.x - (b.x + b.width), 0),
            Math.max(b.y - p.y, p.y - (b.y + b.height), 0),
          ),
        ),
      ),
    );
    if (dist > bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  expect(best).not.toBeNull();
  await page.mouse.click(best!.x, best!.y);
}

test('fault clinic: remove a dead-short wire and complete the level', async ({ page }) => {
  await unlockThrough(page, 'fault-clinic.14');
  await openLevel(page, 'fault-clinic.14');

  // Starter carries the planted short: 4 wires on the canvas (3 correct + the short).
  await expect(page.getByTestId('level-title')).toContainText('Dead short');
  await expect(page.getByTestId('wire-edge')).toHaveCount(4);

  // Objectives are red: the lamp is not powered and the short is flagged.
  const rows = page.getByTestId('objective-row');
  await expect(rows.filter({ hasText: /Power Bulb/ })).toHaveAttribute('data-pass', 'false');
  await expect(rows.filter({ hasText: /No error-level wiring problems/ })).toHaveAttribute('data-pass', 'false');

  // Select the shorting wire (mcb L out -> board N bus) and delete it.
  await clickWire(page, 'w4');
  await page.keyboard.press('Delete');
  await expect(page.getByTestId('wire-edge')).toHaveCount(3);

  // The fix lights the lamp and clears the short -> level complete.
  await expect(rows.filter({ hasText: /Power Bulb/ })).toHaveAttribute('data-pass', 'true');
  await expect(page.getByTestId('level-complete-modal')).toBeVisible();
  await expect(page.getByTestId('completion-star-1')).toHaveAttribute('data-filled', 'true');
});

test('fault clinic: a loose stray wire renders, is deletable, and the missing neutral can be added', async ({ page }) => {
  await unlockThrough(page, 'fault-clinic.13');
  await openLevel(page, 'fault-clinic.13');

  // 3 wires on canvas: the two correct feeds plus the loose stray.
  await expect(page.getByTestId('level-title')).toContainText('Loose wire');
  await expect(page.getByTestId('wire-edge')).toHaveCount(3);

  // The lamp is dark and the stray-wire finding shows.
  const rows = page.getByTestId('objective-row');
  await expect(rows.filter({ hasText: /Power Bulb/ })).toHaveAttribute('data-pass', 'false');

  // Pull the loose wire (w3) and wire the neutral home.
  await clickWire(page, 'w3');
  await page.keyboard.press('Delete');
  await expect(page.getByTestId('wire-edge')).toHaveCount(2);

  const board = page.locator('[data-node-type="switchboard"]');
  const bulb = page.locator('[data-node-type="bulb"]');
  await board
    .locator('.react-flow__handle[data-handleid="n-out::src"]')
    .dragTo(bulb.locator('.react-flow__handle[data-handleid="n-out::src"]'));
  await expect(page.getByTestId('wire-edge')).toHaveCount(3);

  await expect(rows.filter({ hasText: /Power Bulb/ })).toHaveAttribute('data-pass', 'true');
  await expect(page.getByTestId('level-complete-modal')).toBeVisible();
});

test('fault clinic: add the missing earth wire to an energized socket', async ({ page }) => {
  await unlockThrough(page, 'fault-clinic.15');
  await openLevel(page, 'fault-clinic.15');

  await expect(page.getByTestId('level-title')).toContainText('No earth');
  // Socket L + N are wired; PE is dangling - one wire is missing.
  await expect(page.getByTestId('wire-edge')).toHaveCount(3);

  const rows = page.getByTestId('objective-row');
  await expect(rows.filter({ hasText: /No warning-level wiring problems/ })).toHaveAttribute('data-pass', 'false');

  const board = page.locator('[data-node-type="switchboard"]');
  const socket = page.locator('[data-node-type="socket"]');
  await board
    .locator('.react-flow__handle[data-handleid="pe-out::src"]')
    .dragTo(socket.locator('.react-flow__handle[data-handleid="pe-in::src"]'));
  await expect(page.getByTestId('wire-edge')).toHaveCount(4);

  await expect(rows.filter({ hasText: /Energize Socket/ })).toHaveAttribute('data-pass', 'true');
  await expect(page.getByTestId('level-complete-modal')).toBeVisible();
});