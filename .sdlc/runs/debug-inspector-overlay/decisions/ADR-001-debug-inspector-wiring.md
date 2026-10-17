# Decision Record (ADR-001)

| Field | Value |
|-------|-------|
| Status | Approved |
| Date | 2026-09-05 |
| Decided by | AI-SDLC gate 2 (Claude) |

## Context
The debug inspector needs access to main.ts module internals that are NOT exposed
on `window.__lv`: the `questStepIndex` module `let` (line 81, which shadows
`world.questStepIndex` — writes through `__lv.world.questStepIndex` are silently
ignored), the `paused` flag (write-only via `__lv.setPaused`, no getter),
`hud`, `refreshQuestUI`, `refreshChoreUI`, and `persist()`. A standalone
inspector module cannot reach these except through the `__lv` handle, whose
surface is both incomplete and partly a trap (the shadowed `questStepIndex`).

## Decision
Split the feature into a **pure-UI module + DEV-wired ops closures**:

1. `app/src/ui/DebugInspector.ts` — a `DebugInspector` class following the
   existing panel convention (`(layer: HTMLElement)` constructor, builds one
   `.lv-debug-inspector` root div, toggles a `.visible` class). It owns zero
   game state. Its constructor takes a `DebugOps` interface:
   `{ getState(); clearState(); jumpToStep(i); grantItem(id, qty); setPaused(v); isPaused(); }`.
2. `app/src/main.ts` DEV block (the existing `if (import.meta.env.DEV)` block at
   lines 900–941) constructs the inspector and passes closures that mutate the
   module internals directly (`questStepIndex`, `paused`, `world`, `persist`,
   `syncWorldToStep`, `hud.setCurrency`, `refreshQuestUI`, `refreshChoreUI`).
3. The backquote toggle listener is registered inside that same DEV block.

## Approved behavior & constraints
- The inspector module must never import or touch `window.__lv` and must never
  mutate `world` itself — all mutation flows through the ops closures.
- All construction, listener registration, and imports-usage stay inside the
  single `import.meta.env.DEV` guard; no second guard site.
- `DebugOps` is the only coupling surface between UI and game logic.

## Alternatives considered
- **Reach through `window.__lv` only:** rejected — `__lv` lacks `hud`,
  `refreshQuestUI`, `refreshChoreUI`, a paused getter, and a safe
  `questStepIndex` write path; widening `__lv` to compensate spreads debug
  surface across two guard sites.
- **Full `DebugController` system module owning state mutations:** rejected as
  over-engineering for a small increment — it would duplicate main.ts's
  persistence/refresh wiring.

## Consequences
- Positive: single guard site; module internals stay private; UI is testable
  against a fake `DebugOps`; prod stripping is one static `if (false)`.
- Negative: the DEV block in main.ts grows (~40 lines of wiring); closures keep
  references to main.ts scope (acceptable — the block already does this).
- Follow-up: gate 4 implementation plan must sequence the wiring inside the
  existing block, not a new one.