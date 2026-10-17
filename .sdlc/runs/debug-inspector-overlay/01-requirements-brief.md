# Requirements Brief — debug-inspector-overlay

| Field | Value |
|-------|-------|
| Change | Hotkey-toggled DEV-only debug inspector overlay for the AWS Valley game |
| Author / agent | AI-SDLC gate 1 (Claude) |
| Date | 2026-09-05 |
| Autonomy level | 5 (risk tolerance 9; change class: Small feature increment) |

## Restated objective

Add a developer-only overlay panel to the Three.js/Vite game that:

- **Toggles** via the backquote (`` ` ``) hotkey, showing/hiding without touching gameplay input.
- **Displays live game state**: day, coins, gems, quest step, inventory, build progress, chickens home (and related world fields).
- **Offers state-mutating operations**: clear/reset world state, jump to a quest step, grant items, pause/unpause.
- **Never ships in production** (DEV-only, tree-shaken out of the prod bundle) and **never interferes with player-facing behavior**.

Success = the developer can inspect and mutate game state from a visible panel instead of the `window.__lv` console handle, shortening iteration loops.

## Scope

**In scope:**
1. A hotkey (backquote) toggle listener that opens/closes the inspector panel.
2. Panel UI mounted in the existing `uiLayer` (`.lv-ui-layer`), styled with a new `.lv-*` class in `app/src/style.css` (no framework, no new deps).
3. Live readout of world state fields from `WorldSaveState` (`app/src/systems/Persistence.ts`): day, coins, gems, `questState`/`questStepIndex`, inventory, `buildProgress`, `chickensHome`, `coopBuilt`, chore state.
4. "Clear state" operation: remove the `aws-valley/slice-1/world` localStorage entry and reset the in-memory world to `defaultWorldState()`, then re-sync via `syncWorldToStep()` + HUD refreshers.
5. "Jump to quest step" operation: select one of the 5 `CHICKEN_COOP_QUEST` steps (talk / gather / add shipments / build / chickens move in) and apply it to `questState`+`questStepIndex`, then re-sync world and HUD.
6. "Grant item" operation: add a quantity of a chosen inventory item to `world.inventory`, then refresh the inventory panel.
7. Pause/unpause toggle (reusing the existing pause mechanism exposed as `window.__lv.setPaused()`).
8. All inspector code behind `import.meta.env.DEV` so the prod bundle contains no inspector element, listener, or dead code.

**Out of scope:**
- Any change to player-facing gameplay, HUD, quest logic, or persistence format.
- A prod-accessible debug mode, feature flag, or URL param.
- New npm dependencies or a UI framework.
- Undo/history for inspector mutations (operations are direct state writes).
- Time-of-day / teleport "warp" operation (see OQ-2).
- Automated UI test harness introduction (tests strategy is gate 5's call; existing repo has none).

## Stakeholders

- **Primary user:** the game developer (you) — fast iteration, legible state.
- **Indirectly affected:** players — must observe zero behavior change (prod bundle must be free of the inspector).
- **Reviewers/approvers:** AI-SDLC gates 2–9.
- **Operators:** none (local dev tool; gate 8 validates locally only).

## Business value & success metrics

- **Value:** cuts state-setup friction while iterating (replaying quest steps, resetting state, granting items currently requires console commands or manual gameplay).
- **Success metrics:** developer can open the inspector, read live state, and apply clear/jump/grant/pause ops in < 5 seconds each; `npm run build` output contains no inspector code; WASD/E gameplay is byte-for-byte unchanged with the panel hidden.

## Functional requirements

1. **FR-1 Toggle:** Pressing `` ` `` (key `"`` `"`, also matching `e.code === "Backquote"`) when hidden shows the panel; pressing again hides it. Works regardless of in-game modal state (dialogue, cooking, inventory).
2. **FR-2 Live state readout:** While open, the panel displays current values of: day, coins, gems, quest step name+index, `questState`, inventory (item → count), `buildProgress`/`BUILD_STAGES`, `chickensHome`/`HEN_COUNT`, `coopBuilt`, `chorePayPending`. Values refresh when the panel is opened and on a periodic ticker or after each operation (must not require reload).
3. **FR-3 Clear state:** A "Clear state" button removes the localStorage entry and resets the in-memory world to `defaultWorldState()`; HUD and scene re-sync via `syncWorldToStep()` + `refreshQuestUI()`/`refreshChoreUI()`/`hud.setCurrency(...)`.
4. **FR-4 Jump quest step:** A step selector (the 5 quest steps of `CHICKEN_COOP_QUEST`) plus Apply sets `questState`/`questStepIndex` and re-syncs world/scene/HUD to that step.
5. **FR-5 Grant items:** An item picker (known inventory items) + quantity control adds to `world.inventory` and refreshes the inventory panel/HUD.
6. **FR-6 Pause:** A pause/unpause control toggles game pause via the existing pause mechanism (`setPaused`).
7. **FR-7 Input neutrality:** The inspector's keyboard handling must not intercept, preventDefault (except within its own text/number inputs), or stopPropagation on keys the `InputController` uses (`w/s/a/d`, arrows, `e`, space). Backquote is unused by the game today (verified: no Backquote handling in `InputController.ts`).
8. **FR-8 DEV-only emission:** All inspector code is statically guarded by `import.meta.env.DEV` (module-level guard like the existing `window.__lv` block, or a DEV-only entry module) so prod builds contain no inspector element, listener, or debug code.

## Non-functional requirements

- **Performance:** opening/toggling the panel must not drop frames perceptibly; no per-frame DOM writes (refresh on open/op/tick ≥ 500 ms).
- **Reliability:** state readout must not throw when localStorage is empty, corrupted, or partially filled (Persistence already merge-fills defaults; inspector inherits that).
- **Security/privacy:** dev tool only; no telemetry, no network calls; reads/writes only the game's own localStorage key.
- **Compatibility:** no changes to `InputController`, `Persistence` export surface beyond what's needed (a `clearWorldState()` helper may be added); no new deps.
- **Bundle:** prod JS bundle grows by zero bytes attributable to the inspector (Vite `import.meta.env.DEV` dead-code elimination).
- **Accessibility (dev tool, low bar):** panel is keyboard-reachable, buttons are real `<button>`s, labels legible; not a compliance surface.
- **Maintainability:** single new module (e.g. `app/src/ui/DebugInspector.ts`) + one CSS class block; follows existing `lv-*` conventions; typed interfaces, no silent failures.

## User flows

1. **Inspect:** dev presses `` ` `` → panel appears over the game showing live state → presses `` ` `` again → panel hides, gameplay resumes.
2. **Reset:** dev opens panel, clicks "Clear state" → localStorage wiped, world resets to defaults, HUD/scene re-sync → dev continues from a fresh world.
3. **Fast-forward:** dev selects "Build the coop" step, clicks Apply → world/scene jump to that step → dev tests build interactions directly.
4. **Iterate:** dev grants 5 lumber via the panel, toggles pause to freeze the scene, inspects, unpauses.

## Edge cases

- Hotkey pressed while a `.lv-modal-backdrop`/dialogue is open and capturing keys — toggle must still work.
- Text/number inputs inside the panel must not leak keystrokes to the game (e.g. typing "e" in a quantity field must not trigger interact).
- Pressing `` ` `` rapidly multiple times — idempotent toggle, no duplicate panels/listeners.
- Clear state while the panel is open — panel must re-render defaults, not show stale values.
- Jump to a step whose prerequisites are inconsistent (e.g. jump to "chickens move in" with `buildProgress` 0) — inspector sets the minimal consistent fields for the target step (or documents that it sets only `questStepIndex` and lets `syncWorldToStep` derive the rest).
- localStorage disabled/unavailable (private mode) — readout shows defaults, operations degrade gracefully without throwing.
- Pause while inspector open — pause state should be visible in the panel.

## Dependencies

- `app/src/systems/Persistence.ts` (storage key, `WorldSaveState`, `defaultWorldState`, `loadWorldState`).
- `app/src/main.ts` (`syncWorldToStep`, `refreshQuestUI`/`refreshChoreUI`, `window.__lv` DEV block, `uiLayer`, HUD wiring).
- `app/src/systems/InputController.ts` (keyboard ownership contract — coexistence, not modification).
- `app/src/data/quest.ts` (`CHICKEN_COOP_QUEST`, step list, `BUILD_STAGES`, `HEN_COUNT`).
- `app/src/style.css` (panel styling), `app/src/ui/*` (panel conventions).
- Vite `import.meta.env.DEV` for the prod-stripping guard.

## Assumptions

- A-1: Backquote (`` ` ``) is an acceptable hotkey and does not conflict with any existing binding (verified: no Backquote handling in `InputController.ts`).
- A-2: The existing pause mechanism exposed as `window.__lv.setPaused()` is the correct pause primitive for FR-6.
- A-3: Jumping to a quest step only needs to set `questState`/`questStepIndex` and re-sync; `syncWorldToStep()` derives scene visibility from `buildProgress`/`chickensHome`, so the inspector may also set those to minimal consistent values for the target step (design decision at gate 2).
- A-4: A small reset helper (e.g. `clearWorldState()` in `Persistence.ts`) may be added; `world` is a `const` in `main.ts`, so reset mutates fields in place rather than rebinding.
- A-5: "Grant items" targets items already known to the inventory system; a free-text item name is acceptable fallback.

## Open questions

- OQ-1: Exact UX for grant-items (dropdown of known items vs free text) — low-blocking, resolvable at gate 2 without escalation.
- OQ-2: The contract's restated objective mentions "warp" (teleport) which appears in neither Intent nor the Gherkin scenarios — treated as out of scope for this run (OQ-2); can be added as a follow-up run.
- OQ-3: Whether jump-to-step should force `buildProgress`/`chickensHome` to consistent values or only set the step index (design decision, gate 2; affects EC-6).

None of the open questions block requirements quality — the contract's Gherkin is unambiguous on all six scenarios.

## Acceptance criteria traceability

| Gherkin scenario | Requirements covered |
|------------------|----------------------|
| Open the inspector with the hotkey | FR-1, FR-2, FR-8 |
| Close the inspector with the hotkey again | FR-1, FR-7 |
| Clear game state from the inspector | FR-3, FR-2 |
| Jump to a quest step | FR-4, FR-2 |
| Inspector does not hijack gameplay keys | FR-7, FR-8 |
| Production build contains no inspector | FR-8 |

Risk preview: impact 2, likelihood 2 → score 4 (preview, formula: Impact + Likelihood per state.md — authoritative formula Impact + Likelihood, range 2–10). Below tolerance (9); no hard-stop triggers.