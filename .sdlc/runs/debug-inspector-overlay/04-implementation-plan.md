# Implementation Plan — debug-inspector-overlay

| Field | Value |
|-------|-------|
| Gate | 4 — Implementation (question: is the work reviewable and sequenced?) |
| Date | 2026-09-05 |
| Autonomy | Level 5, risk tolerance 9 — plan + execution proceed autonomously |
| Design | `02-design-note.md` Option A (ADR-001 wiring, ADR-002 jump semantics) |

## Notes binding this plan

- **No test runner exists in the repo** (`app/package.json` has no test script, no
  vitest/jest; adding one would be a new dependency → escalation). Per the risk
  register, formal tests are gate 5's strategy; gate-4 validation is the smallest
  concrete signal available: `npm run build` (tsc strict + vite build) per step,
  plus a prod-bundle grep for `lv-debug`/`Backquote` (also gates 5/8's R-1 check —
  run early here since the build is already being executed).
- **Error-handling implementation note:** the design's "every closure wraps its
  body in try/catch → panel inline error" is realized as a single try/catch
  choke point in `DebugInspector` around every op invocation (the panel is the
  only caller). Same protection contract — op failures never re-throw into the
  game loop and surface as the panel's inline error line — without duplicating
  the wrap in seven closures.
- **Clear-state persistence note:** the contract Gherkin says "localStorage state
  is removed and the world resets to defaults". `clearState()` therefore calls
  `clearWorldState()`, resets `world` in place and the `questStepIndex` module
  `let`, then re-syncs — it does **not** immediately `persist()` (which would
  re-create the key). The next natural gameplay persist writes defaults back,
  which is behaviorally identical and keeps the "removed" observable.
- **Quest-step select scope:** options are quest steps 0–4 only (ADR-002 covers
  exactly these; `STEP_DONE = 5` is quest-complete state, not a step to force).

## Slice table

| Slice | Theme | Hard gate / exit criterion |
|---|---|---|
| 1 | Additive leaf modules: Persistence reset helper + pure-UI inspector + CSS | `npm run build` (tsc strict + vite) exits 0 with no new type errors; nothing in `main.ts` changed yet |
| 2 | DEV wiring: ops closures + Backquote toggle in `main.ts`'s single DEV block | `npm run build` exits 0 **and** prod-bundle grep for `lv-debug`/`Backquote` in `app/dist/` returns zero hits |
| 3 | Verification + ledger: final full build, bundle grep, risk reassess, state update | Build artifact clean; `dist/assets/*.js` contains no inspector bytes; `state.md` row 4 updated |

## Step table

| Step | Slice | Purpose | Files/modules | Behavior change | Tests | Risk | Validation |
|---|---|---|---|---|---|---|---|
| 1 | 1 | Reset helper (A-4) | `app/src/systems/Persistence.ts` | Additive `export function clearWorldState(): void` = `localStorage.removeItem(STORAGE_KEY)`. No other change | Gate 5 (no runner in repo); here: tsc | Low — one-line additive export | `npm run build` |
| 2 | 1 | Pure-UI inspector module (FR-1/2/3/4/5/6 UI half) | `app/src/ui/DebugInspector.ts` (new) | New `DebugOps`/`DebugSnapshot` interfaces + `DebugInspector` class: builds one `.lv-debug-inspector` root in `(layer)` per panel convention; readout table (day, coins, gems, quest state + step label, inventory, buildProgress, chickensHome, coopBuilt, chorePayPending, paused — missing fields render `—`); ops row (Clear state, Pause/Resume); step `<select>` (0–4, labels from `CHICKEN_COOP_QUEST`) + Apply with per-step forced-fields note (ADR-002); item `<select>` from `ITEMS` + qty number input + Grant; `.visible` toggle via `show()/hide()/toggle()/get isVisible`; refresh on show + after each op + 1 s `setInterval` only while visible (cleared on hide, R-5); single op-choke-point try/catch → inline error line, cleared on next success; `console.debug("[debug-inspector]", op, detail)` per design | Gate 5 (fake `DebugOps` unit tests named there); here: tsc | Low — owns zero game state; renders only from `ops.getState()` | `npm run build` |
| 3 | 1 | Styling per `lv-*` conventions | `app/src/style.css` | Append one commented `.lv-debug-*` block: top-right card, z-index 60 (above `.lv-fade`'s 50), uses existing `--cream`/`--ink` tokens, hidden by default, `.visible` shows | Visual check in dev (gate 5/8 manual pass) | Low | `npm run build` |
| 4 | 2 | Ops closures + toggle listener (FR-1/3/4/5/6/7 logic half, ADR-001/002) | `app/src/main.ts` (existing DEV block only) | Import `DebugInspector`, `defaultWorldState`, `clearWorldState` (usage stays inside the single `import.meta.env.DEV` guard). Construct inspector with closures: `getState()` snapshot incl. `isPaused()`; `clearState()` = `clearWorldState()` + `Object.assign(world, defaultWorldState())` + `questStepIndex = 0` + `syncWorldToStep()` + `hud.setCurrency` (no immediate persist — see note); `jumpToStep(i)` = write module `questStepIndex` (bypasses R-4 shadow trap) + `world.questState = "active"` + force `buildProgress=BUILD_STAGES`, `coopBuilt=true`, `chickensHome=0` only for step 4 + `persist()` + `syncWorldToStep()` + `hud.setCurrency`; `grantItem(id, qty)` = add to `world.inventory` + `persist()` + re-show `inventoryPanel` if open; `setPaused`/`isPaused` on the module `paused`. Register one `window` keydown listener reacting only to Backquote (`e.key === "`"`), never `preventDefault`/`stopPropagation`, skipped when `e.target` is an input/select inside the panel root (R-2); toggle is a class flip on a once-constructed panel (R-7). Nothing new exposed on `__lv` | Gate 5 (jump-moves-index, ticker-stops, step-4 consistency tests); here: tsc + grep | Medium — touches the shadowed `questStepIndex` and `paused` internals; mitigated by typed closure scope + ADR-001 | `npm run build` + prod-bundle grep |
| 5 | 3 | Final verification + ledger | `.sdlc/runs/debug-inspector-overlay/state.md` | Ledger row 4 → passed; risk reassess | — | Low | Full `npm run build`, `grep -r "lv-debug\|Backquote" app/dist/` → empty; risk score restated |

## Escalation points

- **None.** No step requires a blocked action (no deploy, secrets, schema
  migration, auth, audit-log change). No new dependency is introduced — adding a
  test *runner* would be one, so testing is deferred to gate 5's strategy per the
  risk register, not smuggled in here.

## Out of scope

- Warp/teleport (OQ-2, brief).
- Jump to `STEP_DONE` (5) — ADR-002 covers steps 0–4 only.
- Widening `window.__lv` (ADR-001 rejected Option B).
- Any change to `WorldSaveState` shape, `InputController`, gameplay logic, HUD.
- Test suite authoring (gate 5 defines strategy; no runner may be added at gate 4
  without a dependency escalation).

## Execution record

| Step | Status | Evidence |
|---|---|---|
| 1 | done | `clearWorldState()` added to `Persistence.ts` (additive, 3 lines); `npm run build` clean |
| 2 | done | `app/src/ui/DebugInspector.ts` created (DebugOps/DebugSnapshot, readout, ops, ticker, choke-point error line, `contains()` guard helper); first build surfaced `erasableSyntaxOnly` forbidding a constructor parameter property — fixed by a separate field assignment; build clean |
| 3 | done | Deviated from design detail per **ADR-003**: debug CSS lives in `app/src/ui/debug-inspector.css` imported by `DebugInspector.ts` (appending to `style.css` was verified to ship inspector bytes in prod, contradicting the design's own zero-inspector-bytes requirement); `style.css` left byte-identical to its pre-run state |
| 4 | done | `main.ts` DEV block: `import type` refs, `debugOps` closures (snapshot, clear-without-immediate-persist, ADR-002 jump writing the module `questStepIndex`, grant + inventory-panel refresh, pause/get), Backquote keydown listener with panel-input typing guard, inspector loaded via DEV-guarded dynamic import; build clean. Note: a concurrent session was mid-edit on `ChickenSystem.ts`/TomHelper wiring/`spike/tom` during steps 3–4 (three foreign TS errors, resolved by that session; polled build until clean — no foreign file was touched) |
| 5 | done | Fresh `npm run build` exits 0; `grep -r "lv-debug" dist/` and `grep -r "Backquote" dist/` → zero hits (R-1 verified early, JS and CSS); dev smoke: vite serves `/src/ui/DebugInspector.ts` (HTTP 200, CSS import intact) and `/src/main.ts`; risk restated **4** (impact 2 + likelihood 2 — the ADR-003 change reduces prod surface vs. the design, no new unknowns); ledger updated |