# stack-cozy-engine

A base stack for a content-driven walkable 3D world. Each pack folder is one place. A visitor walks between places through doors and portals, on desktop or in VR.

The reference implementation is `aws-valley`. A new version of this stack keeps the architecture below. The theme, the models, the moods and the pack code can change.

## Spec set

| Layer | Spec | Question it answers |
| --- | --- | --- |
| `language` | `javascript` | Vanilla JS, no build step |
| `platform` | `jekyll` | Markdown pages become static HTML |
| `presentation` | `aframe` | A-Frame and three.js render each place |
| `delivery` | `static-hosting` | The host serves `_site/` over HTTPS |
| `delivery` | `github-actions` | CI builds, tests and deploys |
| `quality` | `playwright` | A browser loads each place |
| `practices` | `smoke-testing` | Each place renders, and each door has a target |
| `practices` | `3d-asset-pipeline` | Licenses, optimization and size budgets for models |
| `practices` | `git`, `conventional-commits`, `adr`, `bdr` | The baseline way of work |

## Architecture contract

[ADR-002](adr/002-pack-structure.md) gives the full pack structure.

### 1. Data flow

```
packs/**/index.md  ──_plugins/packs.rb──▶  page.place  ──Liquid jsonify──▶  window.PLACE (JSON)  ──engine.js──▶  A-Frame scene
                                                                                                    └─import()──▶  pack modules
```

- `_plugins/packs.rb` walks `packs/`. It makes one page for each pack, copies the pack files under the place URL, and sets `page.place`.
- The layout writes `page.place` as one JSON object with `jsonify`. Liquid does not write entity markup.
- `assets/js/engine.js` is an ES module. It reads `window.PLACE`, builds the core entities, and loads the pack modules with `import()`.
- One layout (`_layouts/place.html`) renders every place, and also the root place `packs/index.md`.

### 2. Place graph

- A pack is a folder under `packs/` that contains `index.md`. A subfolder with no `index.md` is an asset folder of its pack.
- The URL is the folder path. `packs/` is the root place `/`, and `packs/moon/moon-base/` is `/moon/moon-base/`.
- The parent is the folder that contains the pack. A place shows a door or a portal for each child pack and one exit to its parent.
- A pack folder name contains only `a-z`, `0-9` and `-`. The names `models`, `textures`, `sounds` and `lib` are reserved. A bad name stops the build.

### 3. Pack files and front matter keys

| File | Purpose | If the file does not exist |
| --- | --- | --- |
| `index.md` | Title, settings and sign text | The folder is not a place |
| `exterior.js` | The door or structure that the parent shows for this pack | A plain door frame |
| `interior.js` | The scene inside this place | An empty room |
| `rules.js` | The game rules and logic of this place | No extra rules |
| `CREDITS.md` | The licenses of the assets in this folder | Required if the folder has assets |

| Key | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `title` | string | yes | — | The name on the door and in the HUD. A missing title stops the build |
| `mood` | `golden` \| `moonlight` \| `hearth` \| `grotto` \| object | no | `golden` | Sky, light, fog and exposure. An object sets its own values over `golden` |
| `position` | `[x, y, z]` | no | arc layout | A fixed position in the parent, in metres. The engine ignores `y` |
| `size` | `{ ring, walk_limit, exit }` | no | ring `max(14, 4 × children)`, walk limit ring + 12, exit 9 | The child ring radius, the walk limit and the exit distance, in metres |

The Markdown body becomes the text on the sign in the place. A bad `mood` name, `position` or `size` stops the build. A symlink in a pack stops the build. The keys `type`, `biome` and `parent` are removed. The build ignores them and writes a warning.

### 4. `window.PLACE` shape

```js
{
  id, title, url, base, mood, position, size, text, viewSwitch,
  files: ['exterior.js' | 'interior.js' | 'rules.js'],
  parent: { id, title, url, mood } | null,
  children: [{ id, title, url, base, mood, position, files }]
}
```

`files` lists only the pack modules that exist. Thus an optional module that does not exist causes no failed request.

### 5. Engine extension points

A new place is a new pack folder. It does not change the core loop.

- `exterior.js`, `interior.js` and `rules.js` — the pack modules. Each module gets one `ctx` object with `root`, `model()`, `rng`, `store`, `say()` and `place`.
- `MOODS` in `engine.js` — the named presets for the light and air. A pack can set a mood object, so a new mood needs no engine change.
- A pack error logs `[pack <id>] <phase>: <message>`. The doors, the exit and the fade still work.

### 6. Navigation

- A door trigger fires when the camera comes within 1.3 m of the door point.
- A trigger fires only after the player has moved clear of all doors one time.
- The exit URL has `?from=<id>`. The parent page then puts the player in front of the door that they came out of.
- The page fades to black before it changes, and fades in after the first frame.

### 7. Test hooks

`window.__placeDebug` exposes `placed`, `triggers`, `go` and `pending()`. Smoke tests use this object to check that:

- each place loads with no `console.error`;
- `pending()` reaches 0;
- each child has a trigger with a URL that resolves;
- each non-root place has an exit trigger.

## Gaps in the reference implementation

On 2026-10-15, `aws-valley` closed the gaps that this section listed before:

- `Gemfile`, `Gemfile.lock` and `.ruby-version` pin Ruby 3.3.4 and Jekyll 4.4.1.
- `_config.yml` sets strict Liquid.
- The project is a git repository. `.github/workflows/ci.yml` builds, tests, deploys to GitHub Pages, and tests the live site.
- `tests/smoke.spec.js` holds the Playwright smoke tests.
- `scripts/optimize-model.sh` pins `@gltf-transform/cli` 4.5.1. The version for the older models is not known, and `CREDITS.md` says so.
- [ADR-002](adr/002-pack-structure.md) lists the pack files and the front matter keys.
- `engine.js` is an ES module.

These spec rules are still open:

- `language/javascript`: `engine.js` uses string concatenation and `Object.assign({}, ...)`.
- `practices/git`: signed commits, branch protection and a hook manager need forge and contributor setup.

## Headless test note

Headless Chromium uses SwiftShader. The scenes render at about 2 frames per second, so the tests use 2 workers. With bloom on, screenshots can be almost all black, but a hardware GPU renders them correctly. For headless visual checks, set `window.__bloom.enabled = false` first.

## Next steps (not in this scaffold)

- A front matter schema and a verify script for `packs/**/index.md`.
