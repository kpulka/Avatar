---
phase: 16-animation-mechanics-refactor
type: verification
created: 2026-11-18
manual_uat: pending
---

# 16-VERIFICATION — Animation mechanics refactor

> Execute for real; every field gets an actual result. Manual (human) items stay PENDING —
> never confabulate outcomes. Baseline: 41 test files / 204 tests green (STATE.md 2026-09-12).

## 1. Automated gates

| Gate | Command / evidence | Result |
|---|---|---|
| Full suite | `npm test` | ☐ (expect: 204+ new, 0 fail) |
| Build | `npm run build` | ☐ |
| Transition matrix | `tests/face-controller-transitions.test.ts` — all 23 cells of 16-CONTEXT §2 covered (rows 3,7,13,14,16-22 were the gap) | ☐ |
| Race regression | double interruption (G-8), chunk-during-RELAXING (row 16), frames-during-RELAXING (row 18), mode-switch during SPEAKING/RELAXING (G-5), pendingMode drop (G-4) — all in suites | ☐ |
| Single writer | `tests/gaze-single-writer.test.ts` — G-1 (gaze vs carriesEyes) + G-2 (foundation rule vs eyeLook*) regressions; grep: no `morphTargetInfluences` writes outside face-controller/face-driver | ☐ |
| Emotion parity | `tests/emotion-mix-parity.test.ts` — 0.3× both tracks (intentional behavior change from 100% frames) | ☐ |
| Clocks | `tests/face-controller-clock.test.ts` — RELAXING deterministic via injected nowMs; zero `vi.setSystemTime` in face/barge-in suites; damping FPS-independence guard | ☐ |
| Config | `tests/anim-config.test.ts` — frozen; 6 safety numbers snapshotted; zero bare literals (grep gate from 16-04 post_task) | ☐ |
| Allocations | `tests/hot-path-allocations.test.ts` — `allocProbe.count === 0` over 120 frames both tracks; golden weights unchanged | ☐ |
| Dead code | grep `purgeStaleEpochs|setAdaptivePrebuffer|getEpoch()|relaxToNeutral` → zero in src/ | ☐ |
| Extensibility | third-source registration test (`SYNTH`) passes without FaceController edits | ☐ |
| 30 s drift backstop | `tests/animation-frames.test.ts` (existing :272) still green | ☐ |
| Barge-in <300 ms | `tests/barge-in-pipeline.test.ts` timing assertions green | ☐ |

## 2. Behavior changes (intentional) — sign-off table

| Change | From → To | Evidence | Human sign-off |
|---|---|---|---|
| Emotion mix in frames track | 100% → 0.3 (parity with viseme) | parity test + docs/3 note | ☐ PENDING (A/B look in Studio compare) |
| Render order | morphs computed after render → before (one-frame lag gone) | container.ts swap; visually invisible | ☐ PENDING (casual demo) |
| Gaze during speech | clobbered to 0 by scheduler → visible (provider seam) | G-2 test | ☐ PENDING (live check) |
| carriesEyes | morphs only → also gates eye bones | single-writer test | ☐ PENDING (A2F demo w/ eyes) |

## 3. Manual UAT (human session — PENDING)

1. Live EN conversation: gaze follows while speaking; no eye fights; face never pops on rapid turn-taking or mode switches mid-turn.
2. Spam Przerwij (interrupt) ×10: audio stops instantly, face smooth to neutral every time, no freeze (CONV-04 re-check).
3. Studio → Animation: switch LIVE↔A2F mid-speech (deferred, no cut), during RELAXING (smooth).
4. A2F demo with carriesEyes clip: no double-blink/gaze interference.
5. 30 s utterance: no visible drift (subjective) + telemetry FPS ≥ 60.

## 4. Docs sync (16-07)

- docs/4: state machine + single-writer + layer order + timebase sections updated ☐
- docs/3: constants → anim-config references; λ=18 removed; emotion mix note ☐
- 16-DRAFT-animation-runtime.md ready for docs/ lift (after Phase 12 EN) ☐

## 5. Cross-phase handoffs

- Phase 17: testPhoneme pose duplication (D-7) absorption into the viseme table refactor.
- Phase 18: promote matrix + allocation tests to CI.
- Phase 13: link slot for the runtime deep-dive once translated.
- Phase 14: container.ts:285-287 reorder landed here (16-02) — 14 must not re-conflict.

## 6. Result

**Phase verdict:** ☐ PASS / PARTIAL / FAIL — filled at close, with per-plan SUMMARY links.
