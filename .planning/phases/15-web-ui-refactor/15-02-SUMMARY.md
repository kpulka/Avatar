---
phase: 15-web-ui-refactor
plan: 02
subsystem: ui
tags: [copy, i18n, slots, gate]
requires: [12-05]
provides: [phase-15 slot contract test, inline-literal gate]
key-files:
  modified:
    - src/app/copy.ts
    - src/ui/studio/panels/session-panel.ts
    - src/ui/webgl-fallback.ts
    - tests/copy.test.ts
status: complete
---

# Phase 15 Plan 02: Microcopy slot registry (reconcile, not recreate) Summary

`src/app/copy.ts` (Phase 12-05, English values, `t()` registry, 261 keys) already existed with the whole
retrofit done; this plan reconciled it with the Phase 15 slot contract and added the missing enforcement gate.

## What was done

- Verified the retrofit against 15-CONTEXT section 4.3: every Phase 15 slot exists in `COPY` (under the
  Phase 12 IDs, see rename map). `index.html` is a mount-only shell, `webgl-fallback.ts` renders the card via
  `t('webgl.*')`, `loader.ts`/`container.ts`/features toasts already use `t()`. Tasks 1-7 of the plan were
  therefore already satisfied; nothing recreated.
- `tests/copy.test.ts`: added `Phase 15 copy contract` (3 tests): every Phase 15 slot resolves non-empty
  (gate is "every slot exists", NOT row-for-row count), `index.html` holds no visible copy, and a new static
  gate that forbids inline user-visible literals (`text/placeholder/ariaLabel/title/textContent/tooltip`)
  in `src/ui/**` and `src/app/container.ts`. The Polish-diacritics gate (task 8d) already existed.
- Closed the literals the new gate caught: session telemetry placeholders now use `session.ttfbIdle`,
  `session.ttfbValue`, `session.alignIdle` (3 new EN slots).
- `scene-panel` "Skin subsurface scattering" (Drift A2) already uses `scene.sssLabel` - nothing to add.
- S9: `handleWebGLFailure()` now hides `#avatar-canvas` while the fallback card shows.

## Slot rename map (Phase 12 IDs vs 15-CONTEXT 4.3 IDs; the Phase 12 IDs are the contract now)

| 15-CONTEXT | copy.ts |
|---|---|
| animation.sliderLabels | animation.slider.{key} |
| visemes.shapeLabels | visemes.shape.{key} |
| inspector.categoryTitles / shapeLabels | inspector.category.{key} / inspector.shape.{key} |
| poc.phases | poc.phase1..3 |
| boot.loadingModel | loader.avatar (+ loader.avatarProgress) |
| webgl.fallbackBtn | webgl.browserHint |
| animation.phonemesTitle labels | static phonetic symbols stay data (`[ A ]`...), only `animation.phonemeRest` is copy |
| session.micComingSoon | kept for now, removed in 15-05 |

## Deviations from Plan

- [Rule 3] Plan wording (Polish values, `index.html` lang flip, creating `copy.ts`, count equality gate) is stale
  after Phase 12; followed DRIFT-A1 B2 items 1-4 instead.
- Slots cited by 15-05/15-06 that do not exist yet (errors.*, compare.*, settings.studioMode*, ...) are added by
  the plan that uses them, in English.

## Gate

`npm run build` OK; `npx vitest run --dir tests`: 53 files / 302 tests green (baseline 52/291).

## Self-Check: PASSED
