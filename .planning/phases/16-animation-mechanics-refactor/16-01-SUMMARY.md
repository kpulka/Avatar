---
phase: 16-animation-mechanics-refactor
plan: 01
subsystem: lipsync
tags: [face-controller, state-machine, race-conditions]
requirements: [ANIM-01, ANIM-09]
key-files:
  created: [tests/face-controller-transitions.test.ts]
  modified: [src/lipsync/face-controller.ts, src/features/animation-controller.ts]
status: complete
commits: 2
plan_head_before: baba904dcb9e14135dae0997d450a0f4752dfd76
plan_head_after: afe66bb7cf7287f9520bfd4a2eef9d9bd3ef5818
actuals:
  tasks: 4
  commits: 2
---

# Phase 16 Plan 01: FaceController state-machine hardening Summary

Mode switches (immediate and deferred) now share one boundary semantics that eases through RELAXING from `currentWeights`; interruption is idempotent; dev tools cannot cut a live turn; speech paths never zero-write morphs.

## What changed

- `clearManualOverrides()` split: `clearManualOverrideMap()` (map only; used by `onAudioChunk`, energy-fallback path, `feedFrames`, `testPhrase`) and `resetFaceToNeutral()` (zero-write; `previewViseme`, `testPhoneme`, user "reset morphs").
- `applyModeImmediate` deleted; `commitPendingMode` and `setAnimationMode` route through `switchModeAtBoundary` (IDLE stays IDLE, otherwise RELAXING from current pose, timer re-anchored).
- `onInterruption`: clears both tracks, commits a pending mode, IDLE stays IDLE, otherwise (re)enters RELAXING.
- `testPhoneme`: returns early while SPEAKING.
- `handleAudioChunk` documents that a deferred switch is dropped by design for LIVE turns.

## Matrix coverage diff

Previously untested cells now covered in `tests/face-controller-transitions.test.ts` (12 tests): rows 3, 7, 13, 14 (+dev path still works), 16 (no zero-write on rapid turn-taking), 17, 18, 19, 21/22, B5 (RELAXING -> A2F switch -> live chunk, no all-zero frame), pending-mode commit on interruption. The B5 acceptance was satisfied by the smooth path; no extra "defer when state !== IDLE" was needed.

## Deviations from Plan

None - plan executed as written, with two judgment calls:
- `switchModeAtBoundary` in IDLE zero-writes only when manual (dev preview) overrides exist, preserving the old cleanup of a leftover preview pose without popping a real speech pose.
- Transition tests use vitest fake timers for the RELAXING wall clock exactly as the plan prescribes; 16-03 replaces them with an injected `nowMs`.

## Observations for later plans

- `VisemeScheduler.clear()` keeps its internal `currentWeights` (only `resetAll()` on RELAXING->IDLE drops them), so a new turn started mid-RELAXING resumes from the scheduler's stale pre-interruption weights (a pop UP, not to zero). Out of scope here; candidate for follow-up.
- RELAXING multiplies the already-decayed `currentWeights` by an absolute `relaxFactor` every frame (compounding), so the effective ease is faster than the nominal 150 ms. Behavior left untouched (zero-behavior-change rule in 16-04).

## Self-Check: PASSED
