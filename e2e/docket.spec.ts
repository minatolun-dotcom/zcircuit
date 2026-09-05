import { expect, test, type Download, type Page } from '@playwright/test';
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

async function buildLampCircuit(page: Page) {
  await dropComponent(page, 'switchboard', 40, 140);
  await dropComponent(page, 'mcb', 320, 140);
  await dropComponent(page, 'bulb', 600, 300);
  await connectHandles(page, 'switchboard', 'way-1-l::src', 'mcb', 'l-in::src');
  await connectHandles(page, 'mcb', 'l-out::src', 'bulb', 'l-in::src');
  await connectHandles(page, 'bulb', 'n-out::src', 'switchboard', 'n-out::src');
  await expect(page.getByTestId('wire-edge')).toHaveCount(3);
}

async function readDownload(download: Download) {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

test('exports the circuit as JSON with full state and results', async ({ page }) => {
  await openPlayground(page);
  await buildLampCircuit(page);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-json-btn').click(),
  ]);
  expect(download.suggestedFilename()).toBe('circuit.json');
  const text = (await readDownload(download)).toString('utf8');
  const doc = JSON.parse(text);
  expect(doc.app).toBe('zcircuit');
  expect(doc.circuit.nodes).toHaveLength(3);
  expect(doc.circuit.edges).toHaveLength(3);
  expect(doc.simulation.message).toContain('1 load powered');
  expect(doc.docket.summary.wireCount).toBe(3);
  expect(doc.docket.conductorSchedule[0].sizeMm2).toBe(1.5);
});

test('exports a valid SVG wiring diagram', async ({ page }) => {
  await openPlayground(page);
  await buildLampCircuit(page);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-svg-btn').click(),
  ]);
  expect(download.suggestedFilename()).toBe('circuit.svg');
  const text = (await readDownload(download)).toString('utf8');
  expect(text.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
  expect(text.endsWith('</svg>')).toBe(true);
  expect(text).toContain('MCB');
  expect(text).toContain('Bulb');
  expect(text).toContain('<path');
});

test('generates a PDF wiring report', async ({ page }) => {
  await openPlayground(page);
  await buildLampCircuit(page);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-pdf-btn').click(),
  ]);
  expect(download.suggestedFilename()).toBe('wiring-docket.pdf');
  const bytes = await readDownload(download);
  expect(bytes.subarray(0, 4).toString('latin1')).toBe('%PDF');
});