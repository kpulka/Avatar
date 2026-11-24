---
phase: 15-web-ui-refactor
plan: 03
subsystem: ui
tags: [toast, modal, loader, dom, a11y]
key-files:
  modified: [src/ui/shared/dom.ts, src/ui/shared/toast.ts, src/ui/shared/modal.ts, src/ui/shared/loader.ts, src/style.css, src/app/copy.ts]
  created: [tests/shared-ui.test.ts]
status: complete
---

# Phase 15 Plan 03: Shared primitives contract Summary

Toast, modal and loader rebuilt to the documented contract; `dom.ts` gained `role`/`hidden` options and `uid()`.

- Toast (C-1): stack of up to 3 (`.toast-stack`), `role=alert` for errors (persistent, visible x close button,
  `aria-label` slot `shared.dismiss`), `role=status` + auto-hide for success; oldest dropped beyond 3; `destroy()` clears nodes and timers.
- Modal (C-2): `aria-labelledby` to the header h3 (uid), visible close button (`shared.close`), focus restored to the invoker, fallback
  path (no `showModal`) gets first-focus, Tab trap and Esc.
- Loader (C-3): `role=status` + `aria-live=polite`, `error(message)` variant with optional retry button (`createLoader(container, { onRetry, retryLabel })`),
  `hide()` clears busy and error; pill already top-center above the dock from 15-01.
- `tests/shared-ui.test.ts`: 13 jsdom tests (also covers the WebGL fallback card + canvas hide from 15-02).
- `container.ts` untouched (toast/loader wiring unchanged and compatible).

## Deviations from Plan
- Close glyphs are literal `x`/`!` characters (no letters, so the 15-02 inline-literal gate allows them); real SVG icons arrive in 15-04.
- New slots (English): `shared.dismiss`, `shared.close`.
- `.btn-small` class used on the loader retry button has no rule (matches existing unstyled usage elsewhere).

## DEFERRED-HUMAN
Trigger an error toast (e.g. connection error) and a success toast in dark and light theme: stack geometry bottom-right, close button
hit area. Open Settings: X closes, Esc closes, focus returns to the gear.

## Gate
`npm run build` OK; `npx vitest run --dir tests`: 54 files / 315 tests green.

## Self-Check: PASSED
