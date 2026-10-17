# Minimal Human Input Contract

## Intent
Build an in-app debug inspector overlay for the game (toggleable via a keyboard
hotkey) that surfaces live game state and offers operations — clear/reset game
state, jump to quest steps, grant items, pause — to make iterating on the game
easier.

## Context delta
- The app is a Three.js/Vite game; a DEV-only `window.__lv` console handle already
  exposes scene/systems, but there is no visual UI and no state-mutating ops.
- Game state lives in `localStorage` under `aws-valley/slice-1/world`
  (`app/src/systems/Persistence.ts`) and much of the UI/world derives from it via
  `syncWorldToStep()`.
- Debug tooling must be DEV-only (or at least never ship in prod builds) and must
  not interfere with gameplay input (InputController owns keyboard).

## Priority
Speed of iteration for the developer — a fast, legible panel beats polish.
Secondary: never affect player-facing behavior or prod bundle.

## Authority
Autonomy level 5 (maximum), risk tolerance 9 — set by `/task:goal`. Escalation
triggers: none in scope (no production deploy; gate 8 validates locally only).

## Acceptance
```gherkin
Feature: Debug inspector overlay

  Scenario: Open the inspector with the hotkey
    Given the app is running and the inspector is hidden
    When the user presses the inspector hotkey (backquote "`")
    Then a debug panel overlay appears over the game
    And it shows live game state (day, coins, gems, quest step, inventory, build progress, chickens home)

  Scenario: Close the inspector with the hotkey again
    Given the inspector is open
    When the user presses the hotkey again
    Then the panel hides and gameplay input resumes unchanged

  Scenario: Clear game state from the inspector
    Given the inspector is open with a saved world state
    When the user clicks "Clear state"
    Then localStorage state is removed and the world resets to defaults
    And the HUD/scene re-sync to the fresh state

  Scenario: Jump to a quest step
    Given the inspector is open
    When the user selects quest step "Build" and clicks Apply
    Then questStepIndex moves to the build step and the world re-syncs

  Scenario: Inspector does not hijack gameplay keys
    Given the inspector is hidden
    When the user plays normally with WASD/E
    Then movement and interact behave exactly as before

  Scenario: Production build contains no inspector
    Given a production build of the app
    When the page loads
    Then no inspector element, hotkey listener, or debug code is present
```

### Restated objective
Add a hotkey-toggled debug overlay to the game app that displays live world/quest
state and provides developer operations (clear state, jump quest steps, grant
items, pause, warp) without touching prod builds or normal gameplay input.