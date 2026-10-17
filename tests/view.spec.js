// BDR-008 third person view, on the production build (view_switch: key). Stack ADR-013.
import { test, expect } from '@playwright/test';
import { Place } from './place.js';

// A point `d` metres in front of a door, on the side of the place center, and the door itself.
function approach(dbgDoor, d) {
  const L = Math.hypot(dbgDoor.x, dbgDoor.z);
  return { x: dbgDoor.x - (dbgDoor.x / L) * d, z: dbgDoor.z - (dbgDoor.z / L) * d };
}

async function door(page, part) {
  return page.evaluate((p) => window.__placeDebug.triggers.find((t) => t.url.includes(p)), part);
}

test('S1: the V key switches to third person, and the avatar is in front of the camera', async ({ page }) => {
  const place = new Place(page);
  await place.open('');
  await expect(page.locator('#hud')).toContainText('V to switch view');
  await expect(page.locator('#view-btn')).toHaveCount(0);
  // AC-3: the first visit is first person.
  expect(await place.view()).toBe('first');
  expect((await place.avatar()).visible).toBe(false);

  await page.keyboard.press('KeyV');
  expect(await place.view()).toBe('third');
  const a = await place.avatar();
  expect(a.visible).toBe(true);
  expect(a.inView).toBe(true);

  // AC-2: the camera stays behind the avatar when the visitor moves.
  // wasd-controls skips a frame longer than 0.2 s, and headless SwiftShader frames take about 0.4 s.
  // Thus the test holds W and steps wasd-controls 40 times at 16 ms, then waits two frames for the view.
  await page.keyboard.down('KeyW');
  await page.evaluate(() => {
    const wasd = document.querySelector('a-camera').components['wasd-controls'];
    for (let i = 0; i < 40; i++) wasd.tick(0, 16);
  });
  await page.keyboard.up('KeyW');
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const after = await place.avatar();
  expect(after.inView).toBe(true);
  expect(Math.hypot(after.x - a.x, after.z - a.z)).toBeGreaterThan(0.2);
  const cam = await page.evaluate(() => window.__placeDebug.camera());
  expect(Math.hypot(cam.x - after.x, cam.z - after.z)).toBeCloseTo(2.5, 1);

  await page.keyboard.press('KeyV');
  expect(await place.view()).toBe('first');
  expect((await place.avatar()).visible).toBe(false);
  expect(place.errors).toEqual([]);
});

test('S4: ?view= has no effect with the key method', async ({ page }) => {
  const place = new Place(page);
  await place.open('?view=third');
  expect(await place.view()).toBe('first');
  await expect(page.locator('#view-btn')).toHaveCount(0);
});

test('S5: the view stays after a door, a reload and an exit; door URLs have no view=', async ({ page }) => {
  // S5 loads four pages. Headless SwiftShader renders at about 2 frames per second, so S5 needs more than 30 s.
  test.slow();
  const place = new Place(page);
  await place.open('');
  await page.keyboard.press('KeyV');
  expect(await place.view()).toBe('third');

  await place.walkTo('cozy-house');
  await expect(page).toHaveURL(/\/cozy-house\/$/);
  await place.ready();
  expect(await place.view()).toBe('third');
  await page.reload();
  await place.ready();
  expect(await place.view()).toBe('third');
  const urls = await page.evaluate(() => window.__placeDebug.triggers.map((t) => t.url));
  for (const url of urls) expect(url).not.toContain('view=');

  await place.walkTo('from=cozy-house');
  await expect(page).toHaveURL(/\?from=cozy-house$/);
  await place.ready();
  expect(await place.view()).toBe('third');
  expect(place.errors).toEqual([]);
});

test('S6 / AC-4: the avatar fires the door, and the camera does not', async ({ page }) => {
  const place = new Place(page);
  await place.open('');
  await page.keyboard.press('KeyV');
  const d = await door(page, 'crystal-cave');

  // Put the camera on the door. The avatar is 2.5 m away, so the door must not fire.
  await page.evaluate((dd) => {
    const dbg = window.__placeDebug;
    dbg.teleport(0, 0);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const cam = dbg.camera();
        const body = dbg.body();
        // Move so that the camera (not the avatar) is on the door.
        dbg.teleport(dd.x + (body.x - cam.x), dd.z + (body.z - cam.z));
      })
    );
  }, d);
  await page.waitForTimeout(800);
  const cam = await page.evaluate(() => window.__placeDebug.camera());
  expect(Math.hypot(cam.x - d.x, cam.z - d.z)).toBeLessThan(1.3);
  expect(page.url()).not.toContain('crystal-cave');

  // Avatar 2 m from the door: no navigation. Then walk the avatar onto the door: navigation.
  const near = approach(d, 2);
  await page.evaluate((p) => window.__placeDebug.teleport(p.x, p.z), near);
  await page.waitForTimeout(300);
  expect(page.url()).not.toContain('crystal-cave');
  await page.evaluate((p) => window.__placeDebug.teleport(p.x, p.z), d);
  await expect(page).toHaveURL(/\/crystal-cave\/$/);
});

test('risk R7: a view change near a door does not fire the door', async ({ page }) => {
  const place = new Place(page);
  await place.open('');
  const d = await door(page, 'cozy-house');
  const near = approach(d, 1.6);
  await page.evaluate((p) => window.__placeDebug.teleport(p.x, p.z), near);
  await page.waitForTimeout(200);
  await page.keyboard.press('KeyV');
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyV');
  await page.waitForTimeout(500);
  expect(page.url()).not.toContain('cozy-house');
  const body = await page.evaluate(() => window.__placeDebug.body());
  expect(Math.hypot(body.x - near.x, body.z - near.z)).toBeLessThan(0.3);
});

test('NFR-4: with blocked localStorage the page loads in first person with no error', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('blocked');
      }
    });
  });
  const place = new Place(page);
  await place.open('');
  expect(await place.view()).toBe('first');
  await page.keyboard.press('KeyV');
  expect(await place.view()).toBe('third');
  expect(place.errors).toEqual([]);
});
