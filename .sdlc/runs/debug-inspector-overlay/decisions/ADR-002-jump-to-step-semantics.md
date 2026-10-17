# Decision Record (ADR-002)

| Field | Value |
|-------|-------|
| Status | Approved |
| Date | 2026-09-05 |
| Decided by | AI-SDLC gate 2 (Claude) |

## Context
OQ-3 (requirements brief): should "jump to quest step" set only
`questStepIndex`, or also force `buildProgress`/`chickensHome`/`coopBuilt` to
consistent values? `syncWorldToStep()` (main.ts:151) derives scene visibility —
crate, coop rubble, completed coop, hen placement — from `buildProgress` and
`chickensHome`, not from `questStepIndex`. Jumping to step 4 ("Chickens move
in") with `buildProgress = 0` would hide the completed coop and the hen crate,
making the step untestable; jumping to step 3 ("Build the coop") with leftover
`buildProgress` would skip build stages.

## Decision
`jumpToStep(i)` sets the step index plus **minimal consistent world fields**:

- Always: `questStepIndex = i`, `world.questState = "active"`.
- Only when target step is 4 (`move_in_chickens`): `world.buildProgress =
  BUILD_STAGES` (3), `world.coopBuilt = true`, `world.chickensHome = 0` — so
  the completed coop and hen crate exist and the hens are still to move in.
- No other fields are forced; steps 0–3 need no derived-field changes.

Then: `persist()` (writes `world` + module `questStepIndex` to localStorage),
`syncWorldToStep()`, `hud.setCurrency(world.coins, world.gems)`, and a panel
re-render.

## Approved behavior & constraints
- Jumping is a one-way write; the inspector never recomputes fields on steps
  0–3 beyond `questState`/`questStepIndex`.
- The panel documents (renders) which fields each jump sets, so the developer
  knows what was forced.

## Alternatives considered
- **Index-only jump:** rejected — leaves steps 3–4 in visually inconsistent
  scene states (EC-6 in the brief), defeating the fast-forward purpose.
- **Full per-step state machine rebuild (materials, attempts, gatheredOnDay):**
  rejected — over-coupling the inspector to quest internals for marginal value;
  a full reset (`clearState`) covers the "start clean" need.

## Consequences
- Positive: every jump lands in a playable, visually consistent scene.
- Negative: jump-to-4 overwrites any partial build progress (accepted — dev op).
- Follow-up: gate 5 test plan should assert scene consistency after each jump
  (coop visibility matches target step).