# Requirements Brief — cozy-packs-and-third-person

| Field | Value |
| --- | --- |
| Run slug | `cozy-packs-and-third-person` |
| Gate | 1 — Requirements |
| Change class | New feature |
| Autonomy level | 5 |
| Risk tolerance | 9 |
| Risk formula | Impact + Likelihood (range 2-10), frozen in `state.md` |
| Risk score | 6 **(preview, formula: Impact + Likelihood)** — Impact 3, Likelihood 3 |
| Source of truth | `stackable-specs/stacks/stack-cozy-engine/docs/adr/` (ADR-001..013) and `docs/bdr/` (BDR-001..012) |
| Date | 2026-10-15 |

## 1. Restated objective

Make the Jekyll site `aws-valley` agree with every ADR and every active BDR of the `stack-cozy-engine` stack.

- Engineering terms: replace the `_places` collection and the engine tables (`KINDS`, `MOODS`, `PREFABS`, `build*Interior`) with nested pack folders under `packs/`. A Jekyll generator plugin (`_plugins/packs.rb`) makes one page for each pack. The engine becomes an ES module. It loads the optional pack modules `exterior.js`, `interior.js` and `rules.js` with `import()`, and gives each module one `ctx` object.
- Product terms: an author adds or removes a place with one folder. A place can have its own scene and game rules. A visitor can walk in a third person view with an avatar. The site developer chooses the view switch method in `_config.yml` (`view_switch`).
- Proof: automated Playwright tests show each BDR acceptance criterion, except the manual VR criteria.

## 2. Scope

### In scope

- S1. Verify that the site agrees with ADR-002..012. Record each ADR as "conforms" or "gap", and close each gap that this change touches.
- S2. Implement ADR-001: `packs/` layout, `_plugins/packs.rb`, folder-name validation, pack file copy, `window.PLACE` with parent, children and the list of pack files that exist.
- S3. Migrate the four places and the root into packs. `/moon-base/` moves to `/moon/moon-base/`. Remove the `type`, `biome` and `parent` keys.
- S4. Move the place-specific scene code out of `engine.js` into pack modules. Keep the current look of each place.
- S5. Implement the `ctx` contract: `root`, `model(path, options)`, `rng`, `store`, `say(text)`, `place`.
- S6. Implement the `rules.js` hooks: `onEnter`, `onExit`, `onTick`, `canEnter`, `triggers`, `actions`.
- S7. Contain pack errors: `try`/`catch` around each pack module, `console.error` with the prefix `[pack <id>]`.
- S8. Implement ADR-013: `view_switch` (`key` default, `key-and-button`, `url`), avatar, follow camera, `localStorage` persistence, avatar-based door triggers, VR forces first person.
- S9. Extend `window.__placeDebug` (ADR-011) so that tests can read the view, the avatar position, the locked doors, the actions and the pack errors without pixels.
- S10. Playwright tests for BDR-001..003, 005..012. Test fixtures for the arcade, vault, broken, shed and bad-name packs.
- S11. Update the CI build and the local serve script so that the plugin runs and pack files get correct media types.

### Out of scope

- O1. Edits to the stack docs in `stackable-specs` (ADRs, BDRs, specs). The spec rule changes that ADR-001 lists (`platform/jekyll` rules 5 and 8, `3d-asset-pipeline` rules 2 and 4) are recorded as follow-ups only.
- O2. BDR-004 (Deprecated). The `parent` key no longer exists, so no test covers it.
- O3. Automated tests of an immersive WebXR session (BDR-007 AC-2, AC-3; BDR-008 AC-5, Scenario 7). These stay manual checks.
- O4. A production deploy to GitHub Pages. Gate 8 validates on a local server.
- O5. A new avatar art asset. ADR-013 defers the avatar model and the camera distance to a later ADR. This run uses a simple primitive avatar.
- O6. Redirects from old URLs (`/moon-base/`). ADR-001 accepts that a moved folder breaks old links.

## 3. Stakeholders

| Stakeholder | Interest |
| --- | --- |
| Owen Zanzal (owner, site developer) | Reference implementation agrees with the stack. Tests are the proof. |
| Pack authors | One folder is one place. Defaults work with only `index.md`. Clear build and runtime errors. |
| Visitors (desktop, VR) | Doors, exits, fade and view stay reliable. No trap in a broken place. |
| `stack-cozy-engine` maintainers | Gaps between the ADRs and a real site are found and reported. |

## 4. Business value and success metrics

- M1. 100% of the automatable BDR acceptance criteria (BDR-001..003, 005..012) have at least one passing Playwright test.
- M2. Add a place = add one folder. Remove a place = remove one folder. No other file changes (BDR-009 Scenarios 1 and 3).
- M3. `engine.js` contains no place-specific tables or interiors (`KINDS`, `PREFABS`, `buildHouseInterior`, `buildCaveInterior` are gone from the core).
- M4. Zero `console.error` on all production places. Zero HTTP 404 responses while a place loads.
- M5. The page size budget of 3 MB per place (ADR-009) still holds.

## 5. Functional requirements

The BDR acceptance criteria are the functional requirements. IDs use `FR-<BDR>.<AC>`.

### BDR-001 Place page renders

- FR-1.1 `GET` to each place URL and to `/` returns 200.
- FR-1.2 The tab title is `<place title> · <site title>`.
- FR-1.3 The overlay text is `<place title> · WASD to move · click to look`. (With `view_switch` `key` or `key-and-button`, the overlay text also names the `V` key — see FR-8.1. The text must still contain the BDR-001 string.)
- FR-1.4 A non-empty Markdown body shows as a sign with that text.
- FR-1.5 No `console.error` and no uncaught exception during load.

### BDR-002 Walk through a door

- FR-2.1 One door or portal for each child. The label is the child title.
- FR-2.2 Distance < 1.3 m to the door front sends the browser to the child URL.
- FR-2.3 The screen goes black before the URL changes. The new page fades in after the scene shows.
- FR-2.4 A door does not fire at arrival until the visitor moves > 1.3 m from all doors one time.
- FR-2.5 Each door URL returns 200.

### BDR-003 Return through an exit

- FR-3.1 Each non-root place shows one exit labelled `Back to <parent title>`.
- FR-3.2 The root shows no exit.
- FR-3.3 The exit goes to the parent URL with `?from=<child id>`. The child ID is the pack folder path (for example `moon/moon-base`), URL-encoded.
- FR-3.4 With `?from=<child id>`, the visitor stands about 3 m in front of that child door and looks at it.
- FR-3.5 An unknown `from` value gives the normal start point, with no error.

### BDR-005 Unknown URL shows not found

- FR-5.1 A URL that is not a place returns 404.
- FR-5.2 The page shows the heading `This place does not exist.`
- FR-5.3 The page shows a link to `/`.

### BDR-006 Models served as GLB

- FR-6.1 `GET` for a `.glb` under `/assets/models/` returns 200.
- FR-6.2 `Content-Type` is `model/gltf-binary`. The same rule applies to `.glb` files under a pack URL.

### BDR-007 Enter VR

- FR-7.1 Each place page shows an "Enter VR" button (automated).
- FR-7.2 The button starts an immersive session with the same place (manual).
- FR-7.3 In VR, a door fires at < 1.3 m (manual).

### BDR-008 Third person view

- FR-8.1 Only the switch method in `view_switch` changes the view. With `key` or `key-and-button`, the overlay names the `V` key. With `key-and-button`, a view button shows. With `url`, `?view=third|first` sets and stores the view, and the page has no switch.
- FR-8.2 In third person, an avatar is in front of the camera. When the visitor moves, the camera stays behind the avatar, and the avatar stays in view.
- FR-8.3 The first visit is first person. The chosen view stays after a door, an exit and a reload (`localStorage`, one key for the site).
- FR-8.4 In third person, the avatar position fires doors. The camera position does not.
- FR-8.5 In VR the view is always first person, and the switch has no effect. After VR, the stored view returns (manual).
- FR-8.6 An unknown or absent `view_switch` value gives the default `key`.
- FR-8.7 Door URLs do not add `?view=`.

### BDR-009 Pack folder defines a place

- FR-9.1 `packs/<path>/index.md` is a place at `/<path>/`. `packs/index.md` is `/`.
- FR-9.2 One door for each child pack folder. One exit to the containing folder, except at the root.
- FR-9.3 A subfolder with no `index.md` is not a place: no door, and its URL returns 404.
- FR-9.4 Files in a pack folder are served under the place URL.
- FR-9.5 A folder name with a character outside `a-z`, `0-9`, `-`, or a reserved name (`models`, `textures`, `sounds`, `lib`), stops the build. The error names the folder.

### BDR-010 Pack defaults

- FR-10.1 A pack with only `index.md` returns 200 with no `console.error`.
- FR-10.2 The parent shows a plain door frame labelled with the pack title.
- FR-10.3 Inside, an empty room, the sign text and one exit.
- FR-10.4 The browser requests no pack file that does not exist. No 404 during load.

### BDR-011 Place rules stay in their place

- FR-11.1 Rules act only while the visitor is in the place. An enter rule shows its effect only there.
- FR-11.2 After the visitor leaves, the rules have no further effect.
- FR-11.3 `canEnter` can lock a door. A locked door does not fire, and the place shows a message. Other places do not change.
- FR-11.4 A place-specific action is available only in its place.
- FR-11.5 The saved state of a place stays after leave-and-return and after reload. Other places cannot read or change it (`ctx.store` key prefix = pack ID).

### BDR-012 Broken pack stays contained

- FR-12.1 An error in a pack module still gives 200, doors and exit.
- FR-12.2 The console shows an error that starts with `[pack <id>]`.
- FR-12.3 The visitor can leave through the exit.
- FR-12.4 Other places load with no `console.error`.

### ADR-001 structural requirements (not in a BDR)

- FR-A1.1 Front matter keys: `title` (required), `mood` (name or object, default `golden`), `position` (`[x,y,z]`, `y` ignored), `size` (`{ ring, walk_limit, exit }`). A missing `title` stops the build.
- FR-A1.2 `exterior.js` returns `{ door, labelHeight }` and builds in `ctx.root`, facing +Z.
- FR-A1.3 `ctx.rng` has a seed from the pack ID (ADR-008).
- FR-A1.4 Each pack with assets has a `CREDITS.md`.
- FR-A1.5 `engine.js` loads as an ES module. No JavaScript build step (ADR-006).

## 6. Non-functional requirements

| ID | Category | Requirement |
| --- | --- | --- |
| NFR-1 | Performance | Download for each place ≤ 3 MB (ADR-009). The scene is ready (`__placeDebug.pending() === 0`) within the existing test timeouts. |
| NFR-2 | Performance | Third person adds no visible frame drop on desktop. VR keeps first person and no bloom (ADR-010). |
| NFR-3 | Reliability | A pack error never blocks the doors, the exit or the fade (BDR-012). |
| NFR-4 | Reliability | If `localStorage` is blocked, the page loads in first person with no error (ADR-013 consequence). |
| NFR-5 | Determinism | The same data gives the same scene on each load (ADR-008). |
| NFR-6 | Security | `window.PLACE` is written with `jsonify`. No Markdown text becomes markup or script (ADR-005). Pack code is trusted repository content. Scope is a convention, not a sandbox (ADR-001 consequence). |
| NFR-7 | Privacy | `localStorage` holds only the view and pack state. No personal data. |
| NFR-8 | Maintainability | No place-specific code in the core engine. Pack modules use only `ctx`, not globals. ESLint and Prettier pass. |
| NFR-9 | Build | Static output only (ADR-012). The plugin runs in the GitHub Actions build, not in the GitHub Pages builder. Build-once: tests and deploy use the same `_site/`. |
| NFR-10 | Accessibility | The view button (with `key-and-button`) is a real `<button>` with an accessible name. |
| NFR-11 | Testability | Tests read state from `window.__placeDebug`, not from pixels (ADR-011). New packs get smoke tests with no test change. |

## 7. User flows

1. Author adds a place: create `packs/<path>/index.md` → build → the parent shows a door → the place loads with defaults.
2. Visitor tours: open `/` → walk into a door → fade → child place → walk into the exit → `/?from=<id>` in front of the door.
3. Visitor switches view: push `V` (or click the button, or open `?view=third`) → avatar shows → walk through a door → the view stays.
4. Visitor in a rules pack: enter `/arcade/` → message → use "score" → leave and return → score stays.
5. Visitor in a broken pack: open `/broken/` → console error `[pack broken]` → exit still works.

## 8. Edge cases

- E1. A visitor arrives on top of a door (FR-2.4), also in third person when the avatar, not the camera, is on the door.
- E2. `?from=` with a nested ID (`moon/moon-base`) or an encoded slash.
- E3. `?from=` with an unknown ID (FR-3.5).
- E4. `?view=` with `view_switch` not `url` (BDR-008 Scenario 4): ignored.
- E5. `?view=` with a bad value (for example `?view=side`): ignored, no error.
- E6. `localStorage` blocked or throws.
- E7. A pack whose `exterior.js` throws: the parent must still show a plain door frame for it, and the parent's other doors must work.
- E8. A pack whose `interior.js` throws, or whose `onTick` throws every frame (log once, not every frame).
- E9. A `canEnter` that throws: treat the door as open or locked? (see Q3).
- E10. An asset folder (`models/`) with no `index.md` gives no door, and its URL returns 404.
- E11. A folder name with uppercase, a space, an underscore, or a reserved name.
- E12. A deep nesting (three levels) — the URL, the exit and `from` must still work.
- E13. Two packs that use the same `store` key name do not collide.
- E14. The site base path (`--baseurl`) in CI: all pack URLs and pack file URLs respect it.

## 9. Dependencies

- D1. Jekyll 4.4 with custom plugins allowed (Actions build, ADR-012).
- D2. A-Frame 1.7.0 and three.js 0.173.0 from CDN with an import map (ADR-002, ADR-006).
- D3. `@playwright/test` 1.64.0 and its Chromium browser. The contract states that the browser is not installed yet, and a different session holds the install lock. This blocks gates 5 and 8 if it is not resolved.
- D4. `scripts/serve-site.js` must serve pack files with correct media types (`.js` as `text/javascript`, `.glb` as `model/gltf-binary`).
- D5. The local project ADR `docs/adr/001-place-model.md` describes the old `_places` model. It must be marked as superseded in this project (not in the stack docs).
- D6. The existing model kits in `assets/models/` and their `CREDITS.md`.

## 10. Assumptions

- A1. Test fixture packs (`arcade`, `vault`, `vault/gold`, `broken`, `shed`) do not ship in the production world. The tests build a separate fixture site from a fixture `packs/` folder (for example a config overlay with a different source for packs). The production smoke test still walks every production pack.
- A2. The tests for `view_switch` `key-and-button` and `url`, and for the bad folder name, use separate builds (config overlays or a temporary directory). The default production config is `key`.
- A3. BDR-006 still applies to the shared kit under `/assets/models/`. ADR-001 says that each pack keeps its own models. This run keeps the shared kit for the root and engine defaults, and pack-local models where a pack has its own. Both paths serve `model/gltf-binary`.
- A4. The pack ID is the folder path under `packs/` (`moon/moon-base`). The root ID is the empty path; the plugin may use a fixed internal ID such as `index` for the root.
- A5. The avatar is a simple primitive shape. The follow camera distance is a design choice in gate 2.
- A6. The overlay text for `key` / `key-and-button` adds the `V` key after the BDR-001 text, for example `<title> · WASD to move · click to look · V to switch view`. This keeps BDR-001 AC-3 and BDR-008 AC-1 both true.
- A7. "Keep the existing look" means the same models, moods and layout for each migrated place. A pixel-exact match is not required.
- A8. ADR-002..012 already mostly agree with the site. Gaps found in the verification go into the design note, not into this brief.

## 11. Open questions

None blocks the design. Each question has a default that gate 2 can use.

| # | Question | Default |
| --- | --- | --- |
| Q1 | Where do the BDR-011/012 fixture packs live, and how do tests build them? | A separate fixture source (A1). |
| Q2 | Does the exit label change for `moon/moon-base` (BDR-009 example uses `moonbase`)? | Use `moon-base` per the contract and ADR-001 consequence. Label `Back to The Moon`. |
| Q3 | If `canEnter` throws, is the door open or locked? | Open (fail-safe: the visitor is never trapped), plus `[pack <id>]` error. |
| Q4 | How does a test "use" a place action (BDR-011 Scenario 3, 4)? | An action is a debug-visible entry in `__placeDebug.actions` plus a key or on-screen control; tests call it through the debug hook or the control. |
| Q5 | How does a test confirm "the rules of `/vault/` read no score value" (BDR-011 Scenario 5)? | The vault rules write what `ctx.store.get('score')` returned into a debug-visible value; the test asserts it is `undefined`/`null`. |
| Q6 | Does a pack-local model in the root pack (`packs/models/`) clash with the reserved name rule? | No. The reserved names apply to child folder names, and `models/` is an asset folder. |

## 12. Acceptance criteria traceability

### Contract scenarios

| Contract scenario | Requirements covered | Test type |
| --- | --- | --- |
| A pack folder is a place | FR-9.1, FR-9.2, FR-3.1, FR-1.1 | Playwright (production site) |
| Minimum pack uses defaults | FR-10.1..FR-10.4 | Playwright (fixture site) |
| Place rules stay in their place | FR-11.3, FR-2.2 | Playwright (fixture site) |
| Broken pack stays contained | FR-12.1..FR-12.4 | Playwright (fixture site) |
| Third person view | FR-8.1, FR-8.2, FR-8.3 | Playwright (production site, `key`) |
| Bad pack folder name (negative) | FR-9.5 | Node test of `jekyll build` on a temp fixture |

### BDR scenarios

| BDR scenario | Requirements | Automated |
| --- | --- | --- |
| BDR-001 S1 Root page | FR-1.1, FR-1.2, FR-1.3 | yes |
| BDR-001 S2 Every place | FR-1.1, FR-1.3, FR-1.5 | yes |
| BDR-001 S3 Sign text | FR-1.4 | yes (debug hook) |
| BDR-002 S1 Enter a child | FR-2.2, FR-2.3 | yes |
| BDR-002 S2 One door per child | FR-2.1, FR-2.5 | yes |
| BDR-002 S3 No fire at arrival | FR-2.4 | yes |
| BDR-003 S1 Exit to parent | FR-3.1 | yes |
| BDR-003 S2 Go back | FR-3.3, FR-3.4 | yes |
| BDR-003 S3 Round trip | FR-3.3, FR-1.5 | yes |
| BDR-003 S4 Unknown `from` | FR-3.5 | yes |
| BDR-005 S1, S2 | FR-5.1..FR-5.3 | yes |
| BDR-006 S1 | FR-6.1, FR-6.2 | yes |
| BDR-007 S1 Button | FR-7.1 | yes |
| BDR-007 S2, S3 | FR-7.2, FR-7.3 | manual |
| BDR-008 S1 Key | FR-8.1, FR-8.2 | yes |
| BDR-008 S2 Button | FR-8.1, FR-8.2, NFR-10 | yes (`key-and-button` build) |
| BDR-008 S3 URL | FR-8.1 | yes (`url` build) |
| BDR-008 S4 Wrong method | FR-8.1, E4 | yes |
| BDR-008 S5 View stays | FR-8.3, FR-8.7 | yes |
| BDR-008 S6 Avatar fires door | FR-8.4 | yes |
| BDR-008 S7 VR | FR-8.5 | manual |
| BDR-009 S1 Add a pack | FR-9.1, FR-9.2 | yes (fixture build) |
| BDR-009 S2 Nested pack | FR-9.1, FR-9.2, FR-3.1 | yes (`/moon/moon-base/`) |
| BDR-009 S3 Remove a pack | FR-9.1, FR-5.1 | yes (fixture build) |
| BDR-009 S4 Asset folder | FR-9.3, FR-9.4, FR-6.2 | yes |
| BDR-009 S5 Bad folder name | FR-9.5 | yes (build test) |
| BDR-010 S1..S3 | FR-10.1..FR-10.4 | yes |
| BDR-011 S1 Enter rule | FR-11.1, FR-11.2 | yes |
| BDR-011 S2 Locked door | FR-11.3 | yes |
| BDR-011 S3 Action only in place | FR-11.4 | yes |
| BDR-011 S4 Saved state | FR-11.5 | yes |
| BDR-011 S5 State is private | FR-11.5 | yes |
| BDR-012 S1..S3 | FR-12.1..FR-12.4 | yes |
| BDR-004 | — | not applicable (Deprecated) |

## 13. Risk reassessment (preview)

- Impact 3: the change rewrites the content model, the build and most of the engine. The site is a reference implementation with no production users in this run, and gate 8 is local.
- Likelihood 3: the BDRs give exact acceptance criteria, and each open question has a safe default. The uncertain items are the Playwright browser install (D3), the fixture-site build method (Q1), and the size of the engine refactor.
- Score: **6 (preview, formula: Impact + Likelihood)**. This is below the tolerance of 9.
- Hard-stop triggers: none. Requirements are not ambiguous. The contract escalation trigger "a test that cannot run" is a watch item for gate 5 (D3).
