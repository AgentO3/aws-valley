// BDR-008 Scenario 2 on the build with view_switch: key-and-button (_site-button/).
import { test, expect } from '@playwright/test';
import { Place } from './place.js';

test('S2: the view button switches to third person, and the V key also works', async ({ page }) => {
  const place = new Place(page);
  await place.open('');
  await expect(page.locator('#hud')).toContainText('V to switch view');
  // NFR-10: a real button with an accessible name.
  const button = page.getByRole('button', { name: 'Third person view' });
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute('aria-pressed', 'false');

  await button.click();
  expect(await place.view()).toBe('third');
  const a = await place.avatar();
  expect(a.visible).toBe(true);
  expect(a.inView).toBe(true);
  await expect(page.locator('#view-btn')).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('KeyV');
  expect(await place.view()).toBe('first');
  await expect(page.locator('#view-btn')).toHaveAttribute('aria-pressed', 'false');
  expect(place.errors).toEqual([]);
});

test('S4: ?view= has no effect with the key-and-button method', async ({ page }) => {
  const place = new Place(page);
  await place.open('?view=third');
  expect(await place.view()).toBe('first');
});
