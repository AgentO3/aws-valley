---
id: smoke-testing
layer: practices
extends: []
---

# Smoke Testing

## Purpose

A smoke test is the smallest possible suite that answers one question — "did the build / deploy produce a system that obviously works?" — before more expensive tests run or real traffic touches it. The discipline derives its value from being narrow, fast, and ruthlessly reliable: a single flake erodes the signal, a single deep-assertion-creep turns it into a regression suite that nobody waits for, and a single skipped run after a deploy means the next page someone gets is from a real user. The technique is only useful when smoke tests are kept distinct from unit / integration / end-to-end tiers (they are not a substitute for any of them), gated as a stop-the-line signal both in the build pipeline and in the post-deploy probe, scoped to the critical paths the business cannot tolerate being broken (login, checkout, health endpoint, key API responding), and held to a tight wall-clock budget so the team actually waits for them. This spec pins what counts as a smoke test, where it runs in the pipeline, what it asserts, what it never asserts, the failure protocol, and the relationship to the deeper testing tiers — so smoke testing remains a fast, trustworthy "does anything obvious blow up?" check rather than a slow knockoff of integration testing.

## Do

- Pick one test per business-critical path (login, checkout, primary API responds, health endpoint, key page renders).
- Run smoke tests in the build pipeline immediately after the artifact is produced and before any deploy gate.
- Re-run the same smoke suite against every deployed environment within minutes of the deploy completing.
- Hold the suite to a tight wall-clock budget (target ≤ 2 minutes; hard cap ≤ 5 minutes).
- Treat any smoke failure as a stop-the-line signal — block the next pipeline stage and page the on-call.
- Quarantine flaky smoke tests by removing them from the suite immediately and fixing them in a tracked ticket.

## Don't

- Don't grow the smoke suite into a regression suite "while we're at it" — push deeper assertions into integration / E2E.
- Don't accept a failed-then-passed smoke run on retry; if it can flake, it isn't smoke-grade.
- Don't skip the post-deploy smoke run because the pre-deploy one passed — they prove different things.
- Don't smoke-test against mocks; the value is exercising the deployed real system end-to-end.
- Don't substitute a smoke pass for a full test suite; smoke is a sanity check, not a release qualifier.
- Don't add smoke tests for features that aren't business-critical — every test added is wall-clock the next deploy waits on.

## References

- **spec** `unit-testing` — deeper, tier-distinct test discipline smoke testing does not replace
- **spec** `integration-testing` — adjacent tier; smoke runs the deployed artifact, integration runs the wired system
- **spec** `tdd` — inner-loop discipline; smoke testing is an outer-loop pipeline gate
- **external** `https://en.wikipedia.org/wiki/Smoke_testing_(software)` — Smoke testing (software) overview
- **external** `https://martinfowler.com/articles/testing-culture.html` — Testing culture (Fowler) — context for tiered testing
- **external** `https://docs.microsoft.com/devops/develop/shift-left-make-testing-fast-reliable` — "Shift left" testing pipeline guidance

## Rules

1. Maintain a separate, named smoke-test target distinct from unit / integration / end-to-end suites (`pytest -m smoke`, `make smoke`, `npm run test:smoke`); do not run smoke tests as part of the unit or integration target.
2. Limit the smoke suite to one test per business-critical path agreed with product / on-call (login works, primary API endpoint responds 2xx, checkout submits, health endpoint reports `ok`, key page renders without 5xx); do not add a smoke test for a non-critical capability.
3. Cap the smoke suite's total wall-clock time at a documented budget (target ≤ 2 minutes, hard ceiling ≤ 5 minutes); do not let the suite grow past the ceiling — drop the slowest test or move depth into integration when it does.
4. Run the smoke suite in CI immediately after the deployable artifact is produced and before any deploy or release gate; do not deploy on a build whose smoke suite was skipped, errored, or was reported as `passed-with-warnings`.
5. Re-run the same smoke suite against every deployed environment within a documented window after the deploy completes (e.g. ≤ 5 minutes); do not consider a deploy "successful" until the post-deploy smoke run is green.
6. Exercise the deployed, wired system — real database, real broker, real network egress to required external services on staging endpoints — not a mocked or in-process substitute; do not run smoke tests against unit-test-style fakes.
7. Assert only on observable, externally verifiable outcomes (HTTP status codes, presence of a known DOM element, a known field in a JSON response, a "ready" log line); do not assert on implementation details, internal counters, or specific data values that change per environment.
8. Treat any smoke failure as a stop-the-line signal — block the deploy pipeline at that stage, page the on-call rotation, and surface the failure on the team's primary alerting channel; do not configure the smoke job as `continue-on-error` or as informational-only.
9. Quarantine a flaky smoke test by removing it from the suite within the same business day, replace it with a tracked ticket, and surface the open quarantine count on the team's quality dashboard; do not retry a smoke test in CI to mask flakiness.
10. Do not gate smoke tests on environment-specific test data; seed only the minimum data the test needs as part of the test itself, and clean up after the run.
11. Time-box every smoke test individually with an explicit per-test timeout (HTTP timeout, page-load timeout, command timeout); do not let one slow test consume the suite's entire budget before failing.
12. Document the smoke-test owner, the per-environment smoke endpoint set, the budget, and the on-call escalation path in the repository or a linked runbook; do not run smoke tests as orphaned automation no one owns.
13. Review the smoke suite at a documented cadence (quarterly minimum) — every test must still map to a current business-critical path or be retired; do not let the suite ossify into "tests we have because we have always had them."
14. Do not present a green smoke run as evidence that the release is fully tested — surface the smoke result alongside the unit, integration, and E2E results in the release artifact so reviewers can see what each tier did and did not assert.
