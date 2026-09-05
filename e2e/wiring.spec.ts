import { expect, test, type Page } from '@playwright/test';
import { openPlayground } from './helpers';

async function dropComponent(page: Page, testId: string, x: number, y: number) {
  const item = page.getByTestId(`palette-item-${testId}`);
  const canvas = page.getByTestId('wiring-canvas');
  await item.dragTo(canvas, { targetPosition: { x, y } });
}

test('app shell loads the canvas and full palette', async ({ page }) => {
  await openPlayground(page);
  await expect(page.getByTestId('app-header')).toBeVisible();
  await expect(page.getByTestId('wiring-canvas')).toBeVisible();
  await expect(page.getByTestId('component-palette')).toBeVisible();

  const types = ['mcb', 'switch', 'bulb', 'fan', 'inverter', 'switchboard', 'socket'];
  for (const type of types) {
    await expect(page.getByTestId(`palette-item-${type}`)).toBeVisible();
  }
  await expect(page.getByTestId('canvas-status')).toContainText('0 components');
  await expect(page.getByTestId('canvas-status')).toContainText('0 wires');
});

test('drag MCB and bulb onto the canvas, wire them, then delete the wire and node', async ({
  page,
}) => {
  await openPlayground(page);

  await dropComponent(page, 'mcb', 320, 260);
  await dropComponent(page, 'bulb', 700, 260);
  await expect(page.getByTestId('component-node')).toHaveCount(2);

  const mcbNode = page.locator('[data-node-type="mcb"]');
  const bulbNode = page.locator('[data-node-type="bulb"]');
  await expect(mcbNode).toBeVisible();
  await expect(bulbNode).toBeVisible();

  // Wire MCB l-out -> bulb l-in, terminal to terminal. Every terminal handle
  // doubles as start and end, so both ends carry the ::src handle id.
  const fromHandle = mcbNode.locator('.react-flow__handle[data-handleid="l-out::src"]');
  const toHandle = bulbNode.locator('.react-flow__handle[data-handleid="l-in::src"]');
  await expect(fromHandle).toBeVisible();
  await fromHandle.dragTo(toHandle);
  await expect(page.getByTestId('wire-edge')).toHaveCount(1);
  await expect(page.getByTestId('wire-path')).toBeVisible();

  // Wire must be orthogonal: the routed polyline has only axis-aligned runs.
  const polylineRaw = await page.getByTestId('wire-path').getAttribute('data-polyline');
  const pts = JSON.parse(polylineRaw ?? '[]') as Array<{ x: number; y: number }>;
  expect(pts.length).toBeGreaterThanOrEqual(2);
  for (let i = 1; i < pts.length; i++) {
    const horizontal = Math.abs(pts[i].y - pts[i - 1].y) < 0.01;
    const vertical = Math.abs(pts[i].x - pts[i - 1].x) < 0.01;
    expect(horizontal || vertical).toBe(true);
  }

  // Current-flow animation dots appear along the wire.
  await expect(page.getByTestId('flow-dot').first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId('flow-dot')).toHaveCount(2);

  // Moving a node keeps the wire connected and re-routed. Use raw mouse steps
  // (Playwright's dragTo targets the element centre, which sits on the RF pane).
  const before = await page.getByTestId('wire-path').getAttribute('d');
  const boxBefore = await mcbNode.boundingBox();
  const cx = boxBefore!.x + boxBefore!.width / 2;
  const cy = boxBefore!.y + boxBefore!.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy + 140, { steps: 12 });
  await page.mouse.up();
  const boxAfter = await mcbNode.boundingBox();
  expect(boxAfter?.y).toBeGreaterThan((boxBefore?.y ?? 0) + 100);
  await expect(page.getByTestId('wire-path')).not.toHaveAttribute('d', before ?? '');

  // A duplicate connection attempt is rejected with a notice.
  await fromHandle.dragTo(toHandle);
  await expect(page.getByTestId('notice')).toContainText('already connected');

  // Self-connection within the same node is rejected.
  const selfTo = mcbNode.locator('.react-flow__handle[data-handleid="l-in::src"]');
  await fromHandle.dragTo(selfTo);
  await expect(page.getByTestId('notice')).toContainText('different components');

  // Click on the wire, then press Delete. Flow dots ride exactly on the line
  // but are pointer-transparent, so clicking a dot selects the wire beneath.
  const dotBox = await page.getByTestId('flow-dot').first().boundingBox();
  expect(dotBox).not.toBeNull();
  await page.mouse.click(dotBox!.x + dotBox!.width / 2, dotBox!.y + dotBox!.height / 2);
  // The Delete key removes the selected wire (our own key handler, since wire
  // selection is managed by the app store rather than React Flow).
  await page.keyboard.press('Delete');
  await expect(page.getByTestId('wire-edge')).toHaveCount(0);

  // Select the MCB node and delete it with the Delete key.
  await mcbNode.click();
  await page.keyboard.press('Delete');
  await expect(page.getByTestId('component-node')).toHaveCount(1);
  await expect(page.getByTestId('canvas-status')).toContainText('1 component');
});
