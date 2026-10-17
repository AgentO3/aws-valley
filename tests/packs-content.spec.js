// Content tests for packs/ (practices/3d-asset-pipeline rules 7 and 11). These tests read files
// and need no browser and no Jekyll.
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

const PACKS = join(import.meta.dirname, '..', 'packs');
const MAX_MODEL = 300 * 1024;
const MAX_PAGE_MODELS = 3 * 1024 * 1024;

// Returns the .glb files below a folder.
function models(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return models(path);
    return entry.name.endsWith('.glb') ? [path] : [];
  });
}

const topPacks = readdirSync(PACKS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

for (const name of topPacks) {
  test(`pack ${name}: has CREDITS.md`, () => {
    expect(existsSync(join(PACKS, name, 'CREDITS.md'))).toBe(true);
  });

  test(`pack ${name}: each model is 300 KB or smaller and the total is 3 MB or smaller`, () => {
    const sizes = models(join(PACKS, name)).map((path) => [path, statSync(path).size]);
    for (const [path, size] of sizes) {
      expect(size, path).toBeLessThanOrEqual(MAX_MODEL);
    }
    const total = sizes.reduce((sum, [, size]) => sum + size, 0);
    expect(total).toBeLessThanOrEqual(MAX_PAGE_MODELS);
  });
}
