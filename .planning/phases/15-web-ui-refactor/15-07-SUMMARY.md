---
phase: 15-web-ui-refactor
plan: 07
subsystem: ui
tags: [responsive, css, final-sweep]
key-files:
  created: [tests/responsive-layout.test.ts]
  modified: [src/style.css, src/ui/user/conversation-dock.ts, .planning/phases/15-web-ui-refactor/15-VERIFICATION.md]
status: complete
---

# Phase 15 Plan 07: Responsive integrity and end-of-phase hardening Summary

- Guard queries in `style.css` section 7: `<=1440px` (algo 220px, right drawer 340px, captions 640px), `<=1280px` (captions 520px, left drawer 300px,
  tighter left toggles, algo status clamped to 1 line), `<=1152px` (icon-only dock, narrower captions, algo status visually hidden but kept in the a11y
  tree). Supported minimum 1152x648 documented in the file header. `.sr-only` utility added.
- Geometry: `.user-captions { bottom: calc(80px + var(--space-2)) }` above the 56px dock; telemetry grid `minmax(0,1fr)` + `word-break`;
  `.viseme-shape-sliders { max-height: min(44vh, 300px) }` (drawer body stays the only scroll container).
- Dock buttons now carry a `title` tooltip mirroring the aria-label (kept in sync with state) so the icon-only collapse is still self-explanatory.
- `tests/responsive-layout.test.ts` (11): guard queries, `.sr-only`, captions calc, no `!important` in guard queries plus an allow-list for the rest,
  viseme/telemetry rules, dock aria-label + tooltip survival, grep gates (no global keydown outside `src/app`, no `getElementById` in the user layer).
- Final sweep: hex outside token blocks 0, font-size < 12px 0, dead selectors 0, emoji in user layer / container 0, `style.css` TOC with sections 0-9.
- `15-VERIFICATION.md` updated: automated gates ticked with measured numbers; manual sections left for the owner.

## Deviations from Plan
- `style.css` line count GREW (1229 -> 1510, 490 `var(--)` usages): tokenized rules are multi-line and 15-03/05/07 added blocks; the plan's "shrink"
  expectation is not met and recorded in VERIFICATION instead of being forced.
- At 1152px only the algo status line is hidden (sr-only); the blind toggle stays visible, because a visually hidden focusable checkbox would be a keyboard trap.
- Tooltips (`title`) added to dock buttons (file outside the plan list: `conversation-dock.ts`).
- `studio-shell.ts` needed no further changes.

## DEFERRED-HUMAN
Tier walkthrough at 1920x1080, 1440x900, 1280x720, 1152x648 in both themes (user + studio): no overlaps, no clipped controls, no horizontal scroll,
compare flow usable at 1152; drawers at 720p have a single scrollbar; screenshot set for Phase 13 (15-VERIFICATION section 5). A headless Chrome
(swiftshader) capture attempt against the dev server did not reach a capturable state, so no images are committed.

## Gate
`npm run build` OK; `npx vitest run --dir tests`: 59 files / 362 tests green (phase start 52 / 291).

## Self-Check: PASSED
