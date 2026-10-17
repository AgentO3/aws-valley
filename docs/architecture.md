# stack-cozy-engine

A base stack for a content-driven walkable 3D world. Each Markdown page is one place. A visitor walks between places through doors and portals, on desktop or in VR.

The reference implementation is `aws-valley`. A new version of this stack keeps the architecture below. The theme, the models, the moods and the place types can change.

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

### 1. Data flow

```
_places/*.md  ──Liquid (data only)──▶  window.PLACE (JSON)  ──engine.js──▶  A-Frame scene
```

- Liquid collects the page, its parent and its children. Liquid writes them as one JSON object with `jsonify`.
- `assets/js/engine.js` reads `window.PLACE` and builds all entities. Liquid does not write entity markup.
- One layout (`_layouts/place.html`) renders every place, and also the root page `index.md`.

### 2. Place graph

- The root page (`index.md`) has the ID `index`.
- Each file in the `places` collection is one place. Its ID is the file slug.
- `parent` makes a tree. A place shows a door or a portal for each child and one exit to its parent.
- An unknown `parent` gives `{ missing: "<slug>" }`. The engine logs a `[place]` warning, and the place has no exit.

### 3. Front matter keys

| Key | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `title` | string | yes | — | The name on the door and in the HUD |
| `type` | `world` \| `house` \| `cave` | no | `world` | The prefab outside, and the interior inside |
| `parent` | slug \| `index` | yes, except on root | — | The place that contains this place |
| `mood` | key of `MOODS` | no | from `type` | Sky, light, fog and exposure |
| `biome` | string | no | — | The decoration set for a `world` |
| `position` | `[x, y, z]` | no | arc layout | A fixed position in the parent, in metres. The engine ignores `y`, because structures stand on the ground |

The Markdown body becomes the text on the sign in the place.

### 4. `window.PLACE` shape

```js
{
  id, type, title, text, mood, biome,
  parent: { id, title, mood, url } | { missing } | null,
  children: [{ id, title, type, url, position, mood }]
}
```

### 5. Engine extension points

A new version changes these tables. It does not change the core loop.

- `KINDS` — the size of each place type: child ring radius, walk limit, exit distance.
- `MOODS` — the light and air for each mood.
- `PREFABS` — the structure for each child type. Each prefab faces +Z and has its door on the +Z side.
- Biome decoration — the models to scatter for each biome.

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
- [ADR-001](adr/001-place-model.md) lists the front matter keys.

These spec rules are still open:

- `language/javascript`: `engine.js` is an IIFE script, not an ES module. It also uses string concatenation and `Object.assign({}, ...)`.
- `practices/git`: signed commits, branch protection and a hook manager need forge and contributor setup.

## Headless test note

Headless Chromium uses SwiftShader. With bloom on, screenshots can be almost all black, but a hardware GPU renders them correctly. For headless visual checks, set `window.__bloom.enabled = false` first.

## Next steps (not in this scaffold)

- ADRs: the choice of A-Frame over raw three.js, and Jekyll over a JS generator.
- BDRs: "walk through a door", "return through an exit", "enter VR".
- A front matter schema and a verify script for `_places/*.md`.
