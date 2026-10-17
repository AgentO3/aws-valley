# Risk Register — debug-inspector-overlay

| Field | Value |
|-------|-------|
| Gate | 3 — Risk (question: is it safe to proceed?) |
| Date | 2026-09-05 |
| Autonomy | Level 5, risk tolerance 9 |
| Formula (frozen, per `state.md`) | Risk score = Impact + Likelihood (range 2–10) |

## Risk table

| # | Risk | Severity | Likelihood | Mitigation | Owner |
|---|------|----------|-----------|------------|-------|
| R-1 | Inspector code leaks into the prod bundle (DCE of `import.meta.env.DEV` fails, or a second unguarded reference appears) — player-visible debug panel + state-mutating buttons in production | High (4) | 2 | Single guard site (existing DEV block in `main.ts`) per ADR-001; no inspector import outside it; gates 5 & 8 verify by `npm run build` + grepping `dist/` for `lv-debug`/`Backquote` | Gate 5/8 (test/validation) |
| R-2 | Inspector keyboard handling interferes with gameplay input (WASD/E/space/arrows) or hotkey fires while typing in panel inputs | Med (3) | 2 | Listener reacts only to Backquote (verified unused by `InputController`), never `preventDefault`/`stopPropagation`; toggle skipped when `e.target` is an input/select inside the panel (FR-7) | Gate 4 (implementation) |
| R-3 | Inspector ops corrupt persisted world state (clear/jump/grant writes an inconsistent or unloadable save) | Med (3) | 2 | All ops go through the same paths `main.ts` itself uses (`persist()`, `syncWorldToStep()`); `loadWorldState()` already merge-fills defaults and falls back on parse errors; ops wrapped in try/catch with inline panel error (design: error handling) | Gate 4 (implementation) |
| R-4 | Shadowed `questStepIndex` trap — writing `world.questStepIndex` is silently ignored (module `let` shadows it), producing a jump op that appears to work but does nothing | Med (3) | 1 | Designed around in ADR-001: ops closures are created inside `main.ts`'s DEV block and write the module `let` directly; compile-time-checked typed scope; gate 5 test asserts the step index actually moves | Gate 5 (test plan) |
| R-5 | 1 s refresh ticker leaks after hide (interval not cleared) → background DOM writes / minor frame cost while playing | Low (1) | 2 | Design: interval started on show, cleared on hide; gate 5 test asserts ticker stops when panel hidden | Gate 5 (test plan) |
| R-6 | Jump-to-step lands in a visually inconsistent scene (e.g. step 4 with no built coop), making the step untestable | Low (2) | 1 | ADR-002: minimal consistent fields forced (`buildProgress=3`, `coopBuilt=true`, `chickensHome=0` for step 4 only); panel renders which fields each jump sets; gate 5 asserts scene consistency per jump | Gate 5 (test plan) |
| R-7 | Rapid Backquote toggling creates duplicate panels/listeners or races the ticker | Low (1) | 1 | Panel constructed once at DEV boot; listeners registered once; toggle is a class flip — idempotent by construction (design: state model) | Gate 4 (implementation) |

## Risk classification

- **Impact (overall): 2** — dev-only surface; realistic worst case is a corrupted *developer* save (recoverable via clear-state) or a short-lived dev annoyance. The only player-facing failure (R-1, prod leak) is caught by deterministic bundle checks at gates 5/8 before any release; no production deployment is in scope (gate 8 validates locally).
- **Blast radius: small** — one new UI module, the existing DEV block in `main.ts`, one additive Persistence helper, one CSS block. No gameplay, HUD, quest logic, persistence format, or `InputController` change.
- **Complexity: low** — no new dependencies, no framework, follows the repo's existing panel convention; Option A chosen at gate 2 as the lowest-complexity sound option.
- **Uncertainty: low** — every pattern the design relies on was verified against the actual code at gate 2 (DEV guard proven by the existing `__lv` block, Backquote confirmed unused, storage key/defaults-merge confirmed). All three open questions (OQ-1/2/3) closed at gate 2.

## Computed risk score

| Component | Value | Rationale |
|-----------|-------|-----------|
| Impact | 2 | Dev tool; worst credible harm is a recoverable dev-side state mess; player surface protected by DCE + bundle verification |
| Likelihood | 2 | Well-understood, small change; patterns verified against real code; the one subtlety (shadowed `questStepIndex`) is explicitly designed around |
| **Score (Impact + Likelihood)** | **4** | Range 2–10; tolerance 9 → proceed |

Formula check: identical to the previews at gates 1 and 2 (impact 2, likelihood 2 → 4). No drift — no prior gate used a different formula.

## Hard-stop escalation checklist

| Trigger | Applies? |
|---------|----------|
| Auth/authz changes | No |
| Payments | No |
| PII / sensitive data | No (reads/writes only the game's own localStorage key; no telemetry, no network) |
| Schema / data migration | No (`WorldSaveState` untouched; only additive `clearWorldState()` helper; existing saves load unchanged) |
| Public API break | No (sole export additions are additive and DEV-scoped) |
| New dependency | No (zero new npm packages) |
| Production deployment | No (local dev tool; gate 8 validates locally only) |
| Failed tests (unclear cause) | No (no test suite exists yet; gate 5 defines the strategy) |
| Security scan failure | No |
| Ambiguous requirements / >20% uncertainty | No (contract Gherkin unambiguous; all OQs closed at gate 2) |
| Exceeds approved scope | No ("warp" explicitly out of scope per OQ-2) |

**Triggers fired: none.**

## BDR / conformance impact

No open question changes a schema, data model, or persisted on-disk surface, so no
new conformance line is owed. For completeness — OQ-3 (closed at gate 2 via
ADR-002) concerns runtime writes to persisted *fields* (`questStepIndex`,
`questState`, `buildProgress`, `coopBuilt`, `chickensHome`). Conformance check
against the referencing surfaces: the persisted **shape** is unchanged
(`WorldSaveState` untouched; defaults-merge load path unchanged), so the contract
Gherkin (clear-state and jump scenarios) and ADR-002's own semantics are
**preserved**, not weakened or broken. The `aws-valley/slice-1/world` key is
only ever removed by an explicit dev click (FR-3), which the contract scenario
itself specifies.

## Escalation decision

**Escalation required: No.**
Reason: risk score **4 < tolerance 9**, and no hard-stop trigger fired. The change is safe to proceed to implementation.