# Security Assessment Report

**Target:** /Users/owenzanzal/pai/workspace/aws-valley (change scope: `app/src/ui/DebugInspector.ts`, `app/src/ui/debug-inspector.css`, `app/src/systems/Persistence.ts`, DEV block in `app/src/main.ts`)
**Date:** 2026-09-05
**Run:** debug-inspector-overlay (gate 6)
**Tools run:** gitleaks (scoped, direct + agent), trufflehog, detect-secrets 1.5.0, npm audit (app + root), osv-scanner 2.3.8, syft, cdxgen, manual SAST pattern sweeps (6 mandated greps + per-hit file review)
**Tools skipped:** semgrep (ran but loaded **zero rules** — config registry fetch blocked; 0 findings not meaningful → compensated by mandated manual sweeps, all clean), trivy/grype/checkov/hadolint/tfsec/k8s tools (no Dockerfile, no IaC, no K8s manifests detected), actionlint/zizmor (no project `.github/workflows`), git-history tools (no `.git` repository)

---

## Executive Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 2 |
| Info | 3 |

**Overall posture:** Low risk.

Top issues:
- LOW — `DebugInspector.ts:80` builds the panel scaffold via `innerHTML`; audited safe today (static template, all dynamic values via `textContent`), but it is the one sink to guard in future edits.
- LOW — grant op has no upper quantity bound (dev-only impact: oversized inventory values).
- INFO — semgrep coverage gap (no rules loaded, sandboxed registry); INFO — no git history scan possible (not a repo); INFO — prod-leak guard is a manual gate check, worth codifying.

---

## Findings

### Secrets & Credentials
| # | File | Line | Type | Verified | Severity | Notes |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | **0 findings.** gitleaks on `app/src` (252 KB): "no leaks found". trufflehog filesystem on `app/src`: no findings. detect-secrets on `app/src` + both package.json: 0 findings. Gate-5 scan of the changed files (DebugInspector.ts, debug-inspector.css, Persistence.ts): 0 hits. No git history exists to scan (target is not a git repo). `learnerId: "learner_local"` in Persistence.ts is a static placeholder, not a credential. |

### SAST — Code Vulnerabilities
| # | Tool | Rule | File | Line | Severity | Description |
|---|---|---|---|---|---|---|
| 1 | manual review | innerHTML-sink | app/src/ui/DebugInspector.ts | 80 | Low | Panel scaffold via `innerHTML`. Audited: template is fully static (labels, class names, empty value slots); every dynamic value (state cells, error line, option labels) is written via `textContent`/`createElement`. No untrusted input reaches the sink. Defense-in-depth: keep it that way — never interpolate data into this string. Same class was swept repo-wide: 23 `innerHTML` hits across `app/src` (SAST agent, per-file verdicts) — all static or static-data templates; zero dynamic/untrusted interpolation. No `eval`, `new Function`, `document.write`, JWT, SQL, or command-injection patterns anywhere in `app/src`. |
| 2 | manual review | missing-upper-bound | app/src/ui/DebugInspector.ts | 138 | Low | Grant qty clamped only at the floor (`Math.max(0, Math.floor(...))`); no max. `main.ts:979` accepts any positive finite qty. Dev-only impact (DEV builds only; a huge qty would slightly inflate the localStorage save). Accepted for a dev tool. |
| 3 | coverage note | — | — | — | Info | semgrep loaded 0 rules (registry fetch blocked). The mandated manual sweeps and a full per-hit review of every `innerHTML` site substitute; recommend rerunning semgrep with network access at a later gate if the ruleset matters. |
| 4 | manual review | debug-surface | app/src/main.ts | 894–1009 | Info | The only state-mutating debug surface is inside the single `import.meta.env.DEV` guard; `window.__lv` unchanged. `InputController.ts` untouched. |

### SCA — Dependency Vulnerabilities
| # | Package | Installed | CVE/GHSA | CVSS | Severity | Fixed In | Dep Path |
|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | **0 findings.** npm audit `app/` (49 pkgs): 0 info/low/moderate/high/critical. npm audit root (230 pkgs): 0 total. osv-scanner v2.3.8 on both lockfiles: "No issues found". Only prod-bundled dep is `three@0.185.1` (current line, no advisories); vite/typescript/@types are dev-scope. |

### Dockerfile & IaC Configuration
Not applicable — no Dockerfile, `.tf`, Helm, or CloudFormation files detected.

### Container Image
Not applicable — no Dockerfile detected.

### Kubernetes Manifests
Not applicable — no `kind:` YAML detected (the `.playwright-cli/*.yml` files are page snapshots).

### GitHub Actions
Not applicable — no project workflows (only third-party ones inside `node_modules/`, out of scope).

### Repo Posture
Not a git repository — no history scan possible; working-tree scans stand in for it.

---

## SBOM Summary

- Total components: 49 (cdxgen, CycloneDX — authoritative, resolved from checked-in `app/package-lock.json`); syft corroborates top level (`app`, `three`)
- Ecosystems: npm/JavaScript (all 49)
- Full SBOM: `/tmp/sbom-aws-valley.json` (CycloneDX JSON)

---

## Recommended Actions

Priority 1 — Fix immediately (Critical/High): none.

Priority 2 — Fix this sprint (Medium): none.

Priority 3 — Backlog (Low/Info):
1. Keep `DebugInspector`'s rule: dynamic content only via `textContent`; if the scaffold ever needs data-driven markup, build it with `createElement` (F-1).
2. Optionally clamp grant qty to a sane max (e.g. 999) when the panel grows real use (F-2).
3. Codify the prod-bundle grep (`lv-debug`/`Backquote`/`clearWorldState`/`jumpToStep`/`grantItem` → 0 hits) as a repeatable check script so R-1 stays enforced beyond gates 5/8.
4. Rerun semgrep on a networked host to clear the ruleset coverage gap.

---

## Tool Inventory Used

| Tool | Version | Group | Status |
|---|---|---|---|
| gitleaks | homebrew (latest) | 1 | run (scoped: app/src; full-tree agent scan still running at consolidation time — superseded by three corroborating clean scans) |
| trufflehog | homebrew (latest) | 1 | run (0 findings) |
| detect-secrets | 1.5.0 | 1 | run (0 findings) |
| npm audit | node v26.1.0 | 3 | run (app + root, 0 findings) |
| osv-scanner | 2.3.8 | 3 | run (both lockfiles, no issues) |
| syft | homebrew (latest) | 4 | run (lockfile-level: 2 components) |
| cdxgen | node v26.1.0 | 4 | run (49 components → /tmp/sbom-aws-valley.json) |
| semgrep | homebrew (latest) | 2 | skipped — 0 rules loaded (registry fetch blocked); manual sweeps substituted |
| hadolint / checkov / trivy / tfsec | — | 5, 6 | skipped — no Dockerfile/IaC |
| k8s linters | — | 7 | skipped — no K8s manifests |
| actionlint / zizmor | — | 8 | skipped — no project workflows |
| git-sizer / gitleaks history / scorecard | — | 9 | skipped — no `.git` |