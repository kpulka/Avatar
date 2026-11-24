---
phase: 15-web-ui-refactor
plan: 04
subsystem: ui
tags: [a11y, aria, icons, keyboard]
key-files:
  created: [src/ui/shared/icons.ts, tests/a11y-dom.test.ts, tests/helpers/ui-fixtures.ts]
  modified:
    - src/ui/studio/studio-shell.ts
    - src/ui/user/{captions,status-pill,conversation-dock,user-settings,algorithm-switcher}.ts
    - src/ui/studio/panels/{a2f,session,scene,animation,visemes,inspector}-panel.ts
    - src/app/container.ts
    - src/app/copy.ts
    - src/style.css
    - tests/container.test.ts
status: complete
---

# Phase 15 Plan 04: Accessibility pass Summary

- Live regions: captions `role=log` + `aria-live=polite` + name (`captions.regionAria`), status pill label `role=status`,
  algo status line `role=status` + polite, decorative pulse dot `aria-hidden`.
- Studio tablist follows WAI-ARIA Tabs: roving tabindex, ArrowLeft/Right (wrapping) + Home/End select-on-focus, tab ids,
  `aria-controls` -> the single `role=tabpanel` body whose `aria-labelledby` follows the active tab.
- Form labels: every select/slider/text input in user settings, A2F, Session, Animation (9 sliders), Visemes and Inspector is
  associated (`label[for]` + `uid()` ids, or `aria-label` for search/group controls).
- File uploads: Scene "Choose .GLB" and Session "Import profile" are real `<button>`s driving a hidden input
  (`.hidden`, `tabindex=-1`, `aria-hidden`).
- Esc hygiene: global keydown in `container.ts` returns early while a `dialog[open]` exists.
- `src/ui/shared/icons.ts`: inline SVG set (mic, micOff, phone, phoneOff, stop, settings, eye, close, dot), `aria-hidden`,
  `currentColor`; replaces emoji in dock, gear, presentation button and studio close buttons; user-layer panel `icon` fields emptied.
- CSS: reduced-motion block now also covers `.btn-call.active`, `.spinner`, `.toast*`, `.loader-overlay`, dock hover lift.
- `.engine-toggle` / `.icon-label` (V8) were already styled in 15-01.
- Tests: `tests/a11y-dom.test.ts` (14), shared fake-context fixture `tests/helpers/ui-fixtures.ts`, Esc/dialog test in `tests/container.test.ts`.

## Deviations from Plan
- Tab ARIA wiring uses ONE shared tabpanel (`id` + `aria-labelledby` re-pointed) instead of per-tab `panel-{id}` ids that would not exist
  for inactive tabs (an `aria-controls` to a missing id is an ARIA violation).
- `presentation.show` copy lost its emoji ("Show controls"); the eye icon is an SVG inside the button.
- New slots (EN): `captions.regionAria`, `visemes.groupAria`, `visemes.searchAria`, `inspector.searchAria`.
- Extra test edit outside files_modified: new case appended to `tests/container.test.ts` (Esc guard), no existing assertion changed.

## DEFERRED-HUMAN
Keyboard-only walk (both themes): status -> dock (start, mute, interrupt) -> segment -> compare -> blind -> gear; Enter opens
settings, Esc closes it WITHOUT flipping presentation mode; Ctrl+Shift+D; studio tablist arrows/Home/End; GLB button focusable;
DevTools "prefers-reduced-motion: reduce" kills pulse-border, spinner, toast transitions; optional screen reader smoke
(captions announce politely, status pill label flips).

## Gate
`npm run build` OK; `npx vitest run --dir tests`: 55 files / 330 tests green.

## Self-Check: PASSED
