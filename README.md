# AWS Valley

A walkable 3D world. Each Markdown page in `_places/` is one place. Walk through doors and portals between places, on desktop or in VR.

This project uses the `cozy-engine` stack from `stackable-specs`.

- Architecture contract: [`docs/architecture.md`](docs/architecture.md)
- Specs: [`docs/specs/`](docs/specs/)
- Architecture Decision Records: [`docs/adr/`](docs/adr/README.md)
- Model credits and the optimize command: [`assets/models/CREDITS.md`](assets/models/CREDITS.md)

## Setup

You need Ruby 3.3.4 (see `.ruby-version`) and Node.js 24.

```sh
bundle install
npm ci
npx playwright install chromium
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run serve` | Runs the site at http://127.0.0.1:4000/ with live reload |
| `npm run build` | Builds `_site/` with strict front matter and strict Liquid |
| `npm test` | Builds the site, then runs the Playwright smoke tests on `_site/` |
| `npm run lint` | Runs ESLint |
| `npm run format:check` | Checks the format with Prettier |
| `scripts/optimize-model.sh <in> <out>` | Optimizes one model and checks the 300 KB budget |

## Add a place

1. Add a file `_places/<slug>.md`.
2. Set `title` and `parent`. See [ADR-001](docs/adr/001-place-model.md) for all keys.
3. Run `npm test`. The smoke tests find the new place automatically.

## Deploy

CI (`.github/workflows/ci.yml`) builds the site one time, then runs the smoke tests on that build. A push to `main` deploys the same build to GitHub Pages. After the deploy, CI runs the smoke tests again on the live URL.

## Note on headless screenshots

Headless Chromium uses a software GPU (SwiftShader). With bloom on, headless screenshots can be almost all black. The app is correct on a hardware GPU. For a headless visual check, set `window.__bloom.enabled = false` first. The smoke tests do not compare pixels, so this problem does not affect them.
