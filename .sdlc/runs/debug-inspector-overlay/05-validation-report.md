# Validation Report — debug-inspector-overlay

| Field | Value |
|-------|-------|
| Gate | 5 — Test |
| Date | 2026-09-05 |
| Verdict | **Passed** — 22/22 checks green, no hard-stop triggers |
| Evidence | Browser-level run against the real dev app (`localhost:5173`) and the served prod build (`localhost:4173`); static checks on `app/dist/` |

## Passed

| # | Check | Evidence |
|---|---|---|
| 1 | `npm run build` (tsc strict + vite) | exits 0, no type errors (`dist/assets/index-BMp4Hd-Q.js`) |
| 2 | Prod JS bundle free of inspector bytes | `grep -rl "lv-debug" app/dist/` → 0 files |
| 3 | Prod JS bundle free of Backquote/op identifiers | `grep -rlE "Backquote\|debug-inspector\|clearWorldState\|jumpToStep\|grantItem" app/dist/` → 0 files |
| 4 | Prod CSS free of inspector styles | `grep -rl "debug" app/dist/assets/*.css` → 0 files |
| 5 | Secret scan on changed files | no matches (`api_key|secret|password|private key`) |
| 6 | Dev app mounts | canvas present, `window.__lv` object exists |
| 7 | Scenario 1 — hotkey opens panel with live state | `.lv-debug-inspector` visible; rows: day 1, coins 0, gems 0, quest available, step "0 Talk to the Carpenter", build 0 (coop: no), hens 0, chore —, paused no, inv — |
| 8 | Scenario 2 — hotkey closes panel | second backtick → `visible=false` |
| 9 | FR-7 typing guard | backtick with focus in qty `<input>` → panel stays open |
| 10 | Scenario 4 + R-4 + R-6 — jump to step 4 | `questStep()=4`, `questState=active`, `buildProgress=3`, `coopBuilt=true`, `chickensHome=0`, localStorage save written; forced-fields note rendered in panel |
| 11 | Jump to step 0 (non-forced) | index moves to 0; build/coop values untouched (ADR-002: "No other fields are forced") |
| 12 | Grant item op | `world.inventory = {berry: 1}` |
| 13 | Pause/Resume op | button flips Pause↔Resume, readout `paused` yes/no |
| 14 | Scenario 3 — Clear state | `localStorage['aws-valley/slice-1/world'] = null`, world reset to defaults (coins 0, step 0, empty inventory), HUD re-synced; key not immediately re-created |
| 15 | R-5 ticker stops on hide | with panel hidden, `world.coins=77` after 1.7 s → cell still stale (99); on reopen cell renders 77 |
| 16 | R-7 rapid toggling | 6 rapid backtick presses → exactly 1 `.lv-debug-inspector` node |
| 17 | Scenario 5 — gameplay keys, panel hidden | hold `w` 1.2 s: player position `[0.2,0,-12.89]` → `[0.2,0,-18.28]` |
| 18 | R-2 — gameplay keys, panel open | hold `w` 1 s: position changed (`-18.28` → `-23.18`); no `preventDefault` interference |
| 19 | Negative — grant qty 0 | inventory unchanged, inline error element stays hidden |
| 20 | Console cleanliness | 0 browser console errors across the full dev-session run (1 pre-existing warning) |
| 21 | Scenario 6 — prod build in a browser | `vite preview` of `dist/`: canvas mounts, 0 `[class*=lv-debug]` elements, 0 console errors |
| 22 | Scenario 5 re-check after all ops | movement with panel hidden still works post-clear/jump/grant |

## Failed + remediation

None. No check failed. One **test-harness bookkeeping misstep** (not a product
defect): an intermediate R-5 attempt mislabeled panel visibility and one suppressed
backtick press was lost, making the panel state off-by-one from my assumption; the
check was repeated with visibility verified before and after every press and passed
(cleanly toggling false→true→false). The panel's toggle behavior itself was
deterministic throughout.

## Not run + reason

- **Formal unit suite (fake `DebugOps`)** — no test runner in the repo; adding one is
  a new dependency requiring user approval. Every behavior the planned unit tests
  would assert was verified at browser level instead (checks 7–19).
- **Reload-after-jump persistence** — the write side was verified (`saved: true`); the
  load path is unchanged existing code.
- **A11y / performance suites** — not applicable to a DEV-only panel; see test plan.
- **`npm test`** — stub in this repo; carries no gate signal.

## Static checks

| Check | Result |
|---|---|
| `tsc` strict compile | pass |
| `vite build` | pass (bundle-size warning pre-existing, unrelated) |
| Prod-bundle inspector-byte grep (JS) | pass — 0 hits |
| Prod-bundle inspector-byte grep (CSS) | pass — 0 hits |
| Secret scan (changed files) | pass — 0 hits |

## Residual risk

- Prod-leak protection (R-1) now rests on three independent deterministic checks
  (grep JS, grep CSS, live prod-browser assertion); likelihood drops to 1.
- Jump semantics leave prior forced fields in place when jumping from step 4 back to
  a lower step (verified; explicitly approved by ADR-002, panel shows live values,
  `clearState` provides the reset path).
- No reload-persistence runtime check for jumped state (load path unchanged; see Not run).

## Risk reassessment

Impact 2 unchanged (dev-only surface, no player-facing path — now runtime-verified,
not just asserted). Likelihood lowered **2 → 1**: all Gherkin scenarios pass in a real
browser, all mitigations for R-2/R-4/R-5/R-7/R-6 asserted positively, and R-1 is
verified three independent ways. **New score: 2 + 1 = 3** (was 4), below tolerance 9.

## Traceability: requirement → implementation → test → evidence

| Requirement (contract Gherkin) | Implementation | Test | Evidence |
|---|---|---|---|
| S1 open via `` ` `` + live state | `main.ts` DEV keydown → `DebugInspector.toggle()`; snapshot renderer | 6, 7, 20 | check 7 output |
| S2 close via `` ` ``, gameplay resumes | same toggle; no preventDefault | 8, 15, 17, 22 | checks 8/15/17/22 |
| S3 clear state → defaults + re-sync | `debugOps.clearState` → `clearWorldState()` + in-place reset + `syncWorldToStep` + HUD | 14 | check 14 output |
| S4 jump quest step + re-sync | `debugOps.jumpToStep` writes module `questStepIndex` + ADR-002 forcing | 10, 11, 19 | check 10 output |
| S5 no key hijack | listener reacts only to Backquote, never preventDefault | 17, 18 | position deltas |
| S6 no inspector in prod | DEV-guarded block + dynamic import + isolated CSS (ADR-003) | 1–4, 21 | greps + preview eval |
| R-2 typing guard | `contains()` input/select/textarea guard | 9 | check 9 |
| R-5 ticker lifecycle | `setInterval` on show, `clearInterval` on hide | 15 | stale-cell proof |
| R-7 idempotent toggle | single construction, class flip | 16 | 1 panel after 6 presses |
| R-3 ops safe | ops reuse persist/sync/load paths; choke-point try/catch | 14, 19 | no error line, key semantics |