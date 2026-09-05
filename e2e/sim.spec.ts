import { expect, test, type Page } from '@playwright/test';
import { openPlayground } from './helpers';

async function dropComponent(page: Page, testId: string, x: number, y: number) {
  const item = page.getByTestId(`palette-item-${testId}`);
  const canvas = page.getByTestId('wiring-canvas');
  await item.dragTo(canvas, { targetPosition: { x, y } });
}

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

const node = (page: Page, type: string) => page.locator(`[data-node-type="${type}"]`);

/** Full lighting circuit: switchboard -> MCB(16A) -> 60W bulb with N return. */
async function buildLampCircuit(page: Page) {
  await dropComponent(page, 'switchboard', 40, 140);
  await dropComponent(page, 'mcb', 320, 140);
  await dropComponent(page, 'bulb', 600, 300);
  await connectHandles(page, 'switchboard', 'way-1-l::src', 'mcb', 'l-in::src');
  await connectHandles(page, 'mcb', 'l-out::src', 'bulb', 'l-in::src');
  await connectHandles(page, 'bulb', 'n-out::src', 'switchboard', 'n-out::src');
  await expect(page.getByTestId('wire-edge')).toHaveCount(3);
}

test('running the simulation powers the lamp and shows live readouts', async ({ page }) => {
  await openPlayground(page);
  await buildLampCircuit(page);

  // Speed control works before running.
  const speed = page.getByTestId('sim-speed');
  await speed.selectOption('2');
  await expect(speed).toHaveValue('2');

  await page.getByTestId('sim-play-btn').click();

  // Solver summary + per-component readouts appear.
  await expect(page.getByTestId('sim-status')).toContainText('1 load powered');
  await expect(node(page, 'bulb')).toHaveAttribute('data-sim-status', 'on');
  await expect(node(page, 'bulb').getByTestId('sim-readout')).toContainText('A');
  await expect(node(page, 'mcb')).toHaveAttribute('data-sim-status', 'on');
  await expect(node(page, 'switchboard')).toHaveAttribute('data-sim-status', 'on');

  // Pause keeps the last solution on screen.
  await page.getByTestId('sim-play-btn').click();
  await expect(page.getByTestId('sim-play-btn')).toContainText('Run');
});

test('validation flags a healthy circuit as clean and a short circuit in red', async ({ page }) => {
  await openPlayground(page);

  // Healthy circuit -> no problems.
  await buildLampCircuit(page);
  await page.getByTestId('validation-toggle').click();
  await expect(page.getByTestId('validation-panel')).toContainText('No problems found.');
  await expect(page.getByTestId('validation-count')).toContainText('✓');

  // Dead short across the MCB (its L-out wired straight to the N bus).
  await page.getByTestId('new-btn').click();
  await dropComponent(page, 'switchboard', 80, 160);
  await dropComponent(page, 'mcb', 440, 160);
  await connectHandles(page, 'switchboard', 'way-1-l::src', 'mcb', 'l-in::src');
  await connectHandles(page, 'mcb', 'l-out::src', 'switchboard', 'n-in::src');
  await expect(page.getByTestId('wire-edge')).toHaveCount(2);

  // Validation is still toggled on from the healthy-circuit phase above, so
  // the new dead short should surface immediately without another click.
  const finding = page.getByTestId('validation-finding').filter({ hasText: /short circuit/i });
  await expect(finding).toHaveCount(1);
  await expect(finding).toHaveAttribute('data-severity', 'error');
  await expect(page.getByTestId('validation-count')).toContainText('1');
  // The source board is highlighted red on the canvas.
  await expect(node(page, 'switchboard')).toHaveAttribute('data-validation-error', '1');

  // Running the sim shows the MCB tripping.
  await page.getByTestId('sim-play-btn').click();
  await expect(node(page, 'mcb')).toHaveAttribute('data-sim-status', 'tripped');
  await expect(node(page, 'mcb').getByTestId('sim-readout')).toContainText('TRIPPED');
  await expect(page.getByTestId('sim-status')).toContainText('MCB tripped');
});

test('optimization panel lists conductor and layout suggestions', async ({ page }) => {
  await openPlayground(page);
  await buildLampCircuit(page);

  await page.getByTestId('optimization-toggle').click();
  await expect(page.getByTestId('optimization-panel')).toBeVisible();
  // 16 A MCB branch -> gauge suggestion; the long N return -> length tip.
  const suggestions = page.getByTestId('optimization-suggestion');
  await expect(suggestions.filter({ hasText: /mm²/ })).toHaveCount(1);
  await expect(suggestions.first()).toBeVisible();
  // Advisory tips (gauge, long N return, add-a-switch) all land in the panel.
  await expect
    .poll(async () => Number(await page.getByTestId('optimization-count').textContent()))
    .toBeGreaterThan(0);

  // Validation and optimization rails stack together.
  await page.getByTestId('validation-toggle').click();
  await expect(page.getByTestId('analysis-rail')).toBeVisible();
  await expect(page.getByTestId('validation-panel')).toBeVisible();
  await expect(page.getByTestId('optimization-panel')).toBeVisible();
});
