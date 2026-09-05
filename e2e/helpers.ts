import { expect, type Page } from '@playwright/test';

/**
 * The app now boots into the Lessons home (PLAN.md Part 2). Playground specs
 * start from the editor, so this helper navigates and switches to the
 * Playground tab, waiting until the wiring canvas is interactive.
 */
export async function openPlayground(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('app-header')).toBeVisible();
  const tab = page.getByTestId('mode-tab-playground');
  await tab.click();
  await expect(page.getByTestId('wiring-canvas')).toBeVisible();
  await expect(page.getByTestId('simulation-toolbar')).toBeVisible();
}
