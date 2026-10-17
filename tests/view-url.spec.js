// BDR-008 Scenario 3 on the build with view_switch: url (_site-url/).
import { test, expect } from '@playwright/test';
import { Place } from './place.js';

test('S3: ?view=third sets the view; the V key has no effect; no view button', async ({ page }) => {
  const place = new Place(page);
  await place.open('?view=third');
  expect(await place.view()).toBe('third');
  const a = await place.avatar();
  expect(a.visible).toBe(true);
  expect(a.inView).toBe(true);
  await page.keyboard.press('KeyV');
  expect(await place.view()).toBe('third');
  await expect(page.locator('#view-btn')).toHaveCount(0);
  await expect(page.locator('#hud')).not.toContainText('V to switch view');

  // The URL also stores the view, so the next page without ?view= is third person.
  await place.open('cozy-house/');
  expect(await place.view()).toBe('third');
  await place.open('?view=first');
  expect(await place.view()).toBe('first');
  expect(place.errors).toEqual([]);
});

test('E5: a bad ?view= value is ignored with no error', async ({ page }) => {
  const place = new Place(page);
  await place.open('?view=side');
  expect(await place.view()).toBe('first');
  expect(place.errors).toEqual([]);
});
