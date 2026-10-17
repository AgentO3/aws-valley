# ADR-001: Place Model and Front Matter Keys

## Status

Accepted

## Context and Problem Statement

Each page of the site is one walkable 3D place. Authors write places as Markdown files. The engine must get the same data for each place, and authors must know which front matter keys exist. `platform/jekyll` rule 6 requires a documented list of the keys for each collection.

## Considered Options

- Markdown files in a Jekyll collection, with a fixed set of front matter keys. Liquid writes the keys as JSON.
- One YAML or JSON data file that holds the full world graph.
- Scene markup (A-Frame entities) written directly in each page.

## Decision Outcome

We will use the `places` collection with the front matter keys below. The layout writes them as `window.PLACE` with `jsonify`. `assets/js/engine.js` builds the scene from that object only. This keeps one file per place, so authors can add a place without a change to code.

| Key | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `title` | string | yes | — | The name on the door and in the HUD |
| `type` | `world` \| `house` \| `cave` | no | `world` | The prefab outside, and the interior inside |
| `parent` | slug \| `index` | yes, except on `index.md` | — | The place that contains this place |
| `mood` | `golden` \| `moonlight` \| `hearth` \| `grotto` | no | from `type` | Sky, light, fog and exposure |
| `biome` | string (`moon`) | no | — | The decoration set for a `world` |
| `position` | `[x, y, z]` | no | arc layout | A fixed position in the parent, in metres. The engine ignores `y` |

The Markdown body becomes the text on the sign. An unknown `parent` gives `{ missing: "<slug>" }`, and the engine logs a `[place]` warning.

## Consequences

- Good: a new place needs only a Markdown file.
- Good: the smoke tests find all places from `_places/`, so a new place gets tests without a change to the tests.
- Bad: a new `type`, `mood` or `biome` value needs a change in `engine.js` (`KINDS`, `MOODS`, `PREFABS`).
- Neutral: Jekyll does not check the keys. A spelling error in a key gives the default value, not a build error.
