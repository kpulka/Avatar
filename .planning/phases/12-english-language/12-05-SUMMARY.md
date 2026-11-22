---
phase: 12-english-language
plan: 05
subsystem: i18n
status: complete
tags: [i18n, ui-strings, copy-registry, english]
requires: [12-02]
provides:
  - src/app/copy.ts slot registry (t(slot, params)) with English values
  - English UI across user layer, studio shell, 6 studio panels, feature toasts, WebGL card
key-files:
  created: [src/app/copy.ts, tests/copy.test.ts]
  modified: [src/ui/**, src/app/container.ts, src/app/store/settings-schema.ts, src/app/store/settings-store.ts, src/features/{conversation,compare,animation}-controller.ts, src/features/scene-presets.ts, src/lipsync/viseme-overrides.ts, index.html]
requirements: [I18N-04]
commits: 1
plan_head_before: 9862e8eb64255d9ea9de4dd2159cfc61aff0e9a8
plan_head_after: 3e9c984
metrics:
  tests_before: "51 files / 282 tests"
  tests_after: "52 files / 289 tests"
---

# Phase 12 Plan 05: UI strings to English Summary

English UI everywhere via a new `src/app/copy.ts` registry (Phase 15's 15-02 had not run, so the registry was created here, born English, per plan Task 1).

## What changed

- `src/app/copy.ts`: ~260 slots (user layer, toasts, studio panels, per-key slider/shape labels, webgl card) + fail-soft `t(slot, params)`.
- Retrofitted to `t()`: status pill, dock, captions, algorithm switcher, user settings, loader, studio shell, panel registry, all 6 studio panels, container presentation button + loader copy, conversation/compare/animation feature toasts, scene preset labels.
- `index.html`: `lang="en"`; WebGL card moved out of the HTML into `src/ui/webgl-fallback.ts` (rendered into the empty `#webgl-fallback` mount, `role="alert"`, `aria-labelledby`).
- Panel registry error string fixed (R-7): `Panel "{title}" failed to load.`
- Settings import/validation error messages (shown in the import-rejected toast) translated.
- Viseme editor labels in `src/lipsync/viseme-overrides.ts` translated (UI-visible; PL letter tokens kept as data).
- `tests/copy.test.ts` added (7 tests): non-empty values, no diacritics in values, 5-slot snapshot, interpolation, fail-soft, no dangling `t('...')` ids, UI-literal diacritic gate.

## Gate

`npm run build` OK. `npx vitest run --dir tests`: 52 files / 289 tests passed (baseline 51 / 282; +1 file, +7 tests). No existing test needed changing (none asserted a Polish UI string).

## Deviations from Plan

1. **[Rule 3 - Dependency] copy.ts created here** (15-02 not executed). Slots are born English; 15-02 is partially superseded (noted in the commit body). Slot IDs follow 15-CONTEXT section 4.3, with extra slots for strings the appendix did not list (feature toasts, `panel.title.*`, `loader.avatar*`, `session.agentSaved`, a2f status fragments, `compare.noAudioToast`).
2. **Slider labels differ from the appendix.** The appendix listed guessed labels ("VERIFY against calibration.ts"); the real keys are jawScale, closeScale, puckerScale, funnelScale, rollScale, teethExposureScale, smileScale, coarticulationSpeed, syncOffsetMs. Labels were translated from the actual Polish text, technical shape names verbatim.
3. **`boot.loadingModel` not used.** Container already showed English `Loading 3D avatar…`; replaced the slot with `loader.avatar` / `loader.avatarProgress`.
4. **`webgl.fallbackBtn` omitted.** The current card has no fallback button (dead copy); the existing English browser hint was kept as `webgl.browserHint`.
5. **`session.micComingSoon` kept (translated)** instead of removed: removal is 15-05's task; behavior changes are out of scope here.
6. **Scene preset `light` label** `Light (jasny motyw)` -> `Light`; dark/light theme options `Dark (ciemny)` -> `Dark`.
7. **Out-of-list file touched:** `src/lipsync/viseme-overrides.ts` labels (visible in the visemes panel); comments in that file are left for 12-06.
8. Functional data kept: Polish test phrase, `[Test kalibracji PL]` prefix became `[Calibration test PL]` (UI label), sentiment keywords, case labels untouched.

## Known Stubs

None.

## Self-Check: PASSED

- `src/app/copy.ts`, `tests/copy.test.ts` exist; commit `3e9c984` present on the branch.
