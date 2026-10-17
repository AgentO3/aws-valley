# Agent prompt: board items and red team

This file is the prompt for a scheduled cloud agent. The agent runs every 2 hours on this repository (`AgentO3/aws-valley`). Each run starts with no context. Read all of this file before you do work.

## Context

- `aws-valley` is a walkable 3D world. Jekyll builds the site, and A-Frame renders each place. See `README.md` and `docs/architecture.md`.
- Each folder in `packs/` with an `index.md` is one place. `_plugins/packs.rb` makes the pages. See `docs/adr/002-pack-structure.md`.
- CI is `.github/workflows/ci.yml`. A push to `main` builds, tests, deploys to GitHub Pages, and tests the live site.
- The live site is https://agento3.github.io/aws-valley/.
- Headless Chromium uses SwiftShader and renders at about 2 frames per second. `playwright.config.js` sets `workers: 2` for this reason. Do not remove it.
- Local setup: Ruby 3.3.4 (`.ruby-version`), Node.js 24, `bundle install`, `npm ci`, `npx playwright install --with-deps chromium`. If the sandbox cannot install Ruby 3.3.4, use the CI result of your pull request as the test result.

## Rules for each run

1. Write all prose (PR text, commit bodies, docs) in ASD-STE100 Simplified Technical English: short sentences, active voice, no "should", "may" or "might".
2. Use conventional commits. End each commit message with `Co-Authored-By: Claude <noreply@anthropic.com>`.
3. Do not push to `main`. Push a branch named `agent/<yyyy-mm-dd>-<short-topic>` and open one pull request for the run.
4. Before you start, list the open pull requests (`gh pr list`). If an open agent PR already fixes a problem, do not fix it again. Do not open a second PR for the same problem.
5. Run `npm run lint`, `npm run format:check` and `npm test` before you push, if the sandbox can run them. Put the results in the PR body.
6. Do not change the visitor-facing behavior that `tests/` checks, unless the change fixes a bug. If you change a test, explain why in the PR body.
7. If you cannot do a step (for example, no admin token for branch protection), write that in the PR body or in the run summary. Do not report a step as done when you did not verify it.

## Part 1: verify the 3 board items

A board review on 2026-10-16 chose these 3 items. For each item, run the check. If a check fails, fix the cause in your PR.

### Item 1: the repository has a clean baseline

Check:

- `git log --oneline` shows commits on `main`.
- The repository has no one-off debug files at the root (for example `.probe.mjs` or `.pw-precheck.config.js`).
- `git status` is clean after `npm run build` and `npm test` (the `.gitignore` covers all build output).

### Item 2: the docs describe the pack model, not the old `_places/` model

Check:

- The folder `_places/` does not exist.
- `grep -rn "_places\|KINDS\|PREFABS" --exclude-dir=node_modules --exclude-dir=.sdlc .` finds matches only in the historical text of `docs/adr/001-place-model.md` and in the "Context" section of `docs/adr/002-pack-structure.md`.
- `docs/adr/001-place-model.md` has the status "Superseded by ADR-002". `docs/adr/002-pack-structure.md` has the status "Accepted". `docs/adr/README.md` agrees.
- `docs/architecture.md` sections 1 to 5 agree with the code: `_plugins/packs.rb`, `_layouts/place.html` (`window.PLACE`) and `assets/js/engine.js` (`ctx`, `MOODS`, `resolveSize`).
- The "Add a place" steps in `README.md` work. To check this, follow them in a temporary pack, run the build, then remove the temporary pack.

### Item 3: CI is green and the live site works

Check:

- `gh run list --branch main --limit 1` shows a run with the conclusion `success`, and the jobs "Build and smoke test", "Deploy to GitHub Pages" and "Smoke test the live site" all succeeded.
- `curl -s -o /dev/null -w "%{http_code}"` gives 200 for https://agento3.github.io/aws-valley/ and https://agento3.github.io/aws-valley/moon/moon-base/.
- `gh api repos/AgentO3/aws-valley/branches/main/protection` shows branch protection that requires the CI check "Build and smoke test". If the token cannot read or set branch protection, report this to the owner. Do not try other ways to get access.

## Part 2: red team

If all checks in Part 1 pass, red team the implementation. Look for real defects, not style preferences. Areas to examine:

- `_plugins/packs.rb`: bad pack names, path traversal, symlinks, files that Jekyll copies by mistake, errors that do not stop the build.
- `assets/js/engine.js`, `assets/js/view.js`, `assets/js/kit.js`: pack errors that escape the `try`/`catch`, a pack that changes global state, the `ctx.store` key prefix, door and exit triggers, the `?from=` return, the `?view=` value.
- `packs/**`: missing `CREDITS.md`, models over the 300 KB budget, shared code in `packs/moon/lib/` that other packs depend on.
- `.github/workflows/ci.yml`: unpinned actions, too-wide permissions, a deploy that can run when the tests fail, a live test that cannot fail.
- `tests/`: tests that pass when the feature is broken, timing that depends on the frame rate, BDR acceptance criteria with no test.
- Front matter: an unknown `mood`, a bad `position` or a bad `size` that the build accepts with no error.

Rank the problems by the risk to a visitor or to the deploy. Fix the top 3 in one PR. For each fix, add or change a test that fails before the fix and passes after it. In the PR body, list the 3 problems, the evidence (file and line), the fix and the test. Also list the next 3 problems that you found but did not fix.

## Part 3: health check items

A second scheduled agent does a project health check. It adds improvement items to the list below. The owner merges its pull request to accept the items.

After Part 1 and Part 2, do the first item in this list that has the status `open` and no open agent PR. When your PR for an item is open, change the status of that item to `in PR #<number>` in the same PR. Do not delete items. The owner changes the status to `done` after the merge.

<!-- health-check-items: start -->

### HC-1: Fix the 9 Playwright failures that keep main red

- Status: open
- Added: 2026-10-17
- Problem: CI run 38996622182 on `main` (commit a856fb2) failed. The step "Smoke test the built site" ran 10.5 minutes. 9 tests failed after 2 retries, and 39 passed. The failed tests are in `tests/smoke.spec.js` (lines 15 and 47), `tests/view.spec.js` (S1, S4, S5, S6, R7), `tests/view-button.spec.js` (S2) and `tests/view-url.spec.js` (S3). The last one stops in `Place.open` at `tests/place.js:38`. The jobs "Deploy to GitHub Pages" and "Smoke test the live site" were skipped, so the site has no deploy. The report is in the artifact of that run: https://github.com/AgentO3/aws-valley/actions/runs/38996622182
- Done when: `gh run list --branch main --limit 1 --json conclusion` shows `success`, and the jobs "Build and smoke test", "Deploy to GitHub Pages" and "Smoke test the live site" all show `success`.

### HC-2: Add Subresource Integrity to the CDN scripts

- Status: open
- Added: 2026-10-17
- Problem: `_layouts/place.html` line 12 loads A-Frame from `aframe.io`. Line 13 loads `meshopt_decoder.js` from jsDelivr. Neither tag has an `integrity` or `crossorigin` attribute. A changed CDN file runs in every place with no check.
- Done when: a Playwright or build test reads every `<script src="https://...">` in `_site/index.html` and `_site/moon/moon-base/index.html`, and it fails if a tag has no `integrity` attribute. `npm test` passes.

### HC-3: Add the BDR files that the code and tests name

- Status: open
- Added: 2026-10-17
- Problem: `tests/*.spec.js` and `docs/adr/002-pack-structure.md` (lines 56, 192, 197) cite BDR-001 to BDR-012. The repository has no BDR file. `git ls-files | grep -i bdr` finds only `docs/specs/practices/bdr.md`. Rules 1 and 18 of that spec need a `docs/bdr/` folder and an index. The acceptance criteria are not in the repository, so a reader cannot check which test covers which criterion.
- Done when: `docs/bdr/README.md` lists BDR-001 to BDR-012 with a status. Each BDR file has a `## Status` section. A test or script checks that each `BDR-NNN` in `tests/` and `docs/` has a file in `docs/bdr/`. `README.md` names the folder.

<!-- health-check-items: end -->

## Run summary

At the end of each run, write a short summary: the result of each Part 1 check, the PR link (or "no PR"), and any step that you could not verify.
