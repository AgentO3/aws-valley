// BDR-009..012 on the fixture build (_site-fixture/, packs from tests/fixtures/packs/).
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { Place, packPaths } from './place.js';

const FIXTURE = join(import.meta.dirname, 'fixtures', 'packs');

test.beforeEach(async ({ page }) => {
  // Each test starts with empty pack storage.
  await page.goto('404.html');
  await page.evaluate(() => window.localStorage.clear());
});

test.describe('BDR-009 pack folder defines a place', () => {
  test('S1: the root shows a door for each pack folder', async ({ page }) => {
    const place = new Place(page);
    await place.open('');
    const labels = await place.labels();
    for (const title of ['Arcade', 'Broken', 'Pips House', 'Shed', 'Vault']) expect(labels).toContain(title);
    const { place: data } = await place.data();
    expect(data.children.map((c) => c.id)).toEqual(['arcade', 'broken', 'pipshouse', 'shed', 'vault']);
  });

  test('S4: files of a pack are served under the place URL; an asset folder is not a place', async ({
    page,
    request
  }) => {
    const glb = await request.get('pipshouse/models/rug.glb');
    expect(glb.status()).toBe(200);
    expect(glb.headers()['content-type']).toBe('model/gltf-binary');
    expect((await request.get('pipshouse/models/')).status()).toBe(404);
    const place = new Place(page);
    await place.open('pipshouse/');
    const { place: data } = await place.data();
    expect(data.children).toEqual([]);
    expect(await place.labels()).toEqual(['Back to Test Valley']);
  });
});

test.describe('BDR-010 pack defaults', () => {
  test('S1: the parent shows a plain door frame labelled Shed', async ({ page }) => {
    const place = new Place(page);
    await place.open('');
    expect(await place.labels()).toContain('Shed');
    const shed = await page.evaluate(() => window.__placeDebug.placed.find((s) => s.id === 'shed'));
    // The plain door frame has its door 0.6 m in front of the frame.
    expect(Math.hypot(shed.door.x - shed.x, shed.door.z - shed.z)).toBeCloseTo(0.6, 3);
  });

  test('S2 + S3: inside the minimum pack: empty room, sign, exit, no error, no 404', async ({ page }) => {
    const place = new Place(page);
    const res = await place.open('shed/');
    expect(res.status()).toBe(200);
    const sign = await page.evaluate(() => document.querySelector('#sign a-text').getAttribute('value'));
    expect(sign).toBe('An empty shed.');
    expect(await place.labels()).toEqual(['Back to Test Valley']);
    expect(await page.evaluate(() => window.__placeDebug.files)).toEqual([]);
    expect(place.errors).toEqual([]);
    expect(place.responses.filter((r) => r.status === 404)).toEqual([]);
    // AC-4: no request for a pack module that does not exist.
    expect(place.responses.filter((r) => /\/shed\/(exterior|interior|rules)\.js/.test(r.url))).toEqual([]);
  });
});

test.describe('BDR-011 place rules stay in their place', () => {
  test('S1: the enter rule shows only in its place', async ({ page }) => {
    const place = new Place(page);
    await place.open('arcade/');
    expect(await place.messages()).toContain('Welcome to the arcade');
    await expect(page.locator('#say')).toHaveText('Welcome to the arcade');
    await place.walkTo('from=arcade');
    await expect(page).toHaveURL(/\?from=arcade$/);
    await place.ready();
    expect(await place.messages()).not.toContain('Welcome to the arcade');
  });

  test('S2: a locked door does not fire and shows a message; root doors still fire', async ({ page }) => {
    const place = new Place(page);
    await place.open('vault/');
    await place.walkTo('vault/gold');
    await place.frames(4);
    await expect(page).toHaveURL(/\/vault\/$/);
    expect(await place.messages()).toContain('The door is locked');
    expect(await page.evaluate(() => window.__placeDebug.locked)).toEqual(['vault/gold']);
    await expect(page.locator('#say')).toHaveText('The door is locked');

    await place.open('');
    await place.walkTo('shed');
    await expect(page).toHaveURL(/\/shed\/$/);
  });

  test('S3: the score action is available only in the arcade', async ({ page }) => {
    const place = new Place(page);
    await place.open('arcade/');
    expect(await page.evaluate(() => window.__placeDebug.actions)).toEqual(['score']);
    await expect(page.getByRole('button', { name: 'score' })).toBeVisible();
    await place.open('vault/');
    expect(await page.evaluate(() => window.__placeDebug.actions)).toEqual([]);
    await expect(page.getByRole('button', { name: 'score' })).toHaveCount(0);
  });

  test('S4 + S5: the saved score stays, and the vault cannot read it', async ({ page }) => {
    const place = new Place(page);
    await place.open('arcade/');
    await page.getByRole('button', { name: 'score' }).click();
    await page.evaluate(() => window.__placeDebug.act('score'));
    await page.evaluate(() => window.__placeDebug.act('score'));
    expect(await place.debug(() => window.__placeDebug.store())).toEqual({ score: 3 });
    expect(await place.messages()).toContain('Score: 3');

    await place.walkTo('from=arcade');
    await expect(page).toHaveURL(/\?from=arcade$/);
    await place.ready();
    await place.walkTo('arcade', { x: 0, z: 0 });
    await expect(page).toHaveURL(/\/arcade\/$/);
    await place.ready();
    expect(await place.debug(() => window.__placeDebug.store())).toEqual({ score: 3 });
    await page.reload();
    await place.ready();
    expect(await place.debug(() => window.__placeDebug.store())).toEqual({ score: 3 });

    await place.open('vault/');
    expect(await place.messages()).toContain('score: null');
    expect(await place.debug(() => window.__placeDebug.store())).toEqual({});
  });
});

test.describe('BDR-012 broken pack stays contained', () => {
  test('S1 + S2: broken rules log [pack broken], and the exit still works', async ({ page }) => {
    const place = new Place(page);
    const res = await place.open('broken/');
    expect(res.status()).toBe(200);
    expect(await place.labels()).toContain('Back to Test Valley');
    expect(place.errors.some((e) => e.startsWith('[pack broken] onEnter:'))).toBe(true);
    // Risk R8: a throw in a child exterior gives a plain door frame, and the door still works.
    expect(await place.labels()).toContain('Cracked');
    expect(place.errors.some((e) => e.startsWith('[pack broken/cracked] exterior:'))).toBe(true);
    const cracked = await page.evaluate(() => window.__placeDebug.placed.find((s) => s.id === 'broken/cracked'));
    expect(Math.hypot(cracked.door.x - cracked.x, cracked.door.z - cracked.z)).toBeCloseTo(0.6, 3);

    await place.walkTo('?from=broken');
    await expect(page).toHaveURL(/\/\?from=broken$/);
  });

  test('risk R8 / E8: an async onEnter rejection is logged; onTick errors log one time', async ({ page }) => {
    const place = new Place(page);
    await place.open('broken/cracked/');
    await place.frames(4);
    const errors = await page.evaluate(() => window.__placeDebug.errors);
    expect(errors.filter((e) => e.phase === 'onEnter')).toHaveLength(1);
    expect(errors.filter((e) => e.phase === 'onTick')).toHaveLength(1);
    expect(place.errors.filter((e) => e.startsWith('[pack broken/cracked] onTick:'))).toHaveLength(1);
    await place.walkTo('from=broken%2Fcracked');
    await expect(page).toHaveURL(/\/broken\/\?from=broken%2Fcracked$/);
  });

  for (const path of packPaths(FIXTURE).filter((p) => !p.startsWith('broken/'))) {
    test(`S3: /${path} loads with no console error`, async ({ page }) => {
      const place = new Place(page);
      const res = await place.open(path);
      expect(res.status()).toBe(200);
      expect(place.errors).toEqual([]);
      expect(place.responses.filter((r) => r.status === 404)).toEqual([]);
    });
  }
});
