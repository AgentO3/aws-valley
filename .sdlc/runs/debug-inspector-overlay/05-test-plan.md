# Test Plan — debug-inspector-overlay

| Field | Value |
|-------|-------|
| Gate | 5 — Test (question: can we prove it works?) |
| Date | 2026-09-05 |
| Autonomy | Level 5, risk tolerance 9 |
| Contract | `contract.md` acceptance Gherkin (6 scenarios) |
| Strategy pack | `.claude/skills/sdlc-knowledge/reference/context-packs/06-test-strategy.md` |

## Strategy

No test runner exists in the repo (`npm test` is a stub; adding vitest/jest would be a
new, unapproved dependency — flagged in the risk register and implementation plan).
The strategy is therefore **deterministic static checks + browser-level verification**
against the real app, which matches the change class (Small feature increment, dev-only
UI + one additive persistence helper):

1. **Static**: strict build (`tsc` + `vite build`) and prod-bundle greps prove R-1
   (no inspector bytes in `dist/`) — deterministic, repeatable, CI-able.
2. **Dynamic (browser)**: drive the real dev app with a real browser (playwright-cli)
   through every acceptance scenario and every testable risk-mitigation assertion
   (R-2, R-4, R-5, R-7), reading actual DOM and actual game state via `window.__lv`,
   not mocked behavior — per pack 06 "do not mock the behavior being tested".
3. **Prod build in a browser**: serve `dist/` and assert the game mounts with zero
   inspector elements (scenario 6 at runtime, not just by grep).

**Not worth testing / not testable here, and why:**
- **Formal unit tests with a fake `DebugOps`** (proposed in the implementation plan):
  the panel UI logic is exercised end-to-end in the browser anyway; a unit runner
  cannot be added without an unapproved dependency. Substituted 1:1 by dynamic checks
  7–20 below. If a runner is ever approved, `DebugInspector`'s pure-snapshot design
  makes it directly unit-testable.
- **Accessibility pass**: the panel is a dev-only tool, hidden in prod by verified DCE;
  a11y investment is disproportionate (panel uses text labels + native
  select/input/button elements).
- **Performance/load**: one `setInterval` (1 s) while visible, cleared on hide and
  proven stopped (check 15). No latency-sensitive path touched.
- **Security**: no auth, network, or sensitive data; secret scan on changed files is
  the only applicable check.

## Coverage by layer

| Layer | What | Checks |
|---|---|---|
| Unit | None — no runner in repo (see above) | — |
| Integration | Ops closures through real persist/sync/HUD paths in the live app | 10–15 |
| Contract | Persisted shape unchanged; localStorage key semantics (removed by clear, written by jump/grant) | 10, 14 |
| E2E (browser, dev) | All 6 Gherkin scenarios + risk assertions | 6–20 |
| E2E (browser, prod build) | Game mounts, inspector absent | 21 |
| Static / regression | Strict build, prod-bundle grep, secret scan | 1–5, 22 |
| Negative & abuse | qty 0 grant (no-op, no error line), backquote typed inside panel inputs (guard), rapid toggling (R-7) | 9, 16, 19 |
| Performance / a11y / security | Not applicable — see above | — |

## Test data

Real app on the Vite dev server; game state in the browser profile's localStorage
under `aws-valley/slice-1/world` (in-memory playwright profile — no fixture
files, no PII, user's own browser storage untouched).

## Traceability table

| # | Check | Traces to |
|---|---|---|
| 1 | `npm run build` (tsc strict + vite) exits 0 | R-1, plan slices 1–3 |
| 2 | `grep -r "lv-debug" app/dist/` → 0 files | R-1, scenario 6 |
| 3 | `grep -rE "Backquote\|debug-inspector\|clearWorldState\|jumpToStep\|grantItem" app/dist/` → 0 files | R-1, scenario 6 |
| 4 | `grep "debug" app/dist/assets/*.css` → 0 files | R-1 (ADR-003 CSS isolation) |
| 5 | Secret scan on changed files (`DebugInspector.ts`, `debug-inspector.css`, `Persistence.ts`) | pack 06 / security |
| 6 | Dev app mounts: canvas present, `window.__lv` object | smoke rule (pack 06: assert render, not 200) |
| 7 | S1: backquote → `.lv-debug-inspector` visible; rows day/coins/gems/quest/step/build/hens/chore/paused/inventory populated | Scenario 1 |
| 8 | S2: second backquote → hidden | Scenario 2 |
| 9 | FR-7: backquote with focus in qty `<input>` → panel stays open | R-2, scenario 2 note |
| 10 | S4/R-4: select step 4, Apply → `questStep()` = 4, `questState=active`, `buildProgress=3`, `coopBuilt=true`, `chickensHome=0`, save present in localStorage | Scenario 4, R-4, R-6 |
| 11 | Jump to step 0 → index moves, no fields forced (ADR-002 semantics) | Scenario 4, R-6 |
| 12 | Grant item (default selection, qty 1) → `world.inventory.berry = 1` | FR (grant op) |
| 13 | Pause → button flips to "Resume", readout `paused=yes`; second click resumes | FR (pause op) |
| 14 | S3: Clear state → localStorage key `aws-valley/slice-1/world` is `null`, world = defaults (coins 0, step 0, empty inventory), HUD re-synced | Scenario 3, R-3 |
| 15 | R-5: with panel hidden, mutate `world.coins` → cell stays stale for 1.7 s; on reopen cell renders fresh | R-5 |
| 16 | R-7: 6 rapid backquote presses → exactly 1 `.lv-debug-inspector` node | R-7 |
| 17 | S5: hold `w` 1.2 s with panel hidden → player position changes | Scenario 5, R-2 |
| 18 | R-2: hold `w` 1 s with panel **open** → player position still changes | R-2, scenario 5 |
| 19 | Negative: grant with qty `0` → inventory unchanged, inline error stays hidden | negative/abuse |
| 20 | Browser console: 0 errors across the whole dev-session run | regression |
| 21 | S6: serve prod build (`vite preview`) → canvas mounts, zero `[class*=lv-debug]` elements | Scenario 6, R-1 |
| 22 | S5 re-verified after all ops (movement with panel hidden, post-clear) | Scenario 5 |

## Not run

| Check | Reason |
|---|---|
| Formal unit suite (fake `DebugOps`) | No test runner in repo; adding one is an unapproved new dependency. Equivalent behaviors verified at browser level (checks 7–19). |
| Reload-after-jump persistence | Persisted-write verified (`saved: true`, check 10); the load path (`loadWorldState()` defaults-merge) is unchanged code exercised by every app boot — no new load behavior introduced. |
| Visual/scene screenshot assertions for R-6 | Derived-field values driving `syncWorldToStep()` verified (check 10); full visual diff adds flakiness for a dev tool. |
| `npm test` | Stub in this repo; not part of any gate signal. |