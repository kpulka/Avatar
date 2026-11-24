---
phase: 15-web-ui-refactor
plan: 06
subsystem: ui
tags: [studio-mode, discoverability, settings]
key-files:
  created: [tests/ui-discoverability.test.ts]
  modified: [src/app/app-types.ts, src/app/container.ts, src/app/copy.ts, src/ui/user/user-settings.ts, src/style.css, tests/container.test.ts, tests/a11y-dom.test.ts]
status: complete
---

# Phase 15 Plan 06: Studio discoverability Summary

- `AppServices.uiMode` seam (`UiModeService`: getMode/set/toggle); the container passes its `UiModeController`, UI never imports `ui-mode.ts`.
- Settings dialog gets a last "Studio mode" row (checkbox + label[for] + hint "Shortcut: Ctrl+Shift+D"), visually separated by a top border;
  toggling calls `services.uiMode.set`, entering studio closes the dialog; a locked `uiMode` disables the switch with the lock tooltip.
- Container (minimal, local): a `store.subscribe` listener opens/closes the studio shell whenever the mode changes. This also fixes an
  existing gap: Ctrl+Shift+D flipped `body[data-mode]` but the shell stayed `hidden` because only start-up opened it. `ui-mode.ts` is untouched
  (`?studio=1` stays session-only, shortcut unchanged).
- Tests: `tests/ui-discoverability.test.ts` (4) + a container case for the shortcut opening/closing the shell.

## Deviations from Plan
- Slots in English: `settings.studioMode` = "Studio mode", `settings.studioModeHint` = "Shortcut: Ctrl+Shift+D".
- Test assertion following the intended change: `tests/a11y-dom.test.ts` label[for] count 4 -> 5 (new Studio row).
- Task 6 caption offset (`bottom: calc(...)`) is folded into 15-07 task 3, where the final geometry pass lives.

## DEFERRED-HUMAN
Settings -> Studio mode on: dialog closes, studio drawer opens, persists across reload; with Session -> locks -> uiMode the row is disabled
with tooltip; first-run walkthrough at 1920x1080 and 1280x720 (loader top-center, status top-left, gear top-right, dock bottom, algo
panel bottom-right) for overlaps.

## Gate
`npm run build` OK; `npx vitest run --dir tests`: 58 files / 353 tests green.

## Self-Check: PASSED
