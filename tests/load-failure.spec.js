// A place says why it is empty when its page script cannot run. Without this, the visitor waits at a
// black screen (the #fade cover) for a scene that never comes.
import { test, expect } from '@playwright/test';

test('a place shows a message when A-Frame does not load', async ({ page }) => {
  await page.route('**/aframe.min.js', (route) => route.abort());
  await page.goto('');
  const box = page.locator('#load-error');
  await expect(box).toBeVisible();
  await expect(box).toContainText('"A-Frame"');
  await expect(page.locator('#fade')).toHaveClass(/clear/);
});

test('a place shows a message when JavaScript is off', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(baseURL);
  await expect(page.locator('#load-error')).toBeVisible();
  await expect(page.locator('#load-error')).toContainText('JavaScript');
  await context.close();
});

test('the message stays hidden when the place loads', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('#load-error')).toBeHidden();
});
