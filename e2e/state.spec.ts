import { expect, test, type Page } from '@playwright/test';
import { openPlayground } from './helpers';

async function dropComponent(page: Page, testId: string, x: number, y: number) {
  const item = page.getByTestId(`palette-item-${testId}`);
  const canvas = page.getByTestId('wiring-canvas');
  await item.dragTo(canvas, { targetPosition: { x, y } });
}

async function connectLtoL(page: Page, fromType: string, toType: string) {
  const fromNode = page.locator(`[data-node-type="${fromType}"]`);
  const toNode = page.locator(`[data-node-type="${toType}"]`);
  const fromHandle = fromNode.locator('.react-flow__handle[data-handleid="l-out::src"]');
  const toHandle = toNode.locator('.react-flow__handle[data-handleid="l-in::src"]');
  await fromHandle.dragTo(toHandle);
}

test('undo and redo step through discrete circuit actions', async ({ page }) => {
  await openPlayground(page);

  await dropComponent(page, 'mcb', 280, 200);
  await dropComponent(page, 'bulb', 760, 200);
  await expect(page.getByTestId('component-node')).toHaveCount(2);
  await connectLtoL(page, 'mcb', 'bulb');
  await expect(page.getByTestId('wire-edge')).toHaveCount(1);

  // Undo the wire, then undo the bulb.
  await page.getByTestId('undo-btn').click();
  await expect(page.getByTestId('wire-edge')).toHaveCount(0);
  await page.getByTestId('undo-btn').click();
  await expect(page.getByTestId('component-node')).toHaveCount(1);
  await expect(page.getByTestId('canvas-status')).toContainText('1 component');

  // Redo both steps restores wire and bulb.
  await page.getByTestId('redo-btn').click();
  await page.getByTestId('redo-btn').click();
  await expect(page.getByTestId('component-node')).toHaveCount(2);
  await expect(page.getByTestId('wire-edge')).toHaveCount(1);
  await expect(page.getByTestId('canvas-status')).toContainText('2 components');

  // Fresh new-circuit clears the canvas.
  await page.getByTestId('new-btn').click();
  await expect(page.getByTestId('component-node')).toHaveCount(0);
});

test('saved circuit survives a page reload', async ({ page }) => {
  await openPlayground(page);

  await dropComponent(page, 'switch', 280, 200);
  await dropComponent(page, 'fan', 720, 200);
  await connectLtoL(page, 'switch', 'fan');
  await expect(page.getByTestId('wire-edge')).toHaveCount(1);

  await page.getByTestId('save-btn').click();
  await expect(page.getByTestId('notice')).toContainText('saved');

  // Reload wipes the in-memory store; Open restores from localStorage.
  await page.reload();
  await expect(page.getByTestId('component-node')).toHaveCount(0);
  await page.getByTestId('open-btn').click();
  await expect(page.getByTestId('notice')).toContainText('loaded');
  await expect(page.getByTestId('component-node')).toHaveCount(2);
  await expect(page.getByTestId('wire-edge')).toHaveCount(1);
  await expect(page.getByTestId('canvas-status')).toContainText('2 components');
  await expect(page.getByTestId('canvas-status')).toContainText('1 wire');
});
