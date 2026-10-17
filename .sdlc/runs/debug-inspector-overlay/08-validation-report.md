# Gate 8 — Production Validation (LOCAL MODE)

**Run:** debug-inspector-overlay
**Date:** 2026-09-05
**Mode:** LOCAL ONLY — no production deployment was performed or attempted (hard rule from the orchestrating /goal skill).

## Deployment ladder resolution

1. `k8s/`, `deploy/`, `kustomization.yaml` — **absent** (no Kubernetes manifests in the project).
2. `docker-compose.yml` — **absent**.
3. Fallback used: **serve the production build directly** with `vite preview` over `app/dist/`, validated against `http://localhost:4173`.

## Validation performed

### 1. Fresh production build
- `npm run build` (tsc + vite) — **exit 0**, built in 509 ms, 30 modules.
- Only warning: chunk size > 500 kB (pre-existing, unrelated to this change).

### 2. Prod bundle purity (no inspector bytes)
- `grep -rl 'lv-debug|DebugInspector|Backquote' app/dist/` → **0 files matched**.
- Confirms DEV-only guard holds in the shipped artifact (matches gates 4, 5, 6 findings).

### 3. Local serve health checks (vite preview on :4173)
- `GET /` → **HTTP 200**
- `GET /assets/index-BMp4Hd-Q.js` → **HTTP 200**
- `GET /assets/index-DE9TVAMv.css` → HTTP 200 (verified in gate 5 run; asset unchanged since gate 7 verified all three 200s)
- All core assets served healthy from the production build.

### 4. Behavior-level verification (inherited, same build lineage)
Gate 5 (`05-validation-report.md`) verified **all 6 Gherkin acceptance scenarios in a real browser against both the dev app and a served production build** — 22/22 checks passing:
- Inspector toggles open/closed via the backquote hotkey; live state renders (day, coins, gems, quest step, inventory, build progress, chickens home).
- "Clear state" removes the `aws-valley/slice-1/world` localStorage key, resets world defaults, and re-syncs HUD/scene.
- Jump-to-quest-step applies and re-syncs the world (`syncWorldToStep` path).
- Normal WASD/E gameplay input is unaffected with the inspector hidden.
- Production bundle contains zero inspector code.

### 5. Process hygiene
- All `vite preview`/`vite dev`/playwright processes started during validation were killed and confirmed down.

## Deviations and notes

- The gate 8 subagent twice hit a stream-watchdog stall (environment-level, coinciding with a safety-classifier outage), and its persona-flow child agents also stalled before reporting. Persona-style journey walkthroughs are therefore **not** part of this report's direct evidence; behavior-level coverage rests on gate 5's browser-level verification (22/22) plus the direct build/serve/purity checks above, performed directly by the orchestrator in this session.
- semgrep had no network access during gate 6 (ruleset blocked); manual sweeps substituted (clean).

## Result

| Check | Result |
| --- | --- |
| Build | ✅ clean (exit 0) |
| Prod bundle free of inspector code | ✅ 0 matches |
| Local serve healthy | ✅ 200 on index/JS/CSS |
| Acceptance scenarios (browser-level) | ✅ 22/22 (gate 5) |
| No processes left running | ✅ |

**Gate 8: PASSED** — local deployment healthy; inspector feature validated end-to-end at browser level; prod bundle clean.

**Next gate:** 9 — Learning.