---
phase: 15-web-ui-refactor
plan: 01
subsystem: ui
tags: [css, tokens, theming, a11y]
key-files:
  modified: [src/style.css]
  created: [tests/ui-tokens.test.ts]
status: complete
---

# Phase 15 Plan 01: Design tokens, complete theming, typography floor, CSS hygiene Summary

`src/style.css` rewritten around a `:root` token sheet (60+ tokens: color primitives and semantic, type roles
display 28 / heading 18 / body 14 / label 12, 4px spacing, radii, shadows, z-scale, motion) with a single
`body.theme-light` block that swaps token values only (no component-level light overrides, so every control
flips). 1229 -> 1265 lines (the plan's "shrink" expectation is not met in absolute terms: every rule is now
expanded and tokenized; dead code removal of about 150 lines is outweighed by the token sheet and the TOC).

## Done
- Zero hex/rgba/hsl literals outside `:root` and `body.theme-light`; no `transition: all` (named-property
  `--transition-ctrl`); every `z-index` from the `--z-*` scale; no `font-size` below 12px (23 declarations lifted).
- Targets: dock 40px, segment 40px, tabs/inputs/buttons 36px, viseme chip 28px.
- `#f0c` magenta on `.btn-danger` replaced by `--danger-text`.
- Dead HUD/pill/align/`.top-dock`/`.modal-buttons`/`.select-input`/`.btn-presentation` rules deleted.
- `.engine-toggle`/`.icon-label` (V8) and `.btn-tiny` styled; `user-select: text` opt-out for transcript/hints.
- Loader pill: `--z-loader` (60) above the dock, relocated top-center (S2 CSS half; 15-03 owns the rest).
- `tests/ui-tokens.test.ts`: 8 static assertions (>=30 root tokens, no literals outside token blocks, 12px floor,
  light block token-only and every override exists in `:root`, dead selectors absent, no `#f0c`/`transition: all`,
  every `var(--x)` defined, no numeric z-index).

## Deviations from Plan
- Token names: merged plan names (`--space-*`, `--radius-*`, `--border-subtle`, `--destructive`, `--z-*`) with
  DRAFT semantic names (`--glass-bg`, `--surface-input`, `--text-primary`...). Plan tasks 4 and 9 reference these names downstream.
- Page background kept `#0b0f17` (existing literal) instead of DRAFT `#0f172a` (1:1 consolidation rule).
- Teal "sample speech", blue phoneme hover and chip-active colors folded into success/accent tokens (consolidation).
- Radii 16px (drawers/dialog) folded to `--radius-lg` 12px; 700 weights folded to 600 (role spec 400/600).
- Task 4/7 for `.viseme-chip` min-height 28px kept; `dock-icon-btn` min 40px also applies to the studio left toggles.

## DEFERRED-HUMAN
Dark/light screenshot matrix of the 12 surfaces (UI-SPEC 2.2) and the contrast spot-check in a real browser:
`npm run dev -- --port 5399`, toggle Settings -> Theme, open every studio tab, check toast (trigger an error),
settings dialog, WebGL card (DevTools: disable WebGL), loader above dock while reloading.

## Gate
`npm run build` OK; `npx vitest run --dir tests`: 53 files / 299 tests.

## Self-Check: PASSED
