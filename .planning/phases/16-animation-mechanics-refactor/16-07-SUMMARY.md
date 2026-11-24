---
phase: 16-animation-mechanics-refactor
plan: 07
subsystem: docs
tags: [docs-sync, verification]
requirements: [ANIM-10]
key-files:
  modified: [docs/4-audio-and-barge-in.md, docs/3-lip-sync-and-coarticulation.md, .planning/phases/16-animation-mechanics-refactor/16-VERIFICATION.md, .planning/phases/16-animation-mechanics-refactor/16-DRAFT-animation-runtime.md]
status: complete
commits: 2
plan_head_before: a289386
plan_head_after: 66e7e36
actuals:
  tasks: 4
  commits: 2
---

# Phase 16 Plan 07: Docs sync and verification Summary

docs/4 and docs/3 now describe the hardened runtime; `16-VERIFICATION.md` is executed with real results (59 files / 344 tests, build OK). Manual UAT and human sign-off of the behavior changes are DEFERRED-HUMAN.

## What changed

- **docs/4-audio-and-barge-in.md (edited in English; the docs are English since Phase 12):** idempotent `onInterruption` pseudo-code and diagram, transition-rule table, single-writer + per-frame layer order, timebase contract table (audio / injectable wall / rAF), render pseudo-code on `audibleClock()` + `nowMs()`; the barge-in checklist is restated as verified by automated tests with real-device latency left manual.
- **docs/3-lip-sync-and-coarticulation.md:** blend times and lambda tiers reference `anim-config` keys; the closure-priority paragraph describes the 11.2-08 jaw gate (`mouthClose` OR `mouthPress`, `pressRef` 0.35, `closeJawFactor`) and the shared `mouthCloseCap` 0.85; the dead lambda=18 fallback is documented as removed; new section 6 (emotion mix 0.3 in both tracks with the A/B rationale, speech subset, shared constants). Phoneme/char mapping tables were left untouched (Phase 17 lane).
- **16-VERIFICATION.md:** every gate filled with the actual result; behavior-change table and manual UAT marked PENDING / DEFERRED-HUMAN.

## DEFERRED-HUMAN

Manual UAT items 1-5 in 16-VERIFICATION.md section 3 (live gaze during speech, spam interrupt, LIVE<->A2F switching, A2F carriesEyes demo, 30 s FPS) and sign-off of the five intentional behavior changes.

## Seams left for Phase 17 (face-controller.ts)

- Viseme enqueue lives in `onAudioChunk`: the phoneme block (`mergeCharAlignmentToPhonemes` -> override or `mapPhonemeToShapes`) and the char block (`charTokenFor` override or `charMapper`). Unchanged by Phase 16 except constants (`viseme.minDurationSec`, `fallback.*`).
- Speech subset: `isSpeechShape` / `SPEECH_SHAPE_FAMILIES` (viseme-scheduler.ts) and the cached `speechShapeList`; new viseme shapes must fall in jaw/mouth/tongue/cheek/nose or the scheduler ignores them.
- `testPhoneme` still carries 8 hardcoded pose tables (D-7); it is now guarded against SPEAKING and uses `resetFaceToNeutral()`; 17 should delegate it to the phoneme tables.
- Bilabial jaw gate (`viseme.closeJawThreshold`, `pressRef`) lives in the scheduler config, so 17's closure criterion (`mouthClose <= 0.35`, `mouthPress >= 0.3`) can be asserted against `PHONEME_POSES` without touching the gate.
- `tests/hot-path-allocations.test.ts` uses `setCharMapper(fixedMapper)`, so table changes cannot invalidate its golden weights.
- DRIFT-A1 #10 (re-verify): `face-controller.ts` has no `wordToPhonemesSync` import; its caller is `g2p/phoneme-merge.ts`.

## Deviations from Plan

- Docs edited in English (plan said Polish) per drift B2 #11. The final docs commit message follows the plan (`docs(sync): ...`). No STATE.md / ROADMAP.md / REQUIREMENTS.md edits (coordinator rule).

## Self-Check: PASSED
