// Pack isolation (ADR-001, NFR-8). A pack uses ctx and its imports. ESLint must reject each global
// that gives a pack the page, the storage or the network. These tests need no browser and no Jekyll.
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { test, expect } from '@playwright/test';

const ROOT = join(import.meta.dirname, '..');
const eslint = new ESLint({ cwd: ROOT });

async function messages(code, file) {
  const [result] = await eslint.lintText(code, { filePath: join(ROOT, file) });
  return result.messages.map((m) => m.ruleId);
}

for (const name of ['window', 'globalThis', 'self', 'top', 'parent', 'frames', 'location', 'history']) {
  test(`lint: a pack cannot read the global "${name}"`, async () => {
    expect(await messages(`export default () => ${name}.x;\n`, 'packs/shed/interior.js')).toContain(
      'no-restricted-globals'
    );
  });
}

for (const name of ['fetch', 'XMLHttpRequest', 'localStorage']) {
  test(`lint: a pack cannot call the global "${name}"`, async () => {
    expect(await messages(`export default () => ${name}('x');\n`, 'packs/shed/rules.js')).toContain(
      'no-restricted-globals'
    );
  });
}

test('lint: the same rule covers the test fixture packs', async () => {
  expect(await messages('export default () => globalThis.x;\n', 'tests/fixtures/packs/a/interior.js')).toContain(
    'no-restricted-globals'
  );
});

test('lint: the core engine may use globals', async () => {
  expect(await messages('export const x = globalThis.y;\n', 'assets/js/engine.js')).not.toContain(
    'no-restricted-globals'
  );
});
