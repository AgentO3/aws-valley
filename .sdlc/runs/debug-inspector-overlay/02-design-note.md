# Design Note — debug-inspector-overlay

| Field | Value |
|-------|-------|
| Gate | 2 — Design (question: is the solution technically sound?) |
| Date | 2026-09-05 |
| Autonomy | Level 5, risk tolerance 9 |
| Decision records | `decisions/ADR-001-debug-inspector-wiring.md`, `decisions/ADR-002-jump-to-step-semantics.md` |

## Current state

Verified by code exploration (all paths under `app/src/`):

- **DEV handle:** `main.ts:900–941` has a single `if (import.meta.env.DEV) { … }`
  block assigning `window.__lv` (scene, world, input, camera, `setPaused`,
  quest/scene helpers). No visual UI, no state-mutating ops beyond ad-hoc
  console calls. This is the only debug surface today.
- **World state:** `main.ts:70` — `const world: WorldSaveState = loadWorldState()`
  (properties mutated in place). **Trap:** `questStepIndex` is a separate module
  `let` (main.ts:81) that shadows `world.questStepIndex`; `persist()`
  (main.ts:84–87) copies the module `let` back into `world` before saving.
  Writing `__lv.world.questStepIndex` has no effect.
- **Sync:** `syncWorldToStep()` (main.ts:151) reads the module `questStepIndex`
  + `world` and derives all prop visibility (shipments, delivered stacks, coop
  rubble/complete via `buildProgress`, hen crate, chicken placement via
  `chickensHome`/`day`); ends by calling `refreshQuestUI()` and
  `refreshChoreUI()`. Does not persist.
- **Persistence:** `Persistence.ts` — key `aws-valley/slice-1/world`
  (unexported), `WorldSaveState` (15 fields incl. `inventory: Record<string,
  number>`), `defaultWorldState()`, `loadWorldState()` (shallow
  defaults-merge, falls back to defaults on parse error), `saveWorldState()`.
  **No clear/reset helper exists.**
- **Pause:** `let paused = false` (main.ts:820); `tick()` early-returns after
  scheduling the next frame (main.ts:825) — freezes movement, scene animation,
  and rendering; DOM UI stays interactive. Only setter is `__lv.setPaused(v)`.
  No paused getter is exposed.
- **Input:** `InputController` listens on `window` keydown/keyup using
  `e.key.toLowerCase()` (`w/a/s/d`, arrows, `e`, space — `preventDefault` only
  for space). No Backquote, no `e.code`, no `stopPropagation` anywhere in src.
  A coexisting window-level Backquote listener is conflict-free.
- **UI conventions:** every panel (`InventoryPanel`, `CookingModal`,
  `ActivityModal`, `DialogueBox`, `HUD`) is a class taking `(layer:
  HTMLElement)`, building one `lv-*` root div appended to `uiLayer`
  (`.lv-ui-layer`, `pointer-events:none` → children auto), toggled with a
  `.visible` class. Buttons: `.lv-btn`/`.lv-btn-green`/`.lv-btn-quiet`.
  Item ids live in `ITEMS` (`data/items.ts`): `berry`, `wheat`, `berry_pie`,
  `bread`. Inventory re-render: `InventoryPanel.show(inventory)` with an
  `isOpen` getter.
- **Build:** standard Vite (no config file; defaults apply), `build: tsc &&
  vite build`, `types: ["vite/client"]`. `import.meta.env.DEV` is statically
  replaced; the guarded block is dead-code-eliminated in prod.
- **Quest:** `CHICKEN_COOP_QUEST` has 5 steps (indices 0–4: talk / gather /
  add shipments / build / chickens move in); `BUILD_STAGES = 3`, `HEN_COUNT = 3`.

## Gap analysis

| Desired (FR) | Current | Gap |
|---|---|---|
| FR-1 Backquote toggle | No Backquote handling; no panel | New toggle listener + panel root |
| FR-2 Live state readout | Values visible only piecemeal in HUD; full state only via console | New readout section with refresh-on-open/op + slow ticker |
| FR-3 Clear state | No reset path at all (no helper; manual `localStorage.removeItem`) | `clearWorldState()` helper + reset-in-place + re-sync |
| FR-4 Jump quest step | Console write of `questStepIndex` is silently ignored (shadowed `let`); no consistent-field forcing | Ops closure writing the module `let` + minimal consistent fields (ADR-002) |
| FR-5 Grant items | Console write to `world.inventory` + manual panel refresh | Picker + qty control + persist + panel refresh |
| FR-6 Pause | Works via `__lv.setPaused` but invisible in any UI | Panel button + paused indicator |
| FR-7 Input neutrality | Backquote unused; no conflicts | Guard: skip toggle when event target is an input inside the panel; never preventDefault |
| FR-8 DEV-only emission | Existing pattern proven (the `__lv` block) | Same single guard site; build-output verification at gate 5/8 |

Also closed here: **OQ-1** — grant-items uses a fixed `<select>` of the four
`ITEMS` ids (free-text fallback unnecessary; list is small and closed).
**OQ-2** — warp stays out of scope per the brief. **OQ-3** — resolved by
ADR-002 (minimal consistent fields, forced only for step 4).

## Solution options

### Option A — Pure-UI module + DEV-wired ops closures (recommended)
New `ui/DebugInspector.ts` class taking `(layer, ops: DebugOps)`; all game
mutation happens in closures created inside main.ts's existing
`import.meta.env.DEV` block, which can touch `questStepIndex`, `paused`,
`persist`, `syncWorldToStep`, `hud`, and the refresh functions directly.
**Pros:** single guard site; module internals stay private; the shadowed
`questStepIndex` trap is bypassed (closures write the `let`); UI is testable
against a fake `DebugOps`; zero new deps; follows existing panel convention.
**Cons:** the DEV block grows (~40 lines); ops signatures must be kept in sync
with main.ts internals by hand (compile-time-checked, since closures close over
typed scope).

### Option B — Inspector drives everything through `window.__lv`
**Pros:** no main.ts wiring; inspector fully self-contained.
**Cons:** `__lv` lacks `hud`, `refreshQuestUI`, `refreshChoreUI`, a paused
getter, and a safe `questStepIndex` write path; widening `__lv` to compensate
spreads debug surface across two guard sites and bakes the trap-friendly
`world.questStepIndex` write pattern deeper. Rejected.

### Option C — `DebugController` system module owning debug mutations
A new `systems/` module that main.ts delegates state mutation to.
**Pros:** cleaner long-term home; symmetric with other systems.
**Cons:** duplicates main.ts's persistence/refresh wiring for a dev-only
feature; more moving parts than a small increment warrants. Rejected.

## Tradeoff analysis

| Axis | A | B | C |
|---|---|---|---|
| Complexity | Low (1 new file + wiring in existing block) | Low code but conceptually leaky | Medium (new module + delegation layer) |
| Risk | Low — mutation paths are the ones main.ts itself uses | Medium — silent `questStepIndex` shadow trap invites broken ops | Low-medium — new indirection to verify |
| Cost | ~1 file + 40 wiring lines | Similar code but more `__lv` surface to maintain | More files/lines |
| Maintainability | High — `DebugOps` is the only coupling surface | Low — stringly-typed `__lv` contract | Medium-high |
| Security | DEV-only, no network, no eval | same | same |
| Performance | Refresh on open/op + 1 s ticker while open; no per-frame DOM writes | same | same |
| Rollout safety | Prod DCE of one static `if (false)` block; verifiable by grepping the bundle | same, but two guard sites to verify | same |

## Recommended design

**Option A.** Reasons: it is the only option that bypasses the shadowed
`questStepIndex` trap without widening the console surface, it keeps a single
`import.meta.env.DEV` guard site (making FR-8 provable by one bundle grep), and
it matches the repo's existing panel pattern with zero dependencies. No public
API, schema, dependency, or auth change is required — within authority.

## Design detail

- **Architecture / components:**
  - `app/src/ui/DebugInspector.ts` (new): `class DebugInspector { constructor(layer: HTMLElement, ops: DebugOps) }`. Builds one `.lv-debug-inspector` root (top-right card, `z-index: 60` within `uiLayer`, above modal backdrops), sections: readout table, ops row (Clear state, Pause/Resume), quest-step `<select>` + Apply, item `<select>` (from `ITEMS`) + qty `<input type="number" min="0">` + Grant. Toggle `.visible`. Owns no game state; renders only from `ops.getState()` snapshots.
  - `app/src/main.ts` (existing DEV block only): import `DebugInspector`, construct with closures; register the Backquote keydown listener on `window` (toggle `panel.visible`, skipped when `e.target` is an input/select inside the panel); expose nothing new on `__lv` beyond what exists.
  - `app/src/systems/Persistence.ts`: add `export function clearWorldState(): void` = `localStorage.removeItem(STORAGE_KEY)` (additive, one line; satisfies A-4).
  - `app/src/style.css`: append one `.lv-debug-*` class block following `lv-*` conventions.

- **API contract:** `DebugOps` (the only coupling surface):
  ```ts
  interface DebugOps {
    getState(): DebugSnapshot;                    // { day, coins, gems, questState, questStepIndex,
                                                  //   inventory: Record<string,number>, buildProgress,
                                                  //   chickensHome, coopBuilt, chorePayPending, paused }
    clearState(): void;                           // remove storage, reset in place, re-sync + refresh
    jumpToStep(stepIndex: number): void;          // ADR-002 semantics
    grantItem(itemId: string, qty: number): void; // add + persist + inventory refresh
    setPaused(v: boolean): void;
    isPaused(): boolean;
  }
  ```
  All ops are synchronous, no-throw-by-contract (see error handling), and void-returning; the UI re-renders from `getState()` after every op.

- **Data model / schema changes:** none. `WorldSaveState` is untouched; the only
  Persistence addition is the `clearWorldState()` helper. Legacy saves keep
  loading via the existing defaults-merge — no migration, no
  backward-compat test needed beyond the existing load behavior.

- **State model & transitions:** panel states: `hidden ⇄ visible` (class
  toggle; construction is once-at-DEV-boot, listeners registered once — rapid
  re-toggle is idempotent by construction). Refresh triggers: on show, after
  each op, and a 1 s `setInterval` while visible (cleared on hide) — no
  per-frame DOM writes. Game state transitions are exactly the existing ones
  (`syncWorldToStep()` derivation, `persist()` writes); the inspector adds no
  new persisted state.

- **Error handling:** every closure wraps its body in try/catch; on failure the
  panel shows a one-line inline error (auto-cleared on next successful op) and
  never re-throws into the game loop. localStorage-unavailable (private mode):
  reads fall back to `defaultWorldState()` via existing `loadWorldState`
  behavior; writes degrade to in-memory-only without throwing. Corrupted saves
  inherit the existing defaults fallback. Snapshot rendering coerces
  missing/undefined fields to `—` rather than throwing.

- **Security considerations:** DEV-only emission (single `import.meta.env.DEV`
  guard); no network calls, no telemetry, no eval/`new Function`; touches only
  the game's own localStorage key; panel inputs never route into gameplay.
  Prod bundle must contain zero inspector bytes — verified by `npm run build`
  followed by grepping `dist/` for `lv-debug`/`Backquote` (gates 5 and 8).

- **Observability:** each op logs one `console.debug("[debug-inspector]", op,
  detail)` line in dev; failures log `console.warn` with the op name. No
  metrics, logging hooks, or alerting (local dev tool; nothing to observe in
  prod because nothing ships).

- **Input neutrality (FR-7 detail):** the toggle listener only reacts to
  Backquote, never calls `preventDefault` (Backquote is inert to the game) and
  never `stopPropagation`; panel-internal inputs are excluded from the toggle
  check so typing `` ` `` in the quantity field doesn't close the panel.
  WASD/E/space/arrows pass through untouched because the listener ignores them.

- **Backward compatibility:** no persistence-format, gameplay, HUD, quest, or
  InputController change; the sole export additions (`DebugInspector` class,
  `clearWorldState()`, `DebugOps` type) are additive. Games without the
  inspector behave byte-for-byte identically.

## Risks

See `03-risk-register.md` at gate 3. Preview per the frozen formula
(Impact + Likelihood): **impact 2** (dev-only surface, but edits main.ts's DEV
block and adds a Persistence export — small blast radius, no player surface) +
**likelihood 2** (all patterns verified against the actual code; the one
subtlety, the shadowed `questStepIndex`, is explicitly designed around in
ADR-001) → **score 4**, below tolerance 9. Watch items for gate 3: (1) prod
stripping must be bundle-verified, not assumed; (2) the 1 s ticker must not
leak when the panel is hidden; (3) jump-to-step consistency assertions
(ADR-002) belong in the test plan.