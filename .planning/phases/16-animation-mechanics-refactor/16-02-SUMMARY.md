---
phase: 16-animation-mechanics-refactor
plan: 02
subsystem: lipsync
tags: [single-writer, gaze, layer-composition, emotion-mix]
requirements: [ANIM-02, ANIM-04]
key-files:
  created: [tests/gaze-single-writer.test.ts, tests/emotion-mix-parity.test.ts]
  modified: [src/lipsync/face-controller.ts, src/lipsync/viseme-scheduler.ts, src/realism/gaze-saccades.ts, src/features/scene-controller.ts, src/features/animation-controller.ts, src/app/container.ts, src/avatar/face-driver.ts, src/types/avatar.ts, src/lipsync/a2f-parser.ts, src/lipsync/demo-frames.ts, tests/face-driver.test.ts]
status: complete
commits: 3
plan_head_before: d8cbc7095aa58a39a62de7adfb40345843e3d273
plan_head_after: ca8c106d42c4c881ae91cc3477d30ff677663b41
actuals:
  tasks: 9
  commits: 3
---

# Phase 16 Plan 02: Single writer and layer composition Summary

FaceController is again the only morph writer: gaze reaches the face through a `GazeProvider` seam, carriesEyes gates blink + gaze morphs + eyeball bones, the scheduler only sees the speech subset, both tracks share one emotion mix, morphs are computed before `renderer.render`, and the driver's rAF relax loop is gone.

## Per-frame layer order (documented in `FaceController.render`)

| # | Layer | Shapes | Gate |
|---|-------|--------|------|
| 1 | blink provider | eyeBlink* | skipped when frames clip carriesEyes |
| 2 | gaze provider (data only, x0.35) | eyeLook* | same carriesEyes gate |
| 3 | VisemeScheduler (speech subset: jaw/mouth/tongue/cheek/nose) | speech shapes | SPEAKING, viseme mode |
| 4 | emotion mix x0.3 (`EMOTION_MIX_SPEAKING`) | speech shapes + brows/eyeWide etc. | both tracks |
| 4' | frames: clip-absolute shapes, then emotion x0.3 on the non-owned rest | owned / rest | SPEAKING, frames mode |
| 5 | manual overrides | any | not SPEAKING |

Wiring: `SceneController.update` computes the gaze weights (`getGazeWeights()`), `container.ts` hands them to `AnimationController.setGazeProvider` and installs `setProceduralEyesGate` (bones obey `FaceController.areProceduralEyesActive()`). Because `animationController.update` now runs BEFORE `sceneController.update`, the gaze morphs applied in a frame use weights computed one frame earlier (invisible: gaze is damped, lambda 15).

## Deviations from Plan

**1. [Interpretation] Emotion on non-speech shapes in the viseme track is 0.3x, not full weight.** The plan text says the "emotion-only shapes" loop applies emotion at full weight, but the same plan (and the parity test spec) requires identical brow weights in both tracks at 0.3x, which also equals the pre-change behavior of the viseme track (brows were in `updatedWeights` as 0 + 0.3x emotion). Implemented 0.3x so parity holds and nothing changes visually in the viseme track. eyeLook* is skipped there when the gaze owns it.
**2. [Design] `GazeProvider` is data-only** (`() => EyeLookWeights | null`), not `{applyToDriver(...)}` as sketched in the plan (a provider that writes to the driver would be a second writer). `GazeSaccades.applyToDriver` was deleted.
**3. [Rule 3] RELAXING also skips eyeLook* while gaze is active**, otherwise the ease-out would zero the gaze for ~150 ms (same clobber as G-2).
**4. [Plan 7a, owner decision D3] A2E emotion path removed:** `carriesEmotion` and `emotions` deleted from `FramesClip`, a2f-parser, demo-frames, FaceController; a2f-parser test for A2E replaced by an absence assertion; `animation-frames` "carriesEmotion" test re-targeted to "owned shapes are never blended".
**5. Outside files_modified (test mocks/docs following intended change):** `relaxToNeutral` removed from 7 test mocks; `tests/container.test.ts` gaze mock now exposes `compute` instead of `applyToDriver`; `tests/compare-controller.test.ts` fixture drops `carriesEmotion`; `docs/1-architecture-and-3d-models.md` (FaceDriver interface snippet) and `docs/7-audio2face-cloudrun.md` (carriesEmotion mention) updated. `src/features/animation-controller.ts` gained `setGazeProvider`; `src/app/container.ts` edits kept local (order swap + 5 lines of wiring after `telemetryController`).

## Known limits

- `speechShapeList` is computed once in the constructor from `driver.listAvailableShapes()` (driver shapes are fixed per avatar).
- Visemes/overrides that name shapes outside the speech families (e.g. an override with `eyeSquint*`) are ignored by the scheduler by design.

## Self-Check: PASSED
(gate: build OK, 55 files / 315 tests green)
