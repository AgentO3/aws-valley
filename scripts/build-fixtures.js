// Builds the extra test sites (design D19). Each one is the production config plus one overlay:
//   _site-fixture  tests/fixtures/fixture.yml  test packs for BDR-009..012
//   _site-button   tests/fixtures/button.yml   view_switch: key-and-button (BDR-008)
//   _site-url      tests/fixtures/url.yml      view_switch: url (BDR-008)
// Extra arguments go to each build, for example: npm run build:fixtures -- --baseurl /aws-valley
// Only _site/ is deployed (ADR-012).
import { spawnSync } from 'node:child_process';

const BUILDS = [
  ['tests/fixtures/fixture.yml', '_site-fixture'],
  ['tests/fixtures/button.yml', '_site-button'],
  ['tests/fixtures/url.yml', '_site-url']
];
const extra = process.argv.slice(2);

for (const [overlay, dest] of BUILDS) {
  const args = ['exec', 'jekyll', 'build', '--strict_front_matter', '--config', `_config.yml,${overlay}`];
  const run = spawnSync('bundle', [...args, '--destination', dest, ...extra], { stdio: 'inherit' });
  if (run.status !== 0) {
    console.error(`[build-fixtures] ${overlay} failed`);
    process.exit(run.status ?? 1);
  }
}
