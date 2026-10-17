# Decision Record (ADR-003)

| Field | Value |
|-------|-------|
| Status | Approved (gate 4 implementation) |
| Date | 2026-09-05 |
| Decided by | AI-SDLC gate 4 (Claude) |

## Context
The design note's file plan said to append the `.lv-debug-*` CSS block to
`app/src/style.css`. But `style.css` is imported unconditionally by `main.ts`, so
those bytes ship in the prod CSS bundle — verified empirically (first build:
`grep -c lv-debug dist/assets/*.css` = 1). That contradicts the same design
note's security requirement: "Prod bundle must contain zero inspector bytes."

## Decision
1. The debug CSS lives in `app/src/ui/debug-inspector.css`, imported only by
   `DebugInspector.ts`.
2. `main.ts` loads the inspector via a **dynamically imported** module inside the
   existing single `import.meta.env.DEV` guard (`void import("./ui/DebugInspector")…`),
   instead of a static import whose only use sits in the guard.
3. `main.ts` references `DebugInspector`/`DebugOps`/`DebugSnapshot` through a
   `import type` (erased at compile time).

## Verification
Fresh prod build greps: zero hits for `lv-debug` and `Backquote` across all of
`app/dist/` (JS **and** CSS). Dev build serves `/src/ui/DebugInspector.ts` (HTTP
200, CSS import intact). Build hash evidence in `04-implementation-plan.md`.

## Consequences
- Positive: prod emits zero inspector bytes with certainty (the whole dynamic
  import expression is inside a statically-false branch that DCE removes),
  strengthening R-1 beyond what the static-import design could prove.
- Negative: in dev the panel constructs a tick after boot (async import) —
  irrelevant for a dev tool; the ops closures are built synchronously so state
  reads are always live.
- Deviation from design detail: "append to style.css" replaced by the above;
  ADR-001's single-guard-site rule is preserved (the dynamic import sits inside
  the existing DEV block).