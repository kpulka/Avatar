---
phase: 16-animation-mechanics-refactor
plan: 04
subsystem: lipsync
tags: [config, dead-code, naming]
requirements: [ANIM-05, ANIM-08]
key-files:
  created: [src/lipsync/anim-config.ts, tests/anim-config.test.ts]
  modified: [src/lipsync/face-controller.ts, src/lipsync/viseme-scheduler.ts, src/lipsync/procedural-blink.ts, src/lipsync/demo-frames.ts, src/lipsync/a2f-parser.ts, src/lipsync/viseme-overrides.ts, src/realism/gaze-saccades.ts, src/realism/head-micro-movements.ts, src/realism/emotion-layer.ts, src/audio/audio-engine.ts, src/app/container.ts]
status: complete
commits: 3
plan_head_before: 1d00b79
plan_head_after: bc77204
actuals:
  tasks: 6
  commits: 3
---

# Phase 16 Plan 04: Config extraction and dead-code removal Summary

All animation tuning constants live in one deeply frozen `ANIM_DEFAULTS` (`src/lipsync/anim-config.ts`); shared constants are deduplicated; dead APIs are gone. Zero behavior change.

## Config key -> old literal map

| Key | Value | Old site |
|-----|-------|----------|
| relax.durationMs / finishEpsilon | 150 / 0.005 | face-controller relaxDurationMs, RELAXING finish |
| fallback.skipEnergyBelow / jawScale / jawCap / minDurationSec | 0.02 / 2.0 / 0.5 / 0.035 | energy-fallback block in onAudioChunk |
| viseme.minDurationSec | 0.035 | phoneme + char paths |
| viseme.blendInSec / blendOutSec | 0.035 / 0.045 | scheduler constructor defaults |
| viseme.lambdaTiers closure / jawTongue / smile | 1.7 / 1.55 / 0.45 | lambdaForShape |
| viseme.closeJawThreshold | 0.15 | BOTH jaw-gate comparisons (`activeMouthClose > t \|\| activePress > t`, 11.2-08) |
| viseme.closeJawFactor | 0.95 | jaw damping strength |
| viseme.pressRef | 0.35 | scheduler `PRESS_REF` (11.2-08) - a config key, not a frozen formula |
| emotion.mixFactorSpeaking | 0.3 | both tracks (16-02) |
| emotion.smileSuppressClose | 0.25 | smile suppression on bilabials |
| emotion.crossFadeSec / decayEpsilon | 0.4 / 0.002 | emotion-layer |
| manual.jawGuardMargin | 0.20 | 3 sites -> one `guardClose()` helper |
| common.mouthCloseCap | 0.85 | FRAME_CLOSE_CAP + CLOSE_SAFETY_CAP merged |
| common.snapEpsilon | 0.001 | scheduler, frames path, setVisemeOverride |
| blink.* | 2.5 / 6.0 / 0.08 / 0.2 / 0.15 / 0.1 / 0.98 | procedural-blink |
| gaze.* | .26 / .5 / 2.0 / .087 / 15 / .35 / .9 / .75 / .061 / .035 / .05 | gaze-saccades + face-controller morph weight |
| head.* / breath.* | .012/.008/.004; .22/.002/.02/.035 | head-micro-movements |
| frame.dtCapSec | 0.1 | container render loop |

`clamp01` is exported once from anim-config (face-controller, demo-frames, a2f-parser copies deleted).

## Dead code removed

`VisemeScheduler.purgeStaleEpochs`; `AudioEngine.setAdaptivePrebuffer/bumpPrebufferForJitter/getPrebufferSeconds` (prebuffer is now a module const `PREBUFFER_SEC = 0.08`); `FaceController.epoch` mirror + `getEpoch()`; the `?? 18` lambda fallback and its stale docstrings; the `charTokenFor` re-export in viseme-overrides. `FaceController.getQueueLength` renamed `getVisemeQueueLength` (pair with `getFrameQueueLength`). Gate: `grep purgeStaleEpochs|setAdaptivePrebuffer|relaxToNeutral` over src is empty (asserted in tests/anim-config.test.ts); `getEpoch` remains only on AudioEngine.

## Deviations from Plan

1. **Extra keys beyond the plan list:** `viseme.pressRef` (required by drift A1 #6), `gaze.saccadeDefaultDurationSec` (0.04, initial/forced saccade). `emotion.mixFactorSpeaking` replaces the temporary `EMOTION_MIX_SPEAKING` export from 16-02 (its test now reads the config).
2. **CalibrationProfile untouched** (no "schema unchanged" assertion, per drift A1 #7: it now carries `clockVersion` and 20/30/40 ms presets; the user-facing `0.85` slider presets in calibration.ts are deliberately not config).
3. **Tests pruned with the removed API (allowed by the plan):** telemetry "adaptive prebuffer" test and the viseme-overrides "charTokenFor re-export" test removed; viseme-overrides test now imports `charTokenFor` from viseme-mappings. `getQueueLength` renamed in 4 test files.
4. **Commit grouping:** the first commit also carries the in-file dead-code removals in face-controller / viseme-scheduler (same files); the second holds audio-engine and viseme-overrides.
5. Left as-is (not tuning, defensive defaults): `?? 70` / `?? 50` ms fallback durations for missing alignment entries; `testPhoneme` pose literals (Phase 17 / D-7); head harmonic coefficients and the breath `1.2` exponent (the curve).

## Self-Check: PASSED
(gate: build OK, 57 files / 330 tests green)
