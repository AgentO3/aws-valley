import { defineConfig, devices } from '@playwright/test';

const BASE = (process.env.SITE_BASE ?? '').replace(/\/$/, '');
// LIVE_URL points the tests at a deployed site. Then no local server starts, and only the prod project runs.
const LIVE_URL = process.env.LIVE_URL;

// One project for each build (design D19). Each build has its own server and port.
//   prod     _site/          production packs, view_switch: key
//   fixture  _site-fixture/  test packs for BDR-009..012
//   button   _site-button/   production packs, view_switch: key-and-button
//   url      _site-url/      production packs, view_switch: url
const SITES = [
  {
    name: 'prod',
    dir: '_site',
    port: 4100,
    testMatch: ['smoke.spec.js', 'view.spec.js', 'build.spec.js', 'load-failure.spec.js', 'lint-packs.spec.js']
  },
  { name: 'fixture', dir: '_site-fixture', port: 4101, testMatch: ['packs.spec.js'] },
  { name: 'button', dir: '_site-button', port: 4102, testMatch: ['view-button.spec.js'] },
  { name: 'url', dir: '_site-url', port: 4103, testMatch: ['view-url.spec.js'] }
].filter((site) => !LIVE_URL || site.name === 'prod');

const local = (site) => `http://127.0.0.1:${site.port}${BASE}/`;

export default defineConfig({
  testDir: 'tests',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Headless SwiftShader is CPU bound. More than 2 workers starve the scenes, and the model loads time out.
  workers: 2,
  // The root place loads in about 25 s on a GitHub runner, so 30 s per test is too short.
  timeout: 60_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'on-first-retry' },
  projects: SITES.map((site) => ({
    name: site.name,
    testMatch: site.testMatch,
    use: {
      ...devices['Desktop Chrome'],
      baseURL: LIVE_URL ? `${LIVE_URL.replace(/\/$/, '')}/` : local(site)
    }
  })),
  // Serve the built folders, so the tests check the same files that the deploy uploads.
  webServer: LIVE_URL
    ? undefined
    : SITES.map((site) => ({
        command: 'node scripts/serve-site.js',
        url: local(site),
        env: { PORT: String(site.port), SITE_BASE: BASE, SITE_DIR: site.dir },
        reuseExistingServer: !process.env.CI
      }))
});
