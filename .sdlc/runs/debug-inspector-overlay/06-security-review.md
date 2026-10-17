# Security & Privacy Review — debug-inspector-overlay

| Field | Value |
|-------|-------|
| Gate | 6 — Security & Privacy (question: is it safe?) |
| Date | 2026-09-05 |
| Autonomy | Level 5, risk tolerance 9 |
| Scope | `app/src/ui/DebugInspector.ts` (new), `app/src/ui/debug-inspector.css` (new), `app/src/systems/Persistence.ts` (+`clearWorldState`), DEV block of `app/src/main.ts` |
| SecOps report | `06-secops-report.md` (same directory) — consolidated into this review |
| Change class | NOT security/auth-class (no auth, authz, payment, sensitive data, public attack surface, or external integration) — compact threat model included anyway for the change's own stated surface |

## Security review — findings

| # | Area | Finding | Severity | Mitigation | Status |
|---|------|---------|----------|------------|--------|
| F-1 | Injection / XSS | `DebugInspector.ts:80` builds the panel scaffold with `innerHTML`. Audited line-by-line: the template is fully static (labels, class names, empty `data-kv`/`data-ref` slots); every dynamic value — state cells (`setCell` → `textContent`), the error line (`showError` → `textContent`), select options (`createElement` + `textContent`) — is written via safe sinks. No untrusted input reaches the sink (inputs are a fixed `<select>` of `ITEMS`/quest-step values plus a numeric qty, all validated in `main.ts` ops before use). SAST agent corroborated repo-wide: all 23 `innerHTML` sites in `app/src` are static or static-data templates; no `eval`/`new Function`/`document.write` anywhere. | Low (latent) | Rule for future edits: dynamic content only via `textContent`; build data-driven markup with `createElement`. | Verified safe — accepted with defense-in-depth note |
| F-2 | Input validation | Grant op clamps qty at the floor only (`Math.max(0, Math.floor(...))`); no upper bound. `jumpToStep` is fully bounded (integer, 0–4); `grantItem` validates `ITEMS[itemId]` membership and finiteness. Oversized qty only inflates the dev-side localStorage save. | Low | Optional: clamp to a sane max (e.g. 999) if the panel sees real use. | Accepted (dev-only surface; prod unreachable) |
| F-3 | Debug code in prod | **Primary risk for this change.** Inspector bytes must not ship. Verified four independent ways this run: (1) code audit — one `import.meta.env.DEV` guard (`main.ts:894`), type-only import, **dynamic** `import("./ui/DebugInspector")` inside that guard, inspector CSS isolated in its own file imported only by the inspector (ADR-003, adopted after a first build leaked CSS bytes via unconditional `style.css` import — caught and fixed at gate 4); (2) fresh `grep -r "lv-debug\|Backquote\|debug-inspector\|clearWorldState\|jumpToStep\|grantItem" app/dist/` → 0 hits (JS + CSS); (3) gate 5 browser check of `vite preview`: 0 `[class*=lv-debug]` elements; (4) gate 5 static greps 1–4. | Low (residual) | Keep the bundle grep as a repeatable check at every release; consider codifying it as a `bin/` check script. | Mitigated — verified |
| F-4 | Secrets | Three scanners (gitleaks, trufflehog, detect-secrets) + gate-5 changed-file scan: **0 secrets** in `app/src`, both package.json files. `learnerId: "learner_local"` is a static placeholder. No `.git` history exists to scan. | — | none needed | Clean |
| F-5 | Unsafe logging | Panel logs `console.debug("[debug-inspector]", op, "ok")` and `console.warn(... failed, err)` — op labels contain item ids and quantities only; no secrets, credentials, or PII. Entirely DEV-scoped (inside the guard / inside the dynamically imported dev module). | — | none needed | Clean |
| F-6 | Authentication / authorization | Not applicable — no auth, no backend, no network. Confirmed: zero `fetch`/XHR/WebSocket/`http(s)://` occurrences in `app/src`. | — | — | N/A |
| F-7 | Abuse cases | A user of a DEV build could grant items, jump quest steps, or clear their own local save — exactly the intended developer operations; no rate limiting needed for a local, keyboard-driven panel. A `vite --host` networked dev server would expose the page, but every op requires local keyboard interaction and touches only that browser's own localStorage. | Info | none | Accepted |
| F-8 | Error leakage | Op failures render one inline panel line (textContent) and `console.warn` — never re-thrown into the game loop; corrupted saves fall back to defaults via existing `loadWorldState` behavior. No internal error surfaces beyond the dev console. | — | none needed | Clean |

**Tally: 0 high / 0 medium / 2 low / rest clean-or-N/A.** No medium/high findings → no escalation trigger.

## Privacy review

- **PII:** none. The only persisted surface is the game's own localStorage key `aws-valley/slice-1/world` (game fields; `learnerId` is the constant `"learner_local"`). No names, emails, identifiers, or behavioral profiles.
- **Storage/retention:** local-only; `clearWorldState()` (new) removes exactly that one key — verified it is the sole localStorage accessor in `app/src` (Persistence.ts only).
- **Consent & auditability:** not applicable — no data leaves the browser (no telemetry, no network calls), so there is nothing to consent to or audit externally; ops are visible in the dev console.
- **Regulatory obligations:** none triggered (no personal data processing, no transmission, no third parties).

**Privacy verdict: no privacy obligations triggered.**

## Threat model (compact — change is not auth-class, model included for the stated surface)

| Asset | Attack surface | Threat | Control | Residual risk |
|---|---|---|---|---|
| Prod bundle purity | Vite DCE of the DEV-guarded block | Debug panel + state-mutating ops ship to players | Static-false branch → DCE; dynamic import; isolated CSS; quadruple verification (code audit, fresh bundle grep, prod-browser assertion, gate-5 greps) | Low — if Vite ever changes DCE behavior the grep catches it; codify as script |
| Player's local save | Ops closures (`clear`/`jump`/`grant`) | Ops corrupt persisted state | Ops reuse the exact paths `main.ts` itself uses (`persist()`, `syncWorldToStep()`); validated inputs; try/catch choke point; defaults-merge load + parse fallback | Low — worst case is a recoverable dev-side save (clear-state fixes it) |
| Panel DOM | `innerHTML` scaffold + dynamic readout | XSS via inspector content | All dynamic values via `textContent`/`createElement`; inputs are fixed selects + number field; nothing user- or network-supplied exists in the app | Low (F-1) |
| Secrets | Source + manifests | Credential leakage | 0 findings across gitleaks/trufflehog/detect-secrets | None |
| Gameplay input | `window` keydown listeners | Hotkey hijacks or blocks WASD/E/space | Listener reacts only to `` ` ``; never `preventDefault`/`stopPropagation`; typing guard for panel fields; `InputController` untouched; verified by position-delta tests with panel open and hidden | None observed |

## Consolidated SecOps results (from `06-secops-report.md`)

- Secrets: 0 (gitleaks, trufflehog, detect-secrets — triple-corroborated)
- SAST: 0 exploitable (semgrep rules could not load — registry blocked; six mandated manual sweeps + per-hit review of all 23 innerHTML sites substituted, all clean)
- SCA: 0 vulnerabilities (npm audit app + root, osv-scanner — both clean)
- SBOM: 49 components (CycloneDX, `/tmp/sbom-aws-valley.json`)
- IaC / containers / K8s / Actions / git history: not applicable (none present)
- **No high/critical tool findings → gate not blocked.**

## Residual security risk

1. **Prod leak (R-1 residual):** protection rests on Vite's DCE of one statically-false branch plus the bundle greps. Four verifications pass today; keep the grep at every release (gate 8 re-runs it).
2. **semgrep coverage gap:** ruleset couldn't load in this environment; manual sweeps covered the mandated patterns. Rerun with network access if desired.
3. **No upper bound on grant qty** (F-2) — dev-only, accepted.
4. **No formal test suite** — behaviors verified at browser level; if a runner is ever approved, the pure-`DebugOps` design is directly unit-testable.

## Risk reassessment

- Impact: **2** (unchanged) — dev-only surface; no player-facing path exists in the prod bundle (runtime-verified), no network, no PII, no secrets.
- Likelihood: **1** (unchanged from gate 5) — every mitigation asserted positively by four independent checks; scanners found nothing new.
- **Score: 2 + 1 = 3** (formula: Impact + Likelihood, range 2–10) — below tolerance 9. Unchanged from gate 5; security review raised nothing.

## Escalation decision

**Escalation required: No.** Score 3 < tolerance 9; no hard-stop trigger (no auth change, no security-sensitive behavior change, no medium/high finding).

## Verdict

**Gate 6: PASSED.** Safe to proceed to gate 7 (Release).