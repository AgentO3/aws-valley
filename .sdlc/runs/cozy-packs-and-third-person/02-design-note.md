# Design Note — cozy-packs-and-third-person

| Field | Value |
| --- | --- |
| Run slug | `cozy-packs-and-third-person` |
| Gate | 2 — Design |
| Inputs | `contract.md`, `01-requirements-brief.md`, stack ADR-001..013, BDR-001..012 |
| Decisions to implement | ADR-001 (pack structure), ADR-013 (view switch) |
| Risk formula | Impact + Likelihood (frozen in `state.md`) |
| Risk score | 6 (Impact 3, Likelihood 3) |
| Date | 2026-10-15 |

This note does not change the stack docs. Where an ADR does not give a detail, this note decides it. Section 9 lists each decision.

## 1. Current state

| Area | Now | File |
| --- | --- | --- |
| Content | `_places` collection (4 files) and root `index.md`. Keys `title`, `type`, `parent`, `mood`, `biome`, `position`. | `_places/*.md`, `index.md`, `_config.yml` |
| Tree | Liquid finds children with `where: "parent"`. The parent is a slug. | `_layouts/place.html` |
| Page data | `window.PLACE` = `{ id, type, title, text, mood, biome, parent, children }`, written with `jsonify`. | `_layouts/place.html` |
| Engine | One classic-script IIFE, 964 lines. Tables `KINDS`, `MOODS`, `PREFABS`. Interiors `buildHouseInterior`, `buildCaveInterior`. Biome `moon` branch in `decorate`. | `assets/js/engine.js` |
| Door triggers | `place-player` component on `#cam`. Camera world position, radius 1.3 m, arm rule. `go(url)` fades, then navigates after 400 ms. | `engine.js` 812-851 |
| Spawn | `?from=<id>` puts the camera 3 m in front of that child door. | `engine.js` 853-874 |
| Debug hook | `__placeDebug = { placed, triggers, go, pending }`. | `engine.js` 948 |
| Bloom | ES module, skipped in VR. | `assets/js/bloom.js` |
| Models | Shared kits `nature/` (2.1 MB), `village/` (240 KB), `furniture/` (148 KB), one `CREDITS.md`. | `assets/models/` |
| Tests | Smoke tests list `_places/*.md`. Page object `Place` with `walkTo` that moves `#cam`. | `tests/` |
| Serve | Static server for `_site/` with media types. | `scripts/serve-site.js` |
| CI | Build once with `--baseurl`, lint, Playwright, upload `_site/`, deploy, live smoke test. | `.github/workflows/ci.yml` |
| Local ADR | `docs/adr/001-place-model.md` describes the `_places` model. | `docs/adr/` |

### ADR-002..012 verification (code reading; gate 5 confirms with tests)

| ADR | Result | Note |
| --- | --- | --- |
| 002 A-Frame | conforms | A-Frame 1.7.0 from a pinned URL. |
| 003 Jekyll | conforms | Jekyll 4.4. The new plugin needs the Actions build (ADR-012 already uses it). |
| 004 One page per place | conforms | Kept. The plugin makes one page per pack. |
| 005 Data-only templates | conforms | `jsonify` only. Kept. |
| 006 No JS build step | **gap** | `engine.js` is a classic script, not an ES module. Closed by this change (D7). |
| 007 Proximity triggers | conforms | 1.3 m, arm rule. Extended to the avatar (D15). |
| 008 Deterministic layout | conforms | `rng(hash(id))`. The seed source becomes the pack ID. |
| 009 GLB with meshopt | conforms | Pack-local models are copies of the existing optimized GLBs. The 3 MB page budget holds (D5). |
| 010 Bloom and tone mapping | conforms | No change. Third person uses the same renderer path. |
| 011 Debug hook and smoke tests | conforms | Extended with new read-only fields (D17). The smoke tests list `packs/`. |
| 012 Pages, build once | conforms | Fixture builds go to other folders. Only `_site/` is uploaded. |

## 2. Gap analysis

| Desired (ADR / BDR) | Current | Gap |
| --- | --- | --- |
| `packs/<path>/index.md` is a place at `/<path>/` (BDR-009) | `_places` flat collection, `parent:` key | Plugin, migration, layout change |
| Folder-name validation stops the build (BDR-009 AC-5) | none | Plugin check |
| Pack files under the place URL (BDR-009 AC-4) | none | Plugin static-file copy |
| `exterior.js`, `interior.js`, `rules.js` with `ctx` (ADR-001) | tables and builders in the core | Module loader, `ctx`, extract place code into packs |
| Defaults with only `index.md`, no 404 (BDR-010) | type defaults | Core plain door frame, empty room, file list |
| Rules hooks, locked doors, actions, private store (BDR-011) | none | Rules runtime |
| Error containment `[pack <id>]` (BDR-012) | none | `try`/`catch` per module and per hook |
| `view_switch`, avatar, follow camera, stored view (BDR-008, ADR-013) | first person only | View module, avatar, trigger source switch |
| Exit `?from=` with a nested ID (BDR-003) | flat slug | ID = folder path, URL-encoded (already `encodeURIComponent`) |
| Tests for BDR-008..012 | none | Fixture builds, new specs |

## 3. Solution options

### Area A — How the build makes pack pages

**A1. Generator plugin with `Jekyll::Page` subclasses (recommended).** `packs/` is in `exclude`, so the normal reader skips it. `_plugins/packs.rb` walks the folder from disk. For each pack it makes a `PackPage` (a `Jekyll::Page` read from `packs/<path>/index.md`, with `permalink` set to `/<path>/`). It adds a `PackFile` (a `Jekyll::StaticFile` with an overridden destination) for each other file.

- Pro: matches ADR-001 "Build" exactly. Jekyll reads front matter, so `--strict_front_matter` and Liquid strict mode still apply.
- Pro: the plugin owns the tree. Parent and children come from folders, not Liquid `where` queries.
- Con: depends on two Jekyll internals (`Page#initialize` signature, `StaticFile#destination`). Both are stable in Jekyll 4.x.

**A2. A `packs` collection with a `post_read` hook that rewrites URLs.**

- Pro: less custom code for the page read.
- Con: collection documents get `/packs/...` paths and collection-relative names. The hook must rewrite `url`, `permalink` and the static-file destinations. Asset folders become collection files and need a filter. More hidden behavior.
- Con: ADR-001 records that a collection `permalink` cannot make these URLs.

**A3. A Node pre-build script that writes `_places/*.md` from `packs/`.**

- Pro: no Ruby.
- Con: a second build step and generated files in the source tree. ADR-001 names a Jekyll generator plugin. Rejected.

### Area B — Where shared scene helpers live

**B1. A core helper module `assets/js/kit.js`, imported by packs as `cozy/kit.js` through the import map (recommended).** It holds generic helpers only: materials, `lantern`, `portalDisc`, `sky`, `ground`, `heightAt`, `fireflies`, `scatterRing`, `animate`.

- Pro: no duplicated helper code. The import map makes the URL independent of `baseurl`.
- Pro: an import is not a global variable. The `ctx` rule holds.
- Con: a pack that uses `cozy/kit.js` needs a world that has the kit. This is a smaller form of the "copy a pack into a different world" promise.

**B2. Copy the helpers into each pack (`packs/<path>/lib/`).**

- Pro: each pack is fully self-contained.
- Con: four copies of the same 150 lines. A fix must go into four files.

**B3. Add the helpers to `ctx` (for example `ctx.kit`).**

- Pro: no import.
- Con: changes the `ctx` contract of ADR-001. Rejected.

### Area C — Third person movement model

**C1. The camera stays the controlled body. The avatar leads the camera at a fixed distance (recommended).** `wasd-controls` and `look-controls` stay on `#cam`. In third person, the engine computes a "body point" 2.5 m in front of the camera on the ground plane, along the camera yaw. The avatar is drawn at the body point. The walk limit clamps the body point. The camera is then set to the body point minus 2.5 m along the yaw.

- Pro: no change to the A-Frame control components. The camera is behind the avatar by construction (BDR-008 AC-2).
- Pro: switching back to first person only moves the camera to the body point.
- Con: the camera can go through a wall in a small room. Accepted for this run (ADR-013 defers the camera distance).

**C2. Move the controls to a new `#player` entity, and make the camera a child with an offset.**

- Pro: a conventional follow-camera rig.
- Con: `wasd-controls` moves along its own entity rotation, and `look-controls` turns the camera. A yaw bridge component is necessary. VR needs the camera back at the rig origin. More change to verified code.

### Area D — Test builds for fixtures and other `view_switch` values

**D-1. Config overlays and separate output folders, one Playwright project per build (recommended).** The plugin reads `packs_dir` (default `packs`). Overlays: `tests/fixtures/fixture.yml` (`packs_dir: tests/fixtures/packs`), `tests/fixtures/button.yml` (`view_switch: key-and-button`), `tests/fixtures/url.yml` (`view_switch: url`). Outputs `_site-fixture/`, `_site-button/`, `_site-url/`. `serve-site.js` takes `SITE_DIR`.

- Pro: production `packs/` stays free of test packs. One test runner.
- Con: four Jekyll builds in CI (each is a few seconds).

**D-2. Put test packs in production `packs/` under a hidden branch of the world.**

- Pro: one build.
- Con: test packs ship to visitors. Rejected (brief A1).

## 4. Tradeoff analysis

| Criterion | A1 | A2 | B1 | B2 | C1 | C2 | D-1 | D-2 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Complexity | medium | high | low | low | low | high | medium | low |
| Risk | low | medium | low | low | low | medium | low | medium |
| Fit with ADRs | exact | partial | good | exact | good | good | good | poor |
| Maintainability | good | poor | good | poor | good | medium | good | poor |
| Security | same | same | same | same | same | same | same | test code shipped |
| Performance | same | same | 1 extra small module | same | same | same | n/a | n/a |
| Rollout safety | good | good | good | good | good | medium | good | poor |

Chosen: **A1, B1, C1, D-1.**

## 5. Recommended design

### 5.1 Architecture

```
packs/**/index.md ──► _plugins/packs.rb (Generator)
                        │  validate names, read front matter, build tree
                        ├─► PackPage  /<path>/  layout: place, data.place = {…}
                        └─► PackFile  /<path>/<file> (all non-index files)
_layouts/place.html ──► window.PLACE = page.place + text + viewSwitch
                        import map: three, three/addons/, cozy/
assets/js/engine.js (ES module, core)
   ├─ imports ./kit.js (shared helpers, animate list)
   ├─ imports ./view.js (view switch, avatar, body point)
   ├─ import() child exterior.js files  ─► ctx per child
   ├─ import() own interior.js          ─► ctx of this pack
   └─ import() own rules.js             ─► hooks, triggers, actions
assets/js/bloom.js (unchanged)
```

Core files after the change:

| File | Role | Place-specific code |
| --- | --- | --- |
| `assets/js/engine.js` | Boot, `MOODS`, layout, module loader, `ctx`, default door frame, default room, sign, exit, triggers, fade, rules runtime, debug hook | none |
| `assets/js/kit.js` | Generic helpers for packs and the core | none |
| `assets/js/view.js` | `view_switch`, stored view, avatar, follow camera, VR override | none |
| `assets/js/bloom.js` | Unchanged | none |

`KINDS`, `PREFABS`, `buildHouseInterior`, `buildCaveInterior` and the `biome` branch leave the core (M3). `MOODS` stays in the core, because ADR-001 keeps `mood` as a named preset.

### 5.2 Migration of the places

| Old | New folder | URL | Files |
| --- | --- | --- | --- |
| `index.md` (world, golden) | `packs/` | `/` | `index.md`, `interior.js` (sky, ground, paths, trees, flowers, fireflies) |
| `_places/cozy-house.md` (house) | `packs/cozy-house/` | `/cozy-house/` | `index.md` (`mood: hearth`, `size`), `exterior.js` (home A/B, lantern, barrel, crate), `interior.js` (house room), `models/`, `CREDITS.md` |
| `_places/crystal-cave.md` (cave) | `packs/crystal-cave/` | `/crystal-cave/` | `index.md` (`mood: grotto`, `size`), `exterior.js` (mine), `interior.js` (cave), `models/`, `CREDITS.md` |
| `_places/moon.md` (world, moonlight, biome moon) | `packs/moon/` | `/moon/` | `index.md` (`mood: moonlight`), `exterior.js` (portal), `interior.js` (moon sky, ground, rocks, pebbles; portal exit) |
| `_places/moon-base.md` (house, position) | `packs/moon/moon-base/` | `/moon/moon-base/` | `index.md` (`mood: hearth`, `position: [8, 0, -6]`, `size`), `exterior.js` (home), `interior.js` (house room), `models/`, `CREDITS.md` |

Sizes from the old `KINDS` table: house `{ ring: 3, walk_limit: 3.6, exit: 4.2 }`, cave `{ ring: 6, walk_limit: 10, exit: 9 }`. Open-world default: `{ ring: max(14, 4 × children), walk_limit: ring + 12, exit: 9 }`.

Remove `_places/`, root `index.md`, the `collections` and `defaults` blocks in `_config.yml`. Add `packs` to `exclude`. Mark `docs/adr/001-place-model.md` as "Superseded by stack ADR-001" and add a local note that records D1..D20.

### 5.3 Models (decision D5)

- Place-specific models move into the pack that uses them: `village/building_home_*`, `barrel`, `crate_A_small` and `furniture/*` into `cozy-house/models/` and `moon/moon-base/models/`; `village/building_mine_blue` into `crystal-cave/models/`. Each pack with models gets a `CREDITS.md` (FR-A1.4).
- The `nature/` kit stays at `assets/models/nature/` as the site kit. Reason: BDR-006 requires `/assets/models/nature/Pine_1.glb`, and two copies of 2.1 MB break no rule but waste space. `assets/models/CREDITS.md` keeps only the `nature/` row.
- `ctx.model(path)`: a relative path resolves against the pack URL. A path that starts with `/` resolves against the site base. This is an extension of ADR-001, recorded as a follow-up for the stack maintainers.
- Page budget: the root page loads `nature/` plus the child exteriors (about 2.5 MB). Under 3 MB (NFR-1). Gate 5 measures it.

## 6. Design detail

### 6.1 Build plugin — `_plugins/packs.rb`

- `Packs::Generator < Jekyll::Generator`, `priority :highest`, `safe true`. Standard library only (no new gem).
- Source folder: `site.config['packs_dir'] || 'packs'`, relative to `site.source`.
- Walk rules, in this order:
  1. `packs/index.md` must exist. Else `Jekyll::Errors::FatalException`: `packs: no index.md in <dir>`.
  2. A folder that contains `index.md` is a pack. Its ID is the path under the packs folder (`moon/moon-base`). The root ID is `/` (decision D3).
  3. For each pack folder below the root, each path segment must match `\A[a-z0-9-]+\z` and must not be `models`, `textures`, `sounds` or `lib`. Else fatal: `packs: bad pack folder name "<segment>" in <relative path>`. The message contains the exact folder name (BDR-009 AC-5).
  4. A pack whose containing folder is not a pack is a fatal error: `packs: <id> has no parent pack (<folder> has no index.md)` (D4).
  5. A folder with no `index.md` is an asset folder. It gives no page and no door (BDR-009 AC-3).
  6. Dotfiles and dot-folders are skipped.
- Front matter: Jekyll reads it in `PackPage`. `title` missing or empty → fatal `packs: <id>/index.md has no title`. `type`, `biome` or `parent` present → `Jekyll.logger.warn` (removed keys).
- `PackPage < Jekyll::Page`: `super(site, site.source, '<packs_dir>/<path>', 'index.md')`, then `data['layout'] ||= 'place'`, `data['permalink'] = '/<path>/'`, `data['place'] = <place hash>`.
- `PackFile < Jekyll::StaticFile`: overrides `destination(dest)` and `url` to `/<path>/<relative file>`. All non-`index.md` files of the pack and its asset folders are copied. Files in a child pack belong to that child.
- `view_switch`: the plugin sets `site.config['view_switch']` to `key`, `key-and-button` or `url`. Any other value or no value gives `key`, with a warning if a value was set (FR-8.6).
- URLs in the place hash include `site.baseurl` (same result as `relative_url`), so the layout writes the hash with one `jsonify`.

### 6.2 Page data contract — `window.PLACE`

```js
window.PLACE = {
  id: 'moon/moon-base',            // '/' for the root
  title: 'Moon Base',
  url: '/moon/moon-base/',         // with baseurl
  base: '/moon/moon-base/',        // URL prefix of the pack files
  mood: 'hearth',                  // name or object
  size: { ring: 3, walk_limit: 3.6, exit: 4.2 },   // only the keys the author set
  position: [8, 0, -6],            // or null
  files: ['exterior.js', 'interior.js'],           // module files that exist
  text: 'A house on the Moon. …',  // from the layout (strip_html, normalize_whitespace)
  viewSwitch: 'key',               // from the layout (normalized site setting)
  parent: { id: 'moon', title: 'The Moon', url: '/moon/', mood: 'moonlight' },  // null at the root
  children: [ { id, title, url, base, mood, position, files } ]                 // sorted by folder name
};
```

`files` lists only `exterior.js`, `interior.js` and `rules.js` when they exist. The engine imports only listed files (BDR-010 AC-4). The layout writes the hash with `jsonify` (ADR-005, NFR-6).

Layout changes (`_layouts/place.html`): remove the Liquid tree queries and the `kit-base` meta. Script tag for the engine becomes `type="module"`. The import map gets `'cozy/': '{{ "/assets/js/" | relative_url }}'`. The HUD text is `<title> · WASD to move · click to look`, plus ` · V to switch view` when `view_switch` is `key` or `key-and-button` (brief A6). With `key-and-button`, the layout adds `<button id="view-btn" type="button" aria-pressed="false">Third person view</button>` (NFR-10). A `<div id="say" role="status" aria-live="polite">` shows `ctx.say` messages. A `<div id="actions">` holds action buttons.

### 6.3 Module contract and `ctx`

Each module gets its own `ctx`:

| Field | Value |
| --- | --- |
| `root` | A `THREE.Group`. For `exterior.js`, it is placed at the child position and turned so that +Z faces the parent center. For `interior.js` and `rules.js`, it is the place group. |
| `model(path, options)` | Returns `Promise<THREE.Object3D>`. Loads once per URL and clones. Options: `x, y, z, r, s, sy, cast, receive, instances`. `instances: [{x,y,z,r,s,sy}]` draws an `InstancedMesh` (ADR-009). Increments the `pending` counter. A failed load logs `[pack <id>] model <path>: <error>` and resolves to an empty group. |
| `rng` | `rng(hash(<pack id>))`, a new generator for each `ctx` (ADR-008). |
| `store` | `get(key)`, `set(key, value)`, `remove(key)`. `localStorage` key `cozy:pack:<id>:<key>`, JSON values. If `localStorage` throws, an in-memory map is used and no error is logged (NFR-4). `get` of an absent key returns `null`. |
| `say(text)` | Shows text in `#say` for 4 s, and appends it to `__placeDebug.messages`. Text is set with `textContent` (no markup). |
| `place` | `Object.freeze` copy of `window.PLACE` plus `mood` (the resolved mood object) and `layout` (door positions, see 6.4). |

Return values:

- `exterior(ctx)` → `{ door, labelHeight }`. A missing or bad number gives the plain-frame values `{ door: 0.6, labelHeight: 3.2 }`.
- `interior(ctx)` → `undefined`, or an optional object `{ sign: { position, rotation }, exit: function(ctx) }` (decision D10). `exit` builds the exit structure like an `exterior`. The moon uses it for its portal back to the valley. The default exit is the plain door frame.
- `rules` default export: `{ onEnter, onExit, onTick, canEnter, triggers, actions }`, each optional.

### 6.4 Engine load sequence

1. Resolve the mood: a name → `MOODS[name]`, an object → merge over `MOODS.golden`, absent → `golden`. A mood may have `background` (hearth `#1a120c`, grotto `#05080a`). With `background`, the scene has a solid background color.
2. Set renderer exposure, shadows, lights, fog from the mood.
3. In parallel, `import()` each child `exterior.js` (from `child.base`) and this pack's `interior.js` and `rules.js`, as listed in `files`. Use `Promise.allSettled`. A rejected import logs `[pack <id>] <file>: <error>` and gives the default.
4. Run each child exterior in `try`/`catch`. A throw → `[pack <child id>] exterior: <error>`, remove the partial group, draw the plain door frame (E7).
5. Lay out the children (arc or `position`) with the returned `door` offsets. Compute door points. Add labels.
6. Run `interior(ctx)` in `try`/`catch`. A throw or no `interior.js` → default empty room: a floor disc and a ring of low walls at `walk_limit`, with the mood colors (BDR-010 AC-3).
7. Build the exit (from `interior` result or the default frame) at `size.exit`, labelled `Back to <parent title>`, with the URL `<parent url>?from=<encodeURIComponent(id)>`.
8. Add the sign when `text` is not empty. Default position `-4.2 1.5 -1.2`, rotation `0 60 0`, or the `sign` from the interior result.
9. Spawn (6.6). Set triggers. Start the view module (6.7).
10. Call `rules.onEnter(ctx)` in `try`/`catch`.
11. Expose `__placeDebug`. Clear the fade on the next frame.

The doors and the exit exist before step 10, so a rules error cannot remove them (BDR-012 AC-1, NFR-3).

### 6.5 Rules runtime (BDR-011)

- `onTick(ctx, dt)`: called from the `place-player` tick, `dt` in seconds. The first throw logs once and disables `onTick` for this page (E8).
- `canEnter(ctx, door)`: `door = { id, title, url, kind: 'child' | 'exit' }`. Called when an armed body point comes within 1.3 m of a door. `false` → no navigation; the door ID goes into `__placeDebug.locked`; the door latches until the body point leaves the 1.3 m circle, so a stop at the door does not repeat the call. If `canEnter` returns `false` and calls no `say`, the engine says `The door is locked`. A throw → the door is open, plus `[pack <id>] canEnter: <error>` (Q3, fail-safe).
- `triggers`: `[{ position: [x, y, z], radius, action }]`. When the body point enters the circle, the engine calls `actions[action](ctx)`. Latch until it leaves.
- `actions`: `{ name: function(ctx) }`. For each name, the engine adds a `<button data-action="name">` to `#actions`, and lists the name in `__placeDebug.actions`. `__placeDebug.act(name)` calls the same function. Each call is in `try`/`catch`.
- `onExit(ctx)`: called once in `go()` before the fade, and on `pagehide` if not called before. A throw logs and does not stop the navigation.
- Rules state lives only in `ctx.store`. A new page load makes a new runtime, so the rules of a place cannot act in a different place (BDR-011 AC-1, AC-2). `ctx.store` uses the pack ID prefix, so `/vault/` reads `null` for `score` (AC-5).

### 6.6 Spawn and the body point

- The body point is the position that the walk limit and the door triggers use. In first person it is the camera. In third person it is the avatar.
- `?from=<id>`: find the child with that ID (`URLSearchParams` decodes `%2F`). Put the body point 3 m in front of its door, looking at it. In third person, the camera goes 2.5 m behind the body point. An unknown ID gives the normal start, with no log (BDR-003 AC-5).
- The arm rule: the trigger check is armed only after the body point is more than 1.3 m from all doors one time. A view change disarms it again (E1).

### 6.7 View switch and avatar — `assets/js/view.js` (ADR-013, BDR-008)

- Setting: `PLACE.viewSwitch` ∈ `key | key-and-button | url`.
- Stored view: `localStorage['cozy:view']` ∈ `first | third`. Absent, bad or blocked → `first` (FR-8.3, NFR-4).
- `key`: `keydown` of `KeyV` (no modifier, not repeated) toggles and stores.
- `key-and-button`: the `V` key and `#view-btn` toggle and store. The button text and `aria-pressed` follow the view.
- `url`: on load, `?view=third|first` sets and stores the view. Other values are ignored. No key, no button. With other settings, `?view=` is ignored (BDR-008 S4, E4, E5).
- Door and exit URLs never get `?view=` (FR-8.7).
- Avatar: an `a-entity#avatar` in `#world` with a primitive body (cylinder, 1.1 m) and head (sphere, 0.25 m), warm color, `visible: false` in first person. Decision D13: distance 2.5 m, camera height 1.6 m.
- Third person tick (runs in `place-player` before the trigger check): body point = camera ground position + 2.5 m along the camera yaw; clamp the body point to `walk_limit`; set the camera to body point − 2.5 m along the yaw; set the avatar at the body point, turned to the yaw. The camera follows the avatar, so the avatar stays in view (AC-2).
- Switch to first person: put the camera at the body point.
- VR: on `enter-vr`, force first person, hide the avatar, ignore the switch, do not store. On `exit-vr`, apply the stored view (AC-5, manual check).
- Triggers use the body point, so in third person the avatar fires the doors and the camera does not (AC-4).

### 6.8 Debug hook — `window.__placeDebug` (ADR-011)

Existing fields stay: `placed`, `triggers`, `go`, `pending()`. New fields, all read-only to production code:

| Field | Meaning |
| --- | --- |
| `view()` | `'first'` or `'third'` |
| `avatar()` | `{ x, z, visible }` |
| `body()` | `{ x, z }` body point |
| `teleport(x, z)` | Puts the body point at `(x, z)` (tests only; replaces direct `#cam` moves in `walkTo`) |
| `locked` | Door IDs that `canEnter` refused |
| `actions` | Action names of this place |
| `act(name)` | Calls the action |
| `messages` | Texts given to `say` |
| `errors` | `{ id, phase, message }` for each pack error |
| `store()` | Plain copy of this pack's stored keys |
| `files` | `PLACE.files` |

### 6.9 Serve, lint, CI, tests

- `scripts/serve-site.js`: read `SITE_DIR` (default `_site`). Add media types `.mjs`, `.jpg`, `.jpeg`, `.ktx2`, `.ogg`, `.mp3`, `.wav`, `.txt`. `.glb` stays `model/gltf-binary` for any path (FR-6.2).
- `package.json`: `build:fixtures` builds the three overlays; `test` runs `build`, `build:fixtures`, then `playwright test`.
- `playwright.config.js`: projects `prod` (port 4100, `_site`), `fixture` (4101), `button` (4102), `url` (4103), each with its own `webServer` entry and `testMatch`. `LIVE_URL` runs only `prod`.
- `.gitignore` and ESLint ignores: `_site-fixture/`, `_site-button/`, `_site-url/`.
- ESLint: `assets/js/**` and `packs/**/*.js` and `tests/fixtures/packs/**/*.js` are `sourceType: module`. For pack files, `no-restricted-globals` forbids `window`, `document`, `localStorage` and `THREE` (NFR-8; packs import `three` and `cozy/kit.js`).
- CI: after the main build, run `npm run build:fixtures` with the same `--baseurl`. Only `_site/` is uploaded (ADR-012). The live job runs `--project=prod`.
- Test fixture packs in `tests/fixtures/packs/`: root `index.md`, `shed/` (only `index.md`), `arcade/` (`rules.js`: `onEnter` says `Welcome to the arcade`, action `score` adds 1 to `store.score` and says the score), `vault/` (`rules.js`: `canEnter` refuses `vault/gold` and says `The door is locked`; `onEnter` says `score: <value of store.get('score')>`), `vault/gold/`, `broken/` (`rules.js` throws in `onEnter`), `pipshouse/models/rug.glb` (asset-folder test, a copy of a small kit GLB with `CREDITS.md`).
- Bad-name test: `tests/fixtures/bad-packs/index.md` and `tests/fixtures/bad-packs/Bad Name/index.md`. A Playwright test with no page spawns `bundle exec jekyll build` with `packs_dir: tests/fixtures/bad-packs` and a temp destination, and asserts a non-zero exit and `Bad Name` in the output.
- Specs: `smoke.spec.js` (lists `packs/**/index.md`, BDR-001..003, 005..007 S1), `view.spec.js` (BDR-008, projects `prod`, `button`, `url`), `packs.spec.js` (BDR-009..012, project `fixture`), `build.spec.js` (BDR-009 S5).
- `tests/place.js`: `walkTo` uses `__placeDebug.teleport` after a teleport to the spawn point.

## 7. State model

```
view:   first ──(V / button / ?view=third)──► third
        third ──(V / button / ?view=first)──► first
        any   ──enter-vr──► vr-first ──exit-vr──► stored view
door:   disarmed ──body > 1.3 m from all doors──► armed
        armed ──near door, canEnter true──► leaving (fade, onExit, navigate)
        armed ──near door, canEnter false──► latched (say) ──body leaves circle──► armed
        armed ──view change──► disarmed
pack module: listed ──import ok──► run ──throw──► failed (default used, logged once)
```

## 8. Error handling, security, observability, compatibility

- **Errors.** Every pack call (import, `exterior`, `interior`, each rules hook, each action, each model load) is in `try`/`catch` or `.catch`. Log format: `console.error('[pack ' + id + '] ' + phase + ': ' + message)`. The ID is the folder path, `/` at the root (BDR-012 AC-2). Core errors keep the prefix `[place]`.
- **Build errors.** Fatal errors name the folder or the file. No partial `_site/` is used, because CI stops on a failed build.
- **Security.** Pack code is trusted repository content. The scope is a convention, not a sandbox (ADR-001). `window.PLACE` is written with `jsonify`. `say` and action labels use `textContent`. `localStorage` holds only the view and pack state (NFR-7). No new dependency, no network call to a new host. The import map entry `cozy/` points to the same origin.
- **Observability.** `__placeDebug.errors`, `messages`, `locked`, `view()` give tests a state view without pixels (ADR-011). Build warnings for removed keys and unknown `view_switch`.
- **Compatibility.** `/moon-base/` returns 404 after the change (ADR-001 consequence, brief O6). `?from=` IDs change from slugs to folder paths; the flat IDs (`cozy-house`, `crystal-cave`, `moon`) do not change. The old front matter keys are not read.

## 9. Decisions for unspecified details

| # | Decision |
| --- | --- |
| D1 | Generator plugin with `PackPage` / `PackFile` subclasses; `packs` in `exclude` (option A1). |
| D2 | `packs_dir` config key (default `packs`) for fixture builds. |
| D3 | Root pack ID is `/`. It cannot collide with a folder name. Store prefix `cozy:pack:/:`. |
| D4 | A pack under a folder with no `index.md` stops the build. |
| D5 | Place models move into packs; `nature/` stays at `assets/models/nature/` for BDR-006; `ctx.model('/…')` resolves against the site base. Follow-up for the stack. |
| D6 | Shared helpers in `assets/js/kit.js`, imported as `cozy/kit.js` (option B1). |
| D7 | `engine.js` becomes an ES module (`type="module"`); closes the ADR-006 gap. |
| D8 | `exterior` default return `{ door: 0.6, labelHeight: 3.2 }` (plain frame). |
| D9 | Empty room = floor disc plus low wall ring at `walk_limit`. |
| D10 | `interior` may return `{ sign, exit }`. |
| D11 | Mood objects merge over `golden`; moods may set `background`. |
| D12 | `canEnter` throw → door open plus error (Q3). A locked door latches. Default message `The door is locked`. |
| D13 | Third person: camera is the controlled body, avatar 2.5 m ahead (option C1). Primitive avatar. |
| D14 | `localStorage` keys: `cozy:view` and `cozy:pack:<id>:<key>`. |
| D15 | Triggers and walk limit use the body point (camera or avatar). A view change disarms the doors. |
| D16 | Actions are `<button>` elements in `#actions` plus `__placeDebug.act` (Q4). |
| D17 | Debug hook fields in 6.8. |
| D18 | Vault shows the read score through `say` (Q5). |
| D19 | One Playwright project per build, `SITE_DIR` in the serve script (option D-1). |
| D20 | Children are sorted by folder name, so the arc layout is deterministic. |

## 10. Risk reassessment

- Impact 3 (unchanged): the content model, the build and most of the engine change, but the site has no production users in this run, and gate 8 is local. The content-model change is the intent of ADR-001, so it is not an unplanned schema change.
- Likelihood 3 (unchanged): the plugin uses two Jekyll internals (A1 con). The engine refactor is large. The Playwright browser install (brief D3) is still a watch item for gates 5 and 8.
- Score **6** (Impact + Likelihood). Below the tolerance of 9.
- Hard-stop triggers: none. No public API, no new dependency, no auth change. Gate 3 records the full register.

## 11. Follow-ups (not in this run)

- Stack: `ctx.model` absolute path (D5), `interior` return value (D10), root ID `/` (D3), `packs_dir` (D2), `mood.background` (D11) — candidates for ADR-001 text.
- Stack: spec rule changes that ADR-001 lists (`platform/jekyll` 5 and 8, `3d-asset-pipeline` 2 and 4).
- A later ADR for the avatar model and the camera distance (ADR-013 consequence).

Risks: see the Risk Register (`03-risk-register.md`, gate 3).

### sdlc-result
gate: 2-design
status: passed
risk-score: 6
impact: 3  likelihood: 3
hard-stop-triggers: [none]
artifact: .sdlc/runs/cozy-packs-and-third-person/02-design-note.md
note: Generator plugin + ES-module engine with ctx loader, kit.js via import map, camera-led avatar; nature kit stays for BDR-006; 20 decisions.
