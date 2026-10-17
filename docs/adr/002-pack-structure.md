# ADR-002: Pack Structure

## Status

Accepted on 2026-10-16. Supersedes [ADR-001](001-place-model.md).

This ADR is a copy of ADR-001 of the `cozy-engine` stack in `stackable-specs`.

## Context and Problem Statement

A place is an area that a visitor can go into, for example a room, a portal or a cave. Now, the parts of one place are in many locations:

| Part of a place | Location now |
| --- | --- |
| Name, parent and sign text | `_places/<slug>.md` |
| Outside structure | `PREFABS` in `engine.js` |
| Inside scene | `buildHouseInterior()` and `buildCaveInterior()` in `engine.js` |
| Size and walk limit | `KINDS` in `engine.js` |
| Light and air | `MOODS` in `engine.js` |
| Models | `assets/models/<kit>/` |

A new kind of place needs a change to the core engine. A place cannot have its own logic or game rules. To remove a place, an author must find and remove its parts in many files.

We need a project structure where all the parts of one place are in one folder. The folder must be self-contained, and the structure must use convention over configuration.

## Decision Drivers

- **Self-contained.** All the assets, scene code and game rules of a place are in one folder.
- **Convention over configuration.** The names and locations of files define the behavior. A pack needs no registry entry and no manifest.
- **The URL is the folder path.** `packs/pipshouse/` is `/pipshouse/`.
- **No JavaScript build step.** The browser loads the code as it is (`language/javascript`).
- **Static hosting.** The output is static files (`delivery/static-hosting`).
- **Automatic tests.** The smoke tests find each place with no change to the tests.

## Considered Options

- **A.** Nested pack folders under `packs/`. The folder path gives the URL and the parent.
- **B.** Flat pack folders under `packs/`, with a `parent:` key in the front matter.
- **C.** Pack folders, and a manifest file that lists each pack and its settings.
- **D.** Keep the tables in `engine.js` (the current state).
- **E.** One npm package for each pack.

## Pros and Cons of the Options

### A. Nested pack folders

- Good: the folder tree is the place tree. You cannot make a wrong `parent` reference.
- Good: to add or remove a place, you add or remove one folder.
- Good: the URL shows the position of the place in the world.
- Bad: when you move a folder, its URL changes, and old links go to the "not found" page.
- Bad: Jekyll cannot make these URLs with a collection `permalink`. The site needs a small Jekyll plugin.

### B. Flat pack folders with `parent:`

- Good: when you move a place in the tree, its URL does not change.
- Bad: the place tree is in the front matter, not in the folders. A wrong `parent` gives a place with no exit (BDR-004).
- Bad: this option puts configuration where a convention can do the work.

### C. Pack folders and a manifest

- Good: one file shows all the packs.
- Bad: each pack needs an entry in a second file, so a pack is not self-contained.
- Bad: the manifest and the folders can differ.

### D. Tables in `engine.js`

- Good: no change.
- Bad: each new kind of place needs a change to the core engine.
- Bad: a place cannot have its own rules.

### E. One npm package for each pack

- Good: each pack has a version.
- Bad: this option needs a JavaScript build step and a package registry.
- Bad: it is too much work for a content folder.

## Decision Outcome

Recommended option: **A, nested pack folders under `packs/`.** It is the only option where the folder alone defines the place, its URL and its position in the world.

### Layout

```
packs/
  index.md            # the root place → /
  interior.js
  models/
  pipshouse/          # → /pipshouse/
    index.md
    exterior.js
    interior.js
    rules.js
    models/
    textures/
    sounds/
    CREDITS.md
  moon/               # → /moon/
    index.md
    moonbase/         # → /moon/moonbase/
      index.md
```

### Conventions

1. **A pack is a folder that contains `index.md`.** A subfolder with no `index.md` is an asset folder, not a place.
2. **The URL is the exact folder path under `packs/`.** `packs/moon/moonbase/` is `/moon/moonbase/`. `packs/` itself is the root place `/`.
3. **The parent is the folder that contains the pack.** Each child pack folder gives a door in the parent. Each pack except the root gets an exit to its parent.
4. **The pack files are served under the place URL.** `packs/pipshouse/models/rug.glb` is `/pipshouse/models/rug.glb`.
5. **A file that exists turns on a feature.** The table below gives each file and its default.
6. **A pack folder name contains only `a-z`, `0-9` and `-`.** The names `models`, `textures`, `sounds` and `lib` are reserved for asset folders. A bad name stops the build, and the error names the folder.

| File | Purpose | If the file does not exist |
| --- | --- | --- |
| `index.md` | Title, settings and sign text | The folder is not a place |
| `exterior.js` | The door or structure that the parent shows for this pack | A plain door frame |
| `interior.js` | The scene inside this place | An empty room |
| `rules.js` | The game rules and logic of this place | No extra rules |
| `CREDITS.md` | The licenses of the assets in this folder | Required if the folder has assets |

### Front matter of `index.md`

| Key | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `title` | string | yes | — | The name on the door and in the HUD |
| `mood` | mood name or object | no | `golden` | Sky, light, fog and exposure. An object sets its own values |
| `position` | `[x, y, z]` | no | arc layout | A fixed position in the parent, in metres. The engine ignores `y` |
| `size` | `{ ring, walk_limit, exit }` | no | values for an open world | The child ring radius, the walk limit and the exit distance, in metres |

The Markdown body becomes the text on the sign. The keys `type`, `biome` and `parent` are removed. The pack code replaces `type` and `biome`. The folder replaces `parent`.

### Module contract

Each pack file is an ES module. The engine loads each one with `import()`. Each module gets one `ctx` object. It must use `ctx`, and it must not use global variables.

```js
// exterior.js — build in ctx.root. Face +Z. Put the door on the +Z side.
export default function exterior(ctx) {
  return { door: 1.2, labelHeight: 3.4 };
}

// interior.js — build the inside of the place in ctx.root.
export default function interior(ctx) {}

// rules.js — all hooks are optional.
export default {
  onEnter(ctx) {},
  onExit(ctx) {},
  onTick(ctx, dt) {},
  canEnter(ctx, door) { return true; },
  triggers: [],   // extra areas, each with a position, a radius and an action
  actions: {}     // place-specific actions, such as "pick up" or "light the fire"
};
```

`ctx` contains these items:

- `root`: the three.js group of the pack.
- `model(path, options)`: loads a model, with a path relative to the pack.
- `rng`: a random generator with a seed from the pack ID.
- `store`: storage that is only for this pack. The key prefix is the pack ID.
- `say(text)`: shows a message to the visitor.
- `place`: the data of the place, which is read-only.

### Build

A Jekyll generator plugin (`_plugins/packs.rb`) walks `packs/`. For each pack, the plugin:

- makes one page with the place URL;
- copies the files of the pack under that URL;
- writes `window.PLACE`, with the parent, the children, and a list of the pack files that exist.

The engine loads only the files in that list. Thus an optional file that does not exist causes no failed request in the browser.

### Errors

The engine runs each pack module in a `try`/`catch`. An error in a pack writes a `console.error` that starts with `[pack <id>]`. The core doors, exits and fade still work.

## Consequences

- Good: to add a place, you add one folder. To remove a place, you remove one folder.
- Good: you can copy a pack into a different world, and it works there.
- Good: each place can have its own logic and game rules.
- Good: `engine.js` becomes an ES module. This closes the open `language/javascript` gap.
- Bad: packs do not share models. Each pack keeps its own copy, so the site is larger. The size budget for each page does not change.
- Bad: when you move a folder, its URL changes.
- Bad: the scope of a pack is a convention of the `ctx` contract. The browser does not enforce it. A pack can still change global state.
- Bad: these spec rules no longer fit, and the specs need a change:
  - `platform/jekyll` rule 5: the site uses a plugin, not a collection `permalink`.
  - `platform/jekyll` rule 8: no `parent` reference to resolve.
  - `3d-asset-pipeline` rule 4: models go in `packs/<path>/models/`, not in `assets/models/<kit>/`.
  - `3d-asset-pipeline` rule 2: each pack has its own `CREDITS.md`.
- Neutral: Stack BDR-004 is deprecated, because a pack cannot name an unknown parent.
- Neutral: the `aws-valley` places move. `/moon-base/` becomes `/moon/moon-base/`.

## Related

- Stack BDR-009, BDR-010, BDR-011 and BDR-012 give the observable behavior of this decision. `tests/packs.spec.js` checks them.
