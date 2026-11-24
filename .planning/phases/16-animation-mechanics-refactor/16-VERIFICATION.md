---
phase: 16-animation-mechanics-refactor
type: verification
created: 2026-11-18
executed: 2026-11-24
manual_uat: pending
---

# 16-VERIFICATION — Animation mechanics refactor

> Executed against the worktree branch after plans 16-01..16-07. Automated items carry real
> results; manual (human) items stay PENDING — nothing below is confabulated.
> Baseline at the start of the phase: 52 test files / 291 tests (the 41/204 figure in the
> original template is stale). Now: **59 files / 344 tests green, build OK**.

## 1. Automated gates

| Gate | Command / evidence | Result |
|---|---|---|
| Full suite | `npx vitest run --dir tests` | PASS - 59 files / 344 tests, 0 fail (baseline 52 / 291) |
| Build | `npm run build` (`tsc && vite build`) | PASS |
| Transition matrix | `tests/face-controller-transitions.test.ts` | PASS (12 tests). Rows 3, 7, 13, 14, 16, 17, 18, 19, 21, 22 (the previously untested cells) plus the B5 scenario and pending-mode commit are covered; the other rows were already covered by face-controller-state / race-condition-epoch / animation-frames / barge-in-pipeline |
| Race regression | double interruption (G-8), chunk-during-RELAXING (row 16), frames-during-RELAXING (row 18), mode switch during SPEAKING/RELAXING (G-5), pendingMode drop (G-4) | PASS - all in `face-controller-transitions` + `face-controller-clock` (6 tests) |
| Single writer | `tests/gaze-single-writer.test.ts` (8 tests): G-1 + G-2 regressions; grep: no `morphTargetInfluences` writes in src outside `avatar/face-driver.ts` and the demo-avatar generator (which only allocates the arrays) | PASS (grep count 0) |
| Emotion parity | `tests/emotion-mix-parity.test.ts` (3 tests) - 0.3x both tracks | PASS |
| Clocks | `tests/face-controller-clock.test.ts`: RELAXING at 150 +/- 1 ms and re-anchor at 230 on the injected `nowMs`; FPS-independent damping | PASS; `grep setSystemTime tests` = 0 (other suites keep `useFakeTimers` for WSS/telemetry timers only) |
| Config | `tests/anim-config.test.ts` (11 tests): deep freeze, every key referenced by runtime code, 6 safety numbers snapshotted, bilabial gate numbers | PASS. Grep gate: bare `0.85` in lipsync/realism runtime code only in calibration presets (user-facing profile, intentionally outside config) |
| Allocations | `tests/hot-path-allocations.test.ts` (7 tests): 0 Map/Set/array-copy constructions over 120 frames in BOTH tracks, `allocProbe.count === 0`, golden weights equal to values captured before the refactor (1e-9) | PASS |
| Dead code | grep `purgeStaleEpochs\|setAdaptivePrebuffer\|relaxToNeutral` in src = 0; `FaceController.getEpoch` gone (`getEpoch` remains on AudioEngine only) | PASS |
| Extensibility | third-source (`SYNTH`) registration end to end, `tests/animation-sources.test.ts` (6 tests) | PASS - no FaceController branch edits; dispatch table lookup |
| 30 s drift backstop | `tests/animation-frames.test.ts` (16 tests) | PASS (unchanged test) |
| Barge-in <300 ms | `tests/barge-in-pipeline.test.ts` - audio stop is synchronous (0 active nodes right after `hardStop()`); face reaches IDLE at the 150 ms relax on the injected wall clock | PASS (automated). Real-device latency: PENDING manual |

## 2. Behavior changes (intentional) - sign-off table

| Change | From -> To | Evidence | Human sign-off |
|---|---|---|---|
| Emotion mix in frames track | 100% -> 0.3 (parity with viseme) | parity test + docs/3 section 6 | PENDING (A/B look in Studio compare) |
| Render order | morphs after render -> before (one-frame lag gone) | `container.ts` swap; gaze morphs now use weights computed one frame earlier (invisible) | PENDING (casual demo) |
| Gaze during speech | clobbered to 0 by scheduler -> visible (provider seam, speech-subset scheduler) | G-2 test | PENDING (live check) |
| carriesEyes | morphs only -> also gates eye bones | single-writer test (scene seam) | PENDING (A2F demo with eyes) |
| Mode switch | hard snap to IDLE -> ease through RELAXING | transitions tests | PENDING (switch LIVE<->A2F in Studio) |
| A2E `carriesEmotion` path | removed (no producer; owner decision D3) | a2f-parser test | n/a |

## 3. Manual UAT (human session - PENDING)

DEFERRED-HUMAN (no human session in this run):
1. Live EN conversation: gaze follows while speaking; no eye fights; face never pops on rapid turn-taking or mode switches mid-turn.
2. Spam Przerwij (interrupt) x10: audio stops instantly, face smooth to neutral every time, no freeze (CONV-04 re-check).
3. Studio -> Animation: switch LIVE<->A2F mid-speech (deferred, no cut), during RELAXING (smooth).
4. A2F demo with carriesEyes clip: no double-blink/gaze interference.
5. 30 s utterance: no visible drift (subjective) + telemetry FPS >= 60 (before/after for the allocation work).

## 4. Docs sync (16-07)

- docs/4 (`docs/4-audio-and-barge-in.md`): transition rules, single writer + layer order, timebase contract, idempotent `onInterruption` pseudo-code, checklist restated as verified (automated) with real-device latency left manual - DONE
- docs/3 (`docs/3-lip-sync-and-coarticulation.md`): blend times, bilabial jaw gate (mouthClose OR mouthPress, `pressRef` 0.35), `mouthCloseCap`, lambda tiers via `anim-config` keys, dead lambda=18 fallback noted as removed, emotion mix 0.3 in both tracks with rationale, shared constants - DONE
- 16-DRAFT-animation-runtime.md ready to lift into docs/ (already English; synced to the final API names) - READY
- docs/1 and docs/7 touched in 16-02 to drop `relaxToNeutral` / `carriesEmotion`.

## 5. Cross-phase handoffs

- Phase 17: `testPhoneme` pose duplication (D-7) absorption into the viseme table refactor. FaceController seams for 17: `speechShapeList` (speech-subset filter) and `isSpeechShape` in viseme-scheduler.ts; the char/phoneme enqueue blocks in `onAudioChunk` are unchanged and `viseme.minDurationSec` / `fallback.*` come from `anim-config`; the golden-weight test uses a fixed `setCharMapper`, so table changes will not break it.
- Phase 18: promote matrix + allocation + anim-config tests to CI (cheap, deterministic).
- Phase 13: link slot for the runtime deep-dive (`16-DRAFT-animation-runtime.md` -> docs).
- Phase 14: `container.ts` render-order swap landed here (animation before scene); gaze wiring (2 statements after `telemetryController`) is the only other container edit.
- Observations (not fixed, out of scope): `VisemeScheduler.clear()` keeps its internal weights, so a turn started mid-RELAXING resumes from the stale pre-interruption weights; RELAXING multiplies already-decayed weights by an absolute factor each frame (faster than the nominal 150 ms). Both pre-existing.

## 6. Result

**Phase verdict:** PARTIAL - all automated gates PASS; manual UAT items and human sign-off of the behavior changes are DEFERRED-HUMAN. Per-plan summaries: 16-01..16-07-SUMMARY.md.
