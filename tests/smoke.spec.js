// Smoke tests on the production build (_site/). BDR-001, 002, 003, 005, 006, 007 (S1) and 009 (S2).
// The list of places comes from packs/, so a new pack gets these tests with no test change (ADR-011).
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { Place, packPaths } from './place.js';

const PATHS = packPaths(join(import.meta.dirname, '..', 'packs'));

test('the pack list has the root and the nested pack', () => {
  expect(PATHS).toContain('');
  expect(PATHS).toContain('moon/moon-base/');
});

for (const path of PATHS) {
  test(`place /${path} renders with a door for each child and an exit`, async ({ page, request }) => {
    const place = new Place(page);
    const res = await place.open(path);
    expect(res.status()).toBe(200);
    const { place: data, placed, triggers } = await place.data();

    // BDR-001: tab title and overlay text.
    await expect(page).toHaveTitle(`${data.title} · AWS Valley`);
    await expect(page.locator('#hud')).toContainText(`${data.title} · WASD to move · click to look`);
    // BDR-002, BDR-003: one door for each child, one exit except at the root.
    expect(placed).toBe(data.children.length);
    expect(triggers).toHaveLength(data.children.length + (data.parent ? 1 : 0));
    if (path === '') expect(data.parent).toBeNull();
    else expect(await place.labels()).toContain(`Back to ${data.parent.title}`);
    for (const child of data.children) expect(await place.labels()).toContain(child.title);
    for (const url of triggers) {
      const r = await request.get(new URL(url, page.url()).href);
      expect(r.status(), url).toBe(200);
    }
    // BDR-001 S3: the Markdown body is the sign text.
    if (data.text) {
      const sign = await page.evaluate(() => document.querySelector('#sign a-text')?.getAttribute('value'));
      expect(sign).toBe(data.text);
    }
    // BDR-007 S1: each place has an Enter VR button.
    await expect(page.locator('.a-enter-vr-button')).toHaveCount(1);
    // No console error, and no request returns 404 while the place loads (brief M4).
    expect(place.errors).toEqual([]);
    expect(place.responses.filter((r) => r.status === 404)).toEqual([]);
  });
}

test('walk through a door, then back out through the exit', async ({ page }) => {
  const place = new Place(page);
  await place.open('');
  await place.walkTo('cozy-house');
  // BDR-002 S1: the screen goes black before the URL changes.
  await expect(page.locator('#fade')).not.toHaveClass(/clear/);
  await expect(page).toHaveURL(/\/cozy-house\/$/);
  await place.ready();
  await expect(page.locator('#fade')).toHaveClass(/clear/);

  await place.walkTo('from=cozy-house');
  await expect(page).toHaveURL(/\?from=cozy-house$/);
  await place.ready();
  expect(place.errors).toEqual([]);
});

test('BDR-009 S2: the nested pack has an exit to The Moon, with an encoded from= ID', async ({ page }) => {
  const place = new Place(page);
  const res = await place.open('moon/moon-base/');
  expect(res.status()).toBe(200);
  expect(await place.labels()).toContain('Back to The Moon');
  const exit = await page.evaluate(() => window.__placeDebug.triggers.find((t) => t.kind === 'exit').url);
  expect(exit).toMatch(/\/moon\/\?from=moon%2Fmoon-base$/);

  // BDR-003 S2: the visitor stands about 3 m in front of the door and looks at it.
  await place.walkTo('from=moon');
  await expect(page).toHaveURL(/\/moon\/\?from=moon%2Fmoon-base$/);
  await place.ready();
  const spot = await page.evaluate(() => {
    const dbg = window.__placeDebug;
    const door = dbg.placed.find((s) => s.id === 'moon/moon-base').door;
    const body = dbg.body();
    const dir = document.getElementById('cam').object3D.getWorldDirection(new THREE.Vector3());
    const to = { x: door.x - body.x, z: door.z - body.z };
    const L = Math.hypot(to.x, to.z);
    return { distance: L, facing: (-dir.x * to.x - dir.z * to.z) / L };
  });
  expect(spot.distance).toBeGreaterThan(2.7);
  expect(spot.distance).toBeLessThan(3.3);
  expect(spot.facing).toBeGreaterThan(0.95);
  expect(await place.labels()).toContain('Moon Base');
  expect(place.errors).toEqual([]);
});

test('BDR-003 S4: an unknown from= value gives the normal start point', async ({ page }) => {
  const place = new Place(page);
  await place.open('?from=no-such-place');
  const body = await page.evaluate(() => window.__placeDebug.body());
  expect(Math.hypot(body.x, body.z)).toBeLessThan(0.01);
  expect(place.errors).toEqual([]);
});

test('BDR-006: models are served as model/gltf-binary', async ({ request }) => {
  for (const path of ['assets/models/nature/Pine_1.glb', 'cozy-house/models/barrel.glb']) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    expect(res.headers()['content-type'], path).toBe('model/gltf-binary');
  }
});

test('BDR-005: an unknown place shows the 404 page', async ({ page }) => {
  const res = await page.goto('no-such-place/');
  expect(res.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'This place does not exist.' })).toBeVisible();
  await expect(page.getByRole('link')).toHaveAttribute('href', /\/$/);
});

test('ADR-001: the old URL /moon-base/ is gone', async ({ request }) => {
  expect((await request.get('moon-base/')).status()).toBe(404);
});

test('a bloom render that throws does not stop bloom for later frames', async ({ page }) => {
  const place = new Place(page);
  await place.open('');
  const calls = await page.evaluate(() => {
    const composer = window.__bloomComposer;
    const renderer = document.querySelector('a-scene').renderer;
    const real = composer.render.bind(composer);
    let count = 0;
    composer.render = () => {
      count += 1;
      if (count === 1) throw new Error('bloom test');
    };
    try {
      renderer.render(document.querySelector('a-scene').object3D, document.querySelector('a-scene').camera);
    } catch {
      // The first call throws on purpose.
    }
    renderer.render(document.querySelector('a-scene').object3D, document.querySelector('a-scene').camera);
    composer.render = real;
    return count;
  });
  // Before the fix, the second call skipped the composer, so count stayed at 1.
  expect(calls).toBeGreaterThanOrEqual(2);
});
