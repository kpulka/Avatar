---
phase: 16-animation-mechanics-refactor
plan: 03
subsystem: lipsync
tags: [timebase, clocks, deterministic-tests]
requirements: [ANIM-03]
key-files:
  created: [tests/face-controller-clock.test.ts]
  modified: [src/lipsync/face-controller.ts, tests/face-controller-transitions.test.ts, tests/barge-in-pipeline.test.ts]
status: complete
commits: 2
plan_head_before: 8277538
plan_head_after: a972aee
actuals:
  tasks: 5
  commits: 2
---

# Phase 16 Plan 03: Timebase contract and injectable clocks Summary

`FaceController` takes `nowMs` (default `performance.now`) for RELAXING and turn boundaries next to the 11.2-07 `audibleClock`; the contract is a docstring on the class; RELAXING timing tests are driven by hand instead of vitest fake timers.

## Clock contract (lifted by 16-07 into docs/4)

- **Audio clock** (`audibleClock`, AudioContext seconds compensated for output latency; 11.2-07) owns viseme scheduling, frames playback (`baseSec + timeSec`) and the end-of-turn test. Blink deliberately stays on raw `ctx.currentTime` (monotonic only, not lip-synced).
- **Wall clock** (`nowMs`, default `performance.now`) owns RELAXING and turn-boundary re-anchoring: the 150 ms ease-out is a UI-time ramp, not an audio event. Injectable.
- **rAF timestamp / dt** (capped at 0.1 s in the render loop) owns damping `1 - exp(-lambda*dt)`, emotion cross-fade and gaze/saccade scheduling. The dt cap makes integrators run in deliberate slow motion under very long frames.
- Rule: no arithmetic across clocks.

## Audit (task 5)

Grep of `currentTime` / `performance.now` in `src/lipsync`, `src/realism`: remaining hits are blink/gaze comparing a clock against their OWN scheduled times (same-clock) and `audibleClock` creation. No expression mixes clocks. Verification gate, nothing to repair.

## Tests

- `tests/face-controller-clock.test.ts`: (a) RELAXING completes at 150 +/- 1 ms, (b) double interruption at t=80 completes at 230, wall clock independent of the audio clock, (c) chunk mid-RELAXING never zero-writes the jaw, (d) damping: one 1/30 s step equals two 1/60 s steps (and three 1/90 s) to 1e-9.
- `tests/barge-in-pipeline.test.ts` and `tests/face-controller-transitions.test.ts` use an injected `nowMs`; `grep setSystemTime tests` is empty. Remaining `useFakeTimers` hits are WSS/speech/telemetry suites (unrelated to the FaceController clock; `poc-stress-harness` uses them for its own timers and does not depend on relax timing).
- Test design note: a happy emotion is set so the early-finish rule (`maxWeight < 0.005`) cannot end RELAXING before the timer, otherwise the compounding relax decay would mask the duration.

## Deviations from Plan

None. The plan's literal 150 ms is kept (`relax.durationMs` moves to anim-config in 16-04).

## Self-Check: PASSED
(gate: build OK, 56 files / 321 tests green)
