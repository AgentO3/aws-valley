// The test server (scripts/serve-site.js) must answer like a static host: 404 for a bad path.
import { test, expect } from '@playwright/test';

test('a bad escape in the path gives 404, and the server keeps running', async ({ request, baseURL }) => {
  const bad = await request.get(`${baseURL}%`);
  expect(bad.status()).toBe(404);
  const ok = await request.get(baseURL);
  expect(ok.status()).toBe(200);
});
