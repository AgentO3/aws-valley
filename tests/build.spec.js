// Build tests for _plugins/packs.rb (BDR-009, ADR-001). These tests run Jekyll on small temporary
// sites and read the output files. They need no browser.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test, expect } from '@playwright/test';

const ROOT = join(import.meta.dirname, '..');

// The live smoke test has no Ruby setup, so the build tests run only on a local checkout.
test.skip(!!process.env.LIVE_URL, 'build tests need Ruby and Jekyll');
test.describe.configure({ timeout: 120_000 });

// Makes a temporary site with the real layout, plugin and config, and the given pack files.
function site(packs) {
  const dir = mkdtempSync(join(tmpdir(), 'cozy-packs-'));
  for (const name of ['_config.yml', '_layouts', '_plugins', '404.html']) {
    cpSync(join(ROOT, name), join(dir, name), { recursive: true });
  }
  for (const [path, body] of Object.entries(packs)) {
    mkdirSync(dirname(join(dir, 'packs', path)), { recursive: true });
    writeFileSync(join(dir, 'packs', path), body);
  }
  return dir;
}

function build(dir) {
  const run = spawnSync(
    'bundle',
    ['exec', 'jekyll', 'build', '--strict_front_matter', '-s', dir, '-d', join(dir, 'out')],
    {
      cwd: ROOT,
      encoding: 'utf8'
    }
  );
  return { status: run.status, output: `${run.stdout}\n${run.stderr}` };
}

function place(dir, path) {
  const html = readFileSync(join(dir, 'out', path, 'index.html'), 'utf8');
  const json = html.match(/window\.PLACE = Object\.assign\((\{.*?\}), \{\n/s)[1];
  return JSON.parse(json);
}

const page = (title, body = '') => `---\ntitle: ${title}\n---\n${body}\n`;

test('BDR-009 S5: a bad pack folder name stops the build and names the folder', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cozy-bad-'));
  const overlay = join(dir, 'bad.yml');
  writeFileSync(overlay, 'packs_dir: tests/fixtures/bad-packs\n');
  const run = spawnSync(
    'bundle',
    ['exec', 'jekyll', 'build', '--config', `_config.yml,${overlay}`, '-d', join(dir, 'out')],
    { cwd: ROOT, encoding: 'utf8' }
  );
  expect(run.status).not.toBe(0);
  expect(`${run.stdout}${run.stderr}`).toContain('bad pack folder name "Bad Name"');
  rmSync(dir, { recursive: true, force: true });
});

for (const bad of ['models', 'pips_house', 'Pips']) {
  test(`BDR-009 S5: the folder name "${bad}" stops the build`, () => {
    const dir = site({ 'index.md': page('Root'), [`${bad}/index.md`]: page('Bad') });
    const run = build(dir);
    expect(run.status).not.toBe(0);
    expect(run.output).toContain(`bad pack folder name "${bad}"`);
    rmSync(dir, { recursive: true, force: true });
  });
}

test('BDR-009 S1 + S3: add a pack folder, then remove it', () => {
  const dir = site({ 'index.md': page('Root'), 'pipshouse/index.md': page('Pips House', 'Hello.') });
  expect(build(dir).status).toBe(0);
  expect(existsSync(join(dir, 'out', 'pipshouse', 'index.html'))).toBe(true);
  expect(place(dir, '').children.map((c) => c.title)).toEqual(['Pips House']);

  rmSync(join(dir, 'packs', 'pipshouse'), { recursive: true });
  expect(build(dir).status).toBe(0);
  expect(existsSync(join(dir, 'out', 'pipshouse', 'index.html'))).toBe(false);
  expect(place(dir, '').children).toEqual([]);
  rmSync(dir, { recursive: true, force: true });
});

test('E12: three levels of nesting give the folder path as URL, ID and parent', () => {
  const dir = site({
    'index.md': page('Root'),
    'a/index.md': page('A'),
    'a/b/index.md': page('B'),
    'a/b/c/index.md': page('C'),
    'a/b/c/models/x.glb': 'glb',
    'a/b/c/exterior.js': 'export default () => ({});\n'
  });
  expect(build(dir).status).toBe(0);
  const c = place(dir, 'a/b/c');
  expect(c.id).toBe('a/b/c');
  expect(c.url).toBe('/a/b/c/');
  expect(c.parent).toMatchObject({ id: 'a/b', title: 'B', url: '/a/b/' });
  expect(c.files).toEqual(['exterior.js']);
  expect(place(dir, 'a/b').children.map((k) => k.id)).toEqual(['a/b/c']);
  expect(existsSync(join(dir, 'out', 'a', 'b', 'c', 'models', 'x.glb'))).toBe(true);
  expect(existsSync(join(dir, 'out', 'a', 'b', 'c', 'models', 'index.html'))).toBe(false);
  rmSync(dir, { recursive: true, force: true });
});

test('FR-A1.1: a pack with no title stops the build', () => {
  const dir = site({ 'index.md': page('Root'), 'shed/index.md': '---\nmood: golden\n---\n' });
  const run = build(dir);
  expect(run.status).not.toBe(0);
  expect(run.output).toContain('packs/shed/index.md has no title');
  rmSync(dir, { recursive: true, force: true });
});

test('design D4: a pack below an asset folder stops the build', () => {
  const dir = site({ 'index.md': page('Root'), 'stuff/inner/index.md': page('Inner') });
  const run = build(dir);
  expect(run.status).not.toBe(0);
  expect(run.output).toContain('stuff/inner has no parent pack');
  rmSync(dir, { recursive: true, force: true });
});

test('FR-8.6: an unknown view_switch gives "key" with a warning', () => {
  const dir = site({ 'index.md': page('Root') });
  writeFileSync(join(dir, '_config.yml'), `${readFileSync(join(dir, '_config.yml'), 'utf8')}\nview_switch: sideways\n`);
  const run = build(dir);
  expect(run.status).toBe(0);
  expect(run.output).toContain('unknown view_switch "sideways"');
  expect(readFileSync(join(dir, 'out', 'index.html'), 'utf8')).toContain('viewSwitch: "key"');
  rmSync(dir, { recursive: true, force: true });
});

test('E14: pack URLs include the base path', () => {
  const dir = site({ 'index.md': page('Root'), 'shed/index.md': page('Shed') });
  const run = spawnSync(
    'bundle',
    ['exec', 'jekyll', 'build', '-s', dir, '-d', join(dir, 'out'), '--baseurl', '/aws-valley'],
    { cwd: ROOT, encoding: 'utf8' }
  );
  expect(run.status).toBe(0);
  const shed = place(dir, 'shed');
  expect(shed.url).toBe('/aws-valley/shed/');
  expect(shed.base).toBe('/aws-valley/shed/');
  expect(shed.parent.url).toBe('/aws-valley/');
  rmSync(dir, { recursive: true, force: true });
});

const mood = (value) => `---\ntitle: Shed\nmood: ${value}\n---\n`;

for (const bad of ['{ sunDir: 5 }', '{ hemiI: loud }', '{ fog: 12 }', '{ ground: ["#111"] }', '{ sunn: 1 }']) {
  test(`red team: the mood object ${bad} stops the build`, () => {
    const dir = site({ 'index.md': page('Root'), 'shed/index.md': mood(bad) });
    const run = build(dir);
    expect(run.status).not.toBe(0);
    expect(run.output).toContain('packs/shed/index.md: mood');
    rmSync(dir, { recursive: true, force: true });
  });
}

test('red team: a mood object with valid values builds', () => {
  const dir = site({
    'index.md': page('Root'),
    'shed/index.md': mood('{ sunI: 1.5, sunDir: [0, 1, 0], fog: "#112233", ground: ["#111111", "#222222"] }')
  });
  expect(build(dir).status).toBe(0);
  rmSync(dir, { recursive: true, force: true });
});

test('red team: a root pack file named 404.html stops the build', () => {
  const dir = site({ 'index.md': page('Root'), '404.html': '<p>mine</p>' });
  const run = build(dir);
  expect(run.status).not.toBe(0);
  expect(run.output).toContain('give the same URL /404.html');
  rmSync(dir, { recursive: true, force: true });
});

for (const bad of ['models/a#b.glb', 'models/100%25.glb', 'models/a b.glb', 'models/a?b.glb']) {
  test(`red team: the pack file name "${bad}" stops the build`, () => {
    const dir = site({ 'index.md': page('Root'), [bad]: 'glb' });
    const run = build(dir);
    expect(run.status).not.toBe(0);
    expect(run.output).toContain('bad file name');
    rmSync(dir, { recursive: true, force: true });
  });
}
