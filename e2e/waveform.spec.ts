import { expect, test, type Page } from '@playwright/test';

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

/** switchboard -> MCB(16A) -> 60W bulb with N return (same layout as sim.spec). */
async function buildLampCircuit(page: Page) {
  await dropComponent(page, 'switchboard', 40, 140);
  await dropComponent(page, 'mcb', 320, 140);
  await dropComponent(page, 'bulb', 600, 300);
  await connectHandles(page, 'switchboard', 'way-1-l::src', 'mcb', 'l-in::src');
  await connectHandles(page, 'mcb', 'l-out::src', 'bulb', 'l-in::src');
  await connectHandles(page, 'bulb', 'n-out::src', 'switchboard', 'n-out::src');
  await expect(page.getByTestId('wire-edge')).toHaveCount(3);
}

test('oscilloscope synthesizes the waveform while running and pauses with it', async ({ page }) => {
  await page.goto('/');
  await buildLampCircuit(page);

  // Open the scope: paused -> placeholder, no waveform rendered.
  await page.getByTestId('waveform-toggle').click();
  const panel = page.getByTestId('waveform-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('waveform-placeholder')).toContainText('Paused');
  await expect(page.getByTestId('waveform-canvas')).toBeHidden();

  // Run -> the trace renders with the idealized readouts.
  await page.getByTestId('sim-play-btn').click();
  await expect(page.getByTestId('waveform-canvas')).toBeVisible();
  await expect(page.getByTestId('waveform-placeholder')).toHaveCount(0);
  await expect(panel).toContainText('idealized');
  await expect(panel).toContainText('230 V RMS');
  await expect(panel).toContainText('325 V peak');
  await expect(panel).toContainText('50 Hz');
  await expect(panel).toContainText('0.26 A RMS');

  // Pause stops the waveform (canvas cleared, placeholder returns).
  await page.getByTestId('sim-play-btn').click();
  await expect(page.getByTestId('waveform-canvas')).toBeHidden();
  await expect(page.getByTestId('waveform-placeholder')).toContainText('Paused');
});

test('time-axis zoom changes the visible window', async ({ page }) => {
  await page.goto('/');
  await buildLampCircuit(page);

  await page.getByTestId('waveform-toggle').click();
  await page.getByTestId('sim-play-btn').click();
  await expect(page.getByTestId('waveform-window')).toContainText('100 ms');

  await page.getByTestId('waveform-zoom-in').click();
  await expect(page.getByTestId('waveform-window')).toContainText('50 ms');
  await page.getByTestId('waveform-zoom-in').click();
  await expect(page.getByTestId('waveform-window')).toContainText('25 ms');

  await page.getByTestId('waveform-zoom-out').click();
  await page.getByTestId('waveform-zoom-out').click();
  await expect(page.getByTestId('waveform-window')).toContainText('100 ms');
});