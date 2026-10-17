# Risk Register — cozy-packs-and-third-person

| Field | Value |
| --- | --- |
| Run slug | `cozy-packs-and-third-person` |
| Gate | 3 — Risk |
| Inputs | `contract.md`, `state.md`, `01-requirements-brief.md`, `02-design-note.md`, stack ADR-001..013, BDR-001..012 |
| Risk formula | Impact + Likelihood (frozen in `state.md`) |
| Risk tolerance | 9 |
| Risk score | **7** (Impact 3, Likelihood 4) |
| Date | 2026-10-15 |

This register does not change the stack docs. Deviations from the stack docs are recorded in section 2.

## 1. Risk table

| # | Risk | Severity | Likelihood | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- |
| R1 | **No rollback point.** The `aws-valley` git repository has no commits. All files are untracked. The migration removes `_places/`, root `index.md` and most of `engine.js`. A bad step cannot be reverted with git. | High | Med | Before the first edit in gate 4, make a rollback point: an initial commit of the current tree on `main` (or, if a commit is not permitted, a `tar` snapshot of the tree without `node_modules/` and `_site/` in the run directory). Record the commit SHA or snapshot path in `04-implementation-plan.md`. Do not delete old files until the new pack equivalents build and pass the smoke tests. | Gate 4 |
| R2 | **Shared model folder conflicts with ADR-001.** ADR-001 says "packs do not share models", and its spec change says models go in `packs/<path>/models/`, not in `assets/models/<kit>/`. Design D5 keeps `assets/models/nature/` (2.1 MB) as a shared site kit, and adds `ctx.model('/…')` so that packs load files outside their folder. A pack that uses `/assets/models/nature/` cannot be copied into a different world (ADR-001 "Good" consequence 2). See DV-1. | Med | High | Record DV-1 as an accepted deviation in the local ADR note. Limit the shared kit to the root pack: only `packs/interior.js` (the valley) loads from `/assets/models/nature/`. Child packs that need nature models keep copies in their own `models/` folder. Add an ESLint or test check that no child pack calls `ctx.model('/…')`. Keep `/assets/models/nature/Pine_1.glb` served for BDR-006. Raise the ADR-001 vs BDR-006 tension as a stack follow-up. | Gate 4; stack maintainers |
| R3 | **Playwright browser not installed.** `playwright-core` 1.64.0 needs Chromium revision 1248. The cache has 1194, 1208 and 1223 only. A `__dirlock` folder exists from a different session. If the install does not complete, no BDR test can run (contract escalation trigger "a test that cannot run"). | High | Med | At the start of gate 4, run `npx playwright install chromium` with a timeout. If the lock blocks it, wait and retry once. If it still fails at gate 5, escalate with trigger "test that cannot run". Do not pin an older Playwright version (that is a dependency change). | Gate 4 / 5 |
| R4 | **Large engine refactor.** `engine.js` (964 lines) becomes an ES module, and place code moves into 5 packs. Regressions in the layout, spawn, triggers or bloom are likely. | Med | Med | Small steps in gate 4. Keep the existing smoke tests green after each step (BDR-001..003, 005..007). Move one pack at a time. Compare `__placeDebug.placed` counts before and after each move. | Gate 4 |
| R5 | **Jekyll internals in the plugin.** `PackPage` and `PackFile` depend on `Jekyll::Page#initialize` and `StaticFile#destination` (design A1 con). A change in Jekyll can break the build. | Med | Low | `Gemfile.lock` pins Jekyll 4.4. Add `build.spec.js` and the fixture build to CI so that a break is visible. Note the dependency in the plugin header. | Gate 4 |
| R6 | **Third person camera goes through walls** in small rooms (design C1 con). | Low | High | Accepted for this run (ADR-013 defers the camera distance). The walk limit clamps the body point. Record a follow-up ADR for the camera rig. | Stack maintainers |
| R7 | **Arm rule and view change.** A view change moves the body point. If the doors are not disarmed, a switch near a door can navigate (E1). | Med | Med | D15: a view change disarms the doors. Add a test in `view.spec.js`: switch view at 1 m from a door, assert no navigation. | Gate 4 / 5 |
| R8 | **Rules error containment gaps.** A pack throw that escapes `try`/`catch` (for example in an `async` hook or a model `Promise`) breaks the exit (BDR-012). | Med | Med | Wrap every pack call and `await` the result inside `try`. Use `Promise.allSettled` for imports. Fixture `broken/` throws in `onEnter`; add one more fixture that throws in `exterior.js` and one that rejects in an `async` `onEnter`. | Gate 4 / 5 |
| R9 | **URL change for `/moon-base/`.** After the change, `/moon-base/` returns 404. External links break. | Low | High | Accepted (ADR-001 consequence, brief O6). No production users in this run. Note it in the release note. | Gate 7 |
| R10 | **Page size budget.** The root page loads the `nature/` kit plus child exteriors (about 2.5 MB). Model copies into packs can push a page over 3 MB (NFR-1). | Med | Low | Gate 5 measures the transfer size of each page with Playwright. The budget is a test assertion. | Gate 5 |
| R11 | **Fixture builds in CI.** Four Jekyll builds and four Playwright projects. Port clashes or a wrong `SITE_DIR` give a false green (a project with no server runs 0 tests). | Med | Med | Each project asserts at least one test ran. Gate 5 reads the per-project counts, not only the summary. `.gitignore` and ESLint ignore the extra `_site-*` folders. | Gate 5 |
| R12 | **`localStorage` keys and pack IDs.** `cozy:pack:<id>:<key>` uses the folder path. A pack move changes its ID and orphans its stored state. | Low | Med | Accepted; consistent with ADR-001 "when you move a folder, its URL changes". Document it in the local ADR note. | Gate 4 |
| R13 | **Pack code is trusted, not sandboxed.** A pack can change global state (ADR-001 "Bad" consequence 3). | Low | Low | ESLint `no-restricted-globals` for pack files (NFR-8). `say` and action labels use `textContent`. Gate 6 reviews. | Gate 6 |
| R14 | **Unrelated run in `.sdlc/runs/`.** `debug-inspector-overlay` describes a Vite/TypeScript app. A later gate can read the wrong run. | Low | Low | All gates take the slug `cozy-packs-and-third-person` explicitly. | All gates |

## 2. Deviations from the stack docs

| # | Stack doc | Statement | Design | Status |
| --- | --- | --- | --- | --- |
| DV-1 | ADR-001 Consequences; `3d-asset-pipeline` rule 4 (as changed by ADR-001) | "Packs do not share models. Each pack keeps its own copy." Models go in `packs/<path>/models/`, not in `assets/models/<kit>/`. | D5 keeps `assets/models/nature/` as a shared kit, and `ctx.model('/…')` loads it. | **Deviation, accepted with limits** (R2 mitigation: only the root pack uses the shared kit). Reason: BDR-006 Scenario 1 requires `/assets/models/nature/Pine_1.glb`, so the stack docs disagree with each other. Not a hard stop: BDR-006 and ADR-001 can both be met if child packs keep their own copies. Follow-up for the stack maintainers. |
| DV-2 | ADR-001 `ctx` contract | `ctx.model(path)` loads pack-relative files. | D5 adds absolute paths (`/…`). | Extension. Follow-up (design §11). |
| DV-3 | ADR-001 | `interior(ctx)` return value not specified. | D10 adds `{ sign, exit }`. | Extension. Follow-up. |

## 3. BDR / conformance impact

The change alters persisted and on-disk surfaces. For each one:

- **Content model (`_places/` → `packs/`, Q1, Q2, Q6, D1..D4).** BDR-001 (place page renders): preserved; smoke tests list `packs/**/index.md`. BDR-002, BDR-003 (doors, exit with `?from=`): preserved; flat IDs do not change, `moon/moon-base` is URL-encoded and BDR-003 examples use flat IDs. BDR-004: deprecated by ADR-001, no test. BDR-005 (unknown URL): preserved. BDR-009 AC-1..5: met by the plugin. Q6 (`packs/models/` in the root pack): preserves BDR-009 AC-3 and the reserved-name rule (names apply to pack folders only).
- **Model location (D5, DV-1).** BDR-006: preserved (`/assets/models/nature/Pine_1.glb` stays). ADR-001 "packs do not share models": **weakened** for the root pack only. BDR-009 AC-4 (pack files under the place URL): preserved.
- **`localStorage` keys (D14: `cozy:view`, `cozy:pack:<id>:<key>`).** BDR-008 (stored view): preserved. BDR-011 AC-5 (`/vault/` reads no `score`): preserved by the pack-ID prefix. No existing stored data to migrate (no earlier keys).
- **`window.PLACE` shape (design 6.2).** No BDR reads it directly. ADR-005 (data-only, `jsonify`): preserved.
- **`__placeDebug` (D17).** ADR-011: preserved; existing fields stay, new fields are additions.

## 4. Risk classification

| Dimension | Rating | Reason |
| --- | --- | --- |
| Impact | Medium | The content model, build and most of the engine change. No production users; gate 8 is local. |
| Blast radius | Whole site, local only | Every page uses the new plugin and engine. No other system depends on `aws-valley`. |
| Complexity | Medium-high | New Ruby plugin, ES-module engine, module loader, rules runtime, third person view, four test builds. |
| Uncertainty | Medium | Requirements and design are exact. Open items: browser install (R3), shared model deviation (R2), no rollback point (R1). |

## 5. Risk score

- **Impact 3.** Unchanged from gate 2. The change is large but local, and the content-model change is the intent of ADR-001. The missing rollback point (R1) raises the cost of a failure, but R1 mitigation removes it before the first edit.
- **Likelihood 4** (gate 2: 3). Raised for two new facts: Chromium 1248 is not installed and a lock exists (R3), and the design deviates from ADR-001 on shared models (R2). Both have mitigations, but neither is closed yet.
- **Score 7** = 3 + 4. Below the tolerance of 9.
- Formula drift: none. Gates 1, 2 and 3 use Impact + Likelihood.

## 6. Hard-stop escalation checklist

| Trigger | Fired | Note |
| --- | --- | --- |
| Auth / authz | No | No auth in the site. |
| Payments | No | — |
| PII / sensitive data | No | `localStorage` holds the view and pack game state only (NFR-7). |
| Schema / data migration | No | Source-file content model change is the planned intent of ADR-001. No stored user data migrates. Conformance impact recorded in section 3. |
| Public API break | No | `/moon-base/` URL change is an ADR-001 consequence (R9), not an API. |
| New dependency | No | Plugin uses the Ruby standard library. No new npm package. |
| Production deployment | No | Gate 8 validates on a local server. |
| Failed tests (unclear cause) | No | Not run yet. R3 is a watch item. |
| Security scan failure | No | Not run yet (gate 6). |
| Ambiguous requirements / >20% uncertainty | No | Q1..Q6 have resolved defaults. |
| Exceeds approved scope | No | DV-1..3 are within the contract; DV-1 is limited and recorded. |
| Contract: BDR needs an ADR change | No | BDR-006 and ADR-001 can both be met (DV-1). |
| Contract: test cannot run | No (watch) | Fires at gate 5 if R3 is not closed. |

## 7. Decision

**Escalation required: No.** No hard-stop trigger fired, and the score 7 is below the tolerance 9.

Conditions for gate 4:

1. Close R1 first: make the rollback point before any file edit.
2. Apply the R2 limit: only the root pack loads `/assets/models/nature/`.
3. Try the Chromium 1248 install early (R3).

### sdlc-result
gate: 3-risk
status: passed
risk-score: 7
impact: 3  likelihood: 4
risk-tolerance: 9
hard-stop-triggers: [none]
escalate-reason: none
artifact: .sdlc/runs/cozy-packs-and-third-person/03-risk-register.md
note: 14 risks; no git rollback point (R1, snapshot/commit before gate 4); shared nature/ kit deviates from ADR-001 (DV-1, limited to root pack); Chromium 1248 missing (R3).
