# Minimal Human Input Contract

## Restated objective

Make `aws-valley` conform to every ADR and BDR of the `stack-cozy-engine` stack: verify ADR-002..012, implement ADR-001 (pack folders) and ADR-013 (view switch, third person view), and prove BDR-001..012 with automated Playwright tests.

## Intent

Implement and verify the cozy-engine stack ADRs and BDRs in the reference implementation `aws-valley`.

Source documents: `/Users/owenzanzal/pai/workspace/stackable-specs/stacks/stack-cozy-engine/docs/adr/` and `docs/bdr/`.

## Context delta

- `aws-valley` is a Jekyll 4.4 site with one IIFE engine script (`assets/js/engine.js`, 964 lines). Places are in `_places/*.md` and the root `index.md`.
- ADR-001 changes the content model: nested `packs/<path>/index.md` folders, a custom Jekyll generator plugin, per-pack `exterior.js` / `interior.js` / `rules.js` ES modules, and per-pack models.
- ADR-013 / BDR-008 add a third person view with an avatar, chosen by `view_switch` in `_config.yml`.
- The existing places migrate into packs. `/moon-base/` moves to `/moon/moon-base/`.
- The git repository has no commits. All files are untracked.
- A different run (`debug-inspector-overlay`) in `.sdlc/runs/` describes a Vite/TypeScript app, not this Jekyll site. This run does not use it.
- The Playwright browser for version 1.64.0 is not installed yet. A different session holds the install lock.

## Priority

Correctness against the ADR and BDR contracts, with tests as proof. Secondary: keep the existing look of the world.

## Authority

Autonomy level 5, risk tolerance 9 (set by `/task:goal`). No production deploy: gate 8 validates on a local server. Escalation triggers: a BDR that cannot be met without an ADR change; a test that cannot run.

## Acceptance (drafted from the BDRs)

```gherkin
Feature: Packs and third person view

  Scenario: A pack folder is a place
    Given packs/moon/moon-base/index.md
    When the site builds and the visitor opens /moon/moon-base/
    Then the page returns 200 and shows an exit labelled "Back to The Moon"

  Scenario: Minimum pack uses defaults
    Given a pack with only index.md
    When the visitor opens it
    Then it shows an empty room, a sign and an exit, and no request returns 404

  Scenario: Place rules stay in their place
    Given a pack whose rules lock a door
    When the visitor walks into that door
    Then the URL does not change and the place shows a message

  Scenario: Broken pack stays contained
    Given a pack whose rules throw on enter
    When the visitor opens it
    Then the console shows "[pack <id>]", and the exit still works

  Scenario: Third person view
    Given view_switch is "key"
    When the visitor pushes V
    Then an avatar shows in front of the camera, and the view stays after a door

  Scenario: Bad pack folder name (negative)
    Given a folder packs/Bad Name/index.md
    When the site builds
    Then the build stops with an error that names the folder
```
