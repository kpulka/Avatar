---
phase: "16"
name: "Animation mechanics refactor"
created: "2026-11-17"
updated: "2026-11-17"
---

# Phase 16: Animation mechanics refactor — Context

A dedicated refactor pass over the **face-animation runtime** — the part of the codebase
reviewers will read first. Scope: correctness (state machine, races), cleanliness (layer
composition, dead code, naming), performance (hot-path allocations), extensibility (third
source / AvatarDirector seam). Analysis is read-only; every claim below carries file:line
evidence from the working tree as of 2026-11-17.

**Files in scope** (the "animation runtime"):

- `src/lipsync/face-controller.ts` (723 lines) — state machine, epoch, two modes, morph writing
- `src/lipsync/viseme-scheduler.ts` (208) — easing, additive blending, per-group damping
- `src/lipsync/animation-router.ts` (34), `src/lipsync/animation-sources.ts` (60)
- frames playback path: `feedFrames`/`updateFrames` in face-controller + `src/lipsync/demo-frames.ts`
- `src/lipsync/procedural-blink.ts` (98), `src/realism/gaze-saccades.ts` (180),
  `src/realism/head-micro-movements.ts` (116), `src/realism/emotion-layer.ts` (148)
- `src/lipsync/calibration.ts` (118), `src/lipsync/viseme-overrides.ts` (198)
- `src/avatar/face-driver.ts` (121), `src/avatar/shape-normalizer.ts` (111)
- wiring that the runtime's contracts leak into: `src/app/container.ts` (render loop),
  `src/features/animation-controller.ts`, `src/features/scene-controller.ts`,
  `src/features/compare-controller.ts`, `src/audio/audio-engine.ts` (clock/epoch only)
- tests: face-controller-state, race-condition-epoch, barge-in-pipeline, animation-frames,
  animation-router, viseme-scheduler, procedural-blink, gaze-saccades, head-micro-movements,
  emotion-layer, calibration, viseme-overrides

Out of scope (siblings): viseme **data tables** (`viseme-mappings.ts`, `g2p/*` — Phase 17),
UI panels (15), wholesale wiring re-architecture (14), English-ization of comments (12),
CI (18).

---

## 1. Turn lifecycle — traced control flow

### 1.1 LIVE viseme turn (happy path)

```mermaid
flowchart TD
    WSS[WSS audio event] --> SB[speech-backend.onAudioChunk<br/>normalize alignment, rescale to audio axis,<br/>energy fallback if absent]
    SB --> AE[audioEngine.playChunk<br/>start = max(now+80ms, tailTime)<br/>returns baseSec]
    SB --> CC[conversation-controller emits audio:chunk<br/>{bytes, alignment, epoch, startTime, sampleRate}]
    CC --> AC[animation-controller.handleAudioChunk<br/>router: liveTurn=true -> ALWAYS viseme]
    AC --> FC[face-controller.onAudioChunk<br/>epoch guard, IDLE/RELAXING -> SPEAKING]
    FC --> G2P[phoneme path: G2P merge -> ARPAbet spans<br/>override ? override : mapPhonemeToShapes]
    FC --> CHAR[char path: charTokenFor override<br/>? override : mapCharToShapes]
    G2P --> SCH[scheduler.enqueue<br/>startTime = chunkStart + startMs + syncOffset]
    CHAR --> SCH
    loop[every rAF frame] --> R[face-controller.render dt]
    R --> BLK[1. blink provider<br/>audio clock]
    R --> EMO[2. emotionLayer.update dt]
    R --> SPK[3. SPEAKING: scheduler.update nowSec=ctx.currentTime<br/>easing -> additive -> per-group damping]
    SPK --> MIX[emotion mix 0.3, smile suppressed when mouthClose>0.25]
    MIX --> DRV[driver.applyWeight per shape -> sub-meshes]
    DRV --> END{queue empty && !hasPendingAudio?}
    END -- yes --> CP[commitPendingMode or RELAXING<br/>relaxStartedAt = performance.now]
    END -- no --> R
```

### 1.2 Frames turn (A2F demo / compare-B)

`animation-controller.runA2fDemo` (animation-controller.ts:291) or
`compare-controller.playA2f` (compare-controller.ts:223): `hardStop()` → `onInterruption()`
(fresh epoch, clean state) → audio scheduled via `playChunk` (returns `baseSec`) →
`feedFrames(clip, baseSec, epoch)` (face-controller.ts:167): epoch guard → `scheduler.clear()`
(one source at a time) → state → SPEAKING → `frameBuffer = [...clip.frames].sort()`
(**relative `timeSec`, base added once here — contract v2**) → per frame `updateFrames`
(face-controller.ts:471): binary search for last frame with `base+timeSec <= now`,
`buf.slice(idx)` drops consumed frames, owned shapes applied **absolute** (clamp 0..1,
`mouthClose` capped 0.85, `<0.001 → 0`), `currentWeights` written (RELAXING must start from
the last pose), non-owned emotion shapes applied when `!carriesEmotion`, `endTurn()` when
buffer empty && `!hasPendingAudio()`.

### 1.3 Barge-in

WSS `interruption` → speech-backend (speech-backend.ts:121): `audioEngine.hardStop()`
(epoch++, stop/disconnect all nodes, `tailTime = 0`) → `speech:interruption` event →
animation-controller → `faceController.onInterruption()` (face-controller.ts:450):
`scheduler.clear()` + `frameBuffer = []` → `commitPendingMode()` (deferred mode switches
land here — turn boundary) or `state = RELAXING`, `relaxStartedAt = performance.now()`.
Next `render`: RELAXING interpolates every shape from `currentWeights` toward the emotion
target over 150 ms (face-controller.ts:601-633), → IDLE when `progress >= 1 || maxWeight < 0.005`.
Audio stop < 50 ms (synchronous `node.stop()`), face neutral ≤ ~150 ms + one render frame.
Client-side interrupt (Przerwij / embed / PoC-stress) mirrors the same sequence
(conversation-controller.ts:131-139).

### 1.4 Gaps found in the flows (severity-ranked)

| ID | Finding | Evidence | Severity |
|----|---------|----------|----------|
| G-1 | **Gaze writes `eyeLook*` morphs unconditionally, bypassing FaceController** — violates both the single-writer rule (docs/4) and the carriesEyes contract (08-CONTEXT: "gdy A2F niesie oczy — GazeSaccades nie pisze eyeLook*"). During frames+carriesEyes turns the procedural gaze fights A2F's eyes. | scene-controller.ts:127-129 (`gaze.applyToDriver` unconditional); container.ts:285-286 (runs before FaceController.render); no gating anywhere | **P1** |
| G-2 | **Scheduler's foundation rule clobbers `eyeLook*` during SPEAKING/RELAXING.** FaceController passes ALL available shapes (52) into `scheduler.update` (face-controller.ts:563); the damping loop drives every shape not contributed by a viseme toward 0 (viseme-scheduler.ts:122-136, only `eyeBlink*` is skipped at :123) and FaceController writes the result to the driver (:568-583). Gaze morphs written earlier the same frame are overwritten with ~0 whenever the avatar speaks — pointer-following via morphs visibly works only in IDLE. (Visible gaze during speech survives only via the separate eyeball-bone path, scene-controller.ts:131-143 — two competing writers of eye orientation.) | face-controller.ts:563-583; viseme-scheduler.ts:122-136; scene-controller.ts:127-143 | **P1** |
| G-3 | **One-frame morph latency**: `sceneController.update` (which calls `renderer.render`, scene-controller.ts:145) runs BEFORE `animationController.update` (container.ts:285-286), so every frame renders the face with morphs computed in the *previous* frame. | container.ts:285-287; scene-controller.ts:145 | P2 |
| G-4 | **Deferred mode switch silently dies at the next live chunk**: `handleAudioChunk` forces `setAnimationMode('viseme')` without `deferToTurnEnd` (animation-controller.ts:79-82); if a user deferred a switch to A2F mid-turn, the next live turn drops `pendingMode` (face-controller.ts:115-125 path) and `AnimationController.animMode` (='frames') diverges from `FaceController.animationMode` (='viseme'). Correct product behavior (LIVE is always visemes) but undocumented and untested. | animation-controller.ts:75-84, 98-111; face-controller.ts:115-125 | P2 |
| G-5 | **Mode switch during RELAXING hard-snaps the face**: `setAnimationMode` only defers when `state === 'SPEAKING'` (face-controller.ts:120); during RELAXING both immediate and deferred requests fall through to `applyModeImmediate`, which zeroes every non-eyeBlink shape via `clearManualOverrides` (face-controller.ts:128-137, 686-693) and jumps to IDLE — a visible pop instead of the smooth relax the phase promises. | face-controller.ts:115-137 | P2 |
| G-6 | **`testPhoneme` can cut live speech**: no SPEAKING guard (unlike `previewViseme`, face-controller.ts:234-235); `testPhoneme('neutral')` force-enters RELAXING even mid-turn (face-controller.ts:377-383). | face-controller.ts:377-445 | P2 |
| G-7 | **Interruption during IDLE** needlessly enters RELAXING (from zero weights) — harmless but untested and noisy for state observers. | face-controller.ts:450-461 | P3 |
| G-8 | **Double interruption restarts the relax timer** — face stays in RELAXING up to 2×150 ms. Acceptable visually, but the behavior is undefined-by-test. | face-controller.ts:458-459 | P3 |
| G-9 | **frames-vs-audio length mismatch**: if a clip is longer than its audio, the face keeps animating after silence (zero-order hold until last frame); if shorter, SPEAKING idles with empty buffer until audio drains (`endTurn` gate is `hasPendingAudio` only). Both benign today (single-shot clips), but the contract is undocumented. | face-controller.ts:475-486, 532-533 | P3 |
| G-10 | **`feedFrames` replaces the buffer wholesale** — no append/streaming semantics. Fine for today's single-shot clips; blocks future streaming A2F without noticing. | face-controller.ts:182 | P3 |

---

## 2. State machine — transition × event matrix (with test coverage)

States: `IDLE`, `SPEAKING`, `RELAXING`. Events: audio chunk (valid/stale epoch),
`feedFrames` (valid/stale), `onInterruption`, natural turn end (render), relax completion
(render), `setAnimationMode` (immediate/deferred), `testPhoneme`, `previewViseme`.

| # | State | Event | Current behavior | Tested? (file:line) |
|---|-------|-------|-------------------|--------------------|
| 1 | IDLE | chunk (valid) | → SPEAKING, queue filled, manual overrides cleared | ✅ face-controller-state.test.ts:57 |
| 2 | IDLE | chunk (stale) | ignored | ✅ face-controller-state.test.ts:72 |
| 3 | IDLE | interruption | → RELAXING (from zeros; wasted transition) | ❌ **untested** (G-7) |
| 4 | IDLE | feedFrames (valid) | → SPEAKING (frames) | ✅ animation-frames.test.ts:82 (state asserted :96) |
| 5 | IDLE | feedFrames (stale) | ignored | ✅ animation-frames.test.ts:140 |
| 6 | IDLE | setAnimationMode (immediate) | apply + clear + IDLE | ✅ animation-frames.test.ts:77 |
| 7 | IDLE | setAnimationMode (deferred) | **falls through to immediate** (defer only guards SPEAKING) | ❌ untested (G-5 adjacent) |
| 8 | SPEAKING | chunk (valid) | stay SPEAKING, enqueue | ✅ race-condition-epoch.test.ts:119-129 |
| 9 | SPEAKING | chunk (stale) | ignored | ✅ race-condition-epoch.test.ts:102-111 |
| 10 | SPEAKING | interruption | queue+frames cleared → RELAXING | ✅ face-controller-state.test.ts:89; barge-in-pipeline.test.ts:79; animation-frames.test.ts:124 |
| 11 | SPEAKING | turn end (queue 0, !pending) | → RELAXING (or commitPendingMode) | ✅ animation-frames.test.ts:106, 224 |
| 12 | SPEAKING | setAnimationMode (deferred) | pendingMode stored, no visual change | ✅ animation-frames.test.ts:224, 251 |
| 13 | SPEAKING | setAnimationMode (immediate) | hard clear → IDLE (dev switch) | ⚠️ covered only as frames-mode clear (animation-frames.test.ts:77) |
| 14 | SPEAKING | testPhoneme | **cuts speech** (unwanted) | ❌ untested (G-6) |
| 15 | SPEAKING | previewViseme | ignored (guard) | ✅ implicit (guard face-controller.ts:235) |
| 16 | RELAXING | chunk (valid) | → SPEAKING (resume) | ❌ **untested** (docs/4 promises this) |
| 17 | RELAXING | chunk (stale) | ignored | ❌ untested |
| 18 | RELAXING | feedFrames (valid) | → SPEAKING (frames) — compare-B path relies on it | ❌ **untested** |
| 19 | RELAXING | interruption | → RELAXING, timer restarts | ❌ **untested** (G-8, double interruption) |
| 20 | RELAXING | relax complete | → IDLE, scheduler.resetAll, frames meta cleared | ✅ barge-in-pipeline.test.ts:114-121 |
| 21 | RELAXING | setAnimationMode (immediate) | **hard snap to neutral → IDLE** (pop) | ❌ untested (G-5) |
| 22 | RELAXING | setAnimationMode (deferred) | **falls through to immediate** (surprising) | ❌ untested (G-5) |
| 23 | any | epoch bump while items queued | old-epoch items purged inside scheduler.update | ✅ race-condition-epoch.test.ts (queue rejection), viseme-scheduler foundation tests |

**9 untested cells**, two of which (16, 18) are load-bearing for resume-after-relax and the
compare-B replay. The barge-in test's use of `vi.setSystemTime(performance.now() + 160)`
(barge-in-pipeline.test.ts:115-123) couples the suite to vitest faking `performance.now` —
fragile against any RELAXING clock change (see timebase).

---

## 3. Timebase discipline

| Clock | Consumers | Evidence | Notes |
|-------|-----------|----------|-------|
| `AudioContext.currentTime` | scheduler.update (`nowSec`), `updateFrames`, ProceduralBlink (via blinkProvider closure), `playChunk` scheduling, `hasPendingAudio`, gaze... **no** — gaze does NOT use it | face-controller.ts:540, :81; viseme-scheduler.ts:73; audio-engine.ts:52-103 | Master axis for speech/frames — correct (docs/4). Monotonic; anchors `baseSec` once in `feedFrames` (contract v2 honored). 30 s drift backstop: animation-frames.test.ts:272. |
| `performance.now()` | RELAXING (`relaxStartedAt`, progress), `commitPendingMode`, dead `relaxToNeutral`, telemetry | face-controller.ts:157, :459, :602-603; face-driver.ts:82 | UI wall clock for relax — no cross-clock arithmetic performed (OK), but fake-timer-coupled in tests. |
| rAF timestamp | render-loop `dt` (capped 0.1 s at container.ts:283), FPS window, gaze/saccade scheduling (`timestampMs/1000`) | container.ts:279-298; scene-controller.ts:116, :128 | Gaze's internal schedule (nextSaccadeTimeSec, saccade start) lives on this axis — diverges from the audio clock; cosmetic only (saccades are not speech-aligned). |
| Accumulated `dt` | EmotionLayer cross-fade, HeadMicroMovements.elapsedTime | emotion-layer.ts:107; head-micro-movements.ts:86 | Time-based progress (not per-frame increments) → FPS-independent. dt cap makes integrators slow-mo under long frames — deliberate, undocumented. |

Verdict: the *critical* axis (speech↔audio) is disciplined and tested; the rest is
inconsistent-but-benign. Problems: (a) RELAXING's wall clock is the only reason tests need
fake timers — an injectable `nowMs()` would make the state machine deterministic;
(b) the timebase contract exists nowhere in writing; (c) damping `alpha = 1 - exp(-λ·dt)`
(viseme-scheduler.ts:125, gaze-saccades.ts:70) is correctly FPS-independent — keep.

---

## 4. Layer composition (per-frame write order) and clamps

Actual order per rendered frame (container.ts:285-287):

1. `sceneController.update`: headMicro (bones: Neck/Head/Chest) → camera → **gaze.applyToDriver
   writes `eyeLook*` × 0.35 directly to driver** (scene-controller.ts:127-129) →
   gaze.applyToEyeObjects (eyeball bones, :131-143) → `renderer.render` (:145)
2. `animationController.update` → `FaceController.render(dt)`:
   a. blink `eyeBlink*` (audio clock; skipped when frames+carriesEyes, face-controller.ts:544-549)
   b. `emotionLayer.update(dt)` → emotionWeights
   c. state branch:
      - SPEAKING·viseme: scheduler weights for **all 52 shapes** + emotion×0.3 on shared shapes
        (face-controller.ts:573-579), `mouthSmile*` emotion suppressed while `mouthClose > 0.25` (:573);
        then an "emotion-only shapes" loop (:586-590) that is **dead for complete rigs** — every
        available shape is already in `updatedWeights` (scheduler returns all of `speechShapes`,
        viseme-scheduler.ts:122-136), so it only fires for shapes missing from the model (where
        the driver write is a no-op anyway). Net effect: brows/cheeks get 30% during speech, not 100%.
      - SPEAKING·frames: owned shapes absolute; if `!carriesEmotion`, non-owned emotion shapes at
        **100%** (face-controller.ts:522-530) — inconsistent with the viseme track's 30%.
      - RELAXING: every non-eyeBlink shape lerped from `currentWeights` toward the emotion target
        (face-controller.ts:601-633).
      - IDLE: emotion weights only (:635-643).
   d. manual overrides when !SPEAKING, with the jaw-vs-close guard `≤ jaw + 0.20` (:646-658).

Clamps / priority rules (where enforced):

- `mouthClose` hard cap 0.85: `CLOSE_SAFETY_CAP` (viseme-scheduler.ts:23, applied :150) and
  `FRAME_CLOSE_CAP` (face-controller.ts:21, applied :515) — **two duplicated constants**.
- jaw suppression when `activeMouthClose > 0.15`: `jaw *= max(0, 1 - (close/closeScale)·0.95)`
  (viseme-scheduler.ts:113-116).
- anatomical guard on manual overrides: `mouthClose ≤ jawOpen + 0.20` — duplicated in
  `setManualOverride` (face-controller.ts:668-671, :676-682) and the render loop (:651-655).
- driver-level clamp 0..1 (face-driver.ts:56) — final safety net, good.
- `<0.001 → hard 0` snapping in three places (viseme-scheduler.ts:133; face-controller.ts:204, :516).

Interference findings: G-1 (gaze vs carriesEyes), G-2 (foundation rule clobbers eyeLook),
emotion mix asymmetry (30% viseme vs 100% frames), one-frame render lag (G-3).
Blink is cleanly protected in all branches (`eyeBlink` skipped everywhere it must be).

---

## 5. Smoothing architecture

Per-source separation is **clean by design** (08-CONTEXT decision honored): the viseme
track smooths (easing + per-group damping `lambdaForShape`: closure ×1.7, jaw/tongue ×1.55,
smile ×0.45, base = `coarticulationSpeed`, viseme-scheduler.ts:167-173); the frames track is a
strict passthrough (zero-order hold, no damping — A2F micromimicry preserved, face-controller.ts:471-534).
Gating (`carriesEyes`/`carriesEmotion`) lives in one place (render + updateFrames). This is the
best part of the runtime and should change the least.

Wrinkles:

- scheduler λ base has a dead fallback `?? 18` (viseme-scheduler.ts:41) — the profile always
  carries `coarticulationSpeed` (30 in every preset, calibration.ts:44/55/65), so 18 never fires;
  the docstring (:12) still claims 18. Misleading.
- `VisemeSchedulerOptions.lambda/blendInSec/blendOutSec` are constructor-only knobs, never used
  by production (FaceController constructs with defaults) — test-only surface.
- smoothing constants are not tunable without code edits (see census below).

---

## 6. Magic-number census (28 groups)

| # | Constant | Value | Location | Move to config? |
|---|----------|-------|----------|-----------------|
| 1 | FRAME_CLOSE_CAP / CLOSE_SAFETY_CAP | 0.85 (duplicated) | face-controller.ts:21; viseme-scheduler.ts:23 | **merge into one shared constant** |
| 2 | relaxDurationMs | 150 ms | face-controller.ts:46 | yes — `anim.relax.durationMs` |
| 3 | energy-fallback thresholds | skip ≤0.02; jaw `min(0.5, e×2.0)`; min dur 0.035 | face-controller.ts:291-299 | yes — `anim.fallback.*` |
| 4 | min viseme duration | 0.035 s | face-controller.ts:329, :361 | yes — `anim.viseme.minDurationSec` |
| 5 | smile-suppression close threshold | 0.25 | face-controller.ts:573 | yes — `anim.emotion.smileSuppressClose` |
| 6 | emotion mix factor | 0.3 | face-controller.ts:578 | yes — `anim.emotion.mixFactor` |
| 7 | RELAXING finish epsilon | 0.005 | face-controller.ts:624 | yes — `anim.relax.finishEpsilon` |
| 8 | jaw guard margin | +0.20 | face-controller.ts:653, :669-671, :679 | yes — `anim.manual.jawGuardMargin` |
| 9 | override filter epsilon | 0.001 | face-controller.ts:204; viseme-scheduler.ts:133; face-controller.ts:516 | yes — `anim.snapEpsilon` (dedupe 3×) |
| 10 | blendIn/blendOut | 35/45 ms | viseme-scheduler.ts:42-43 | yes — `anim.viseme.blend*` |
| 11 | λ tiers | ×1.7 / ×1.55 / ×0.45 | viseme-scheduler.ts:169-172 | yes — `anim.viseme.lambdaTiers` |
| 12 | mouthClose→jaw damp threshold/factor | 0.15 / 0.95 | viseme-scheduler.ts:113-115 | yes — `anim.viseme.closeJaw*` |
| 13 | λ dead fallback | 18 | viseme-scheduler.ts:41 | delete (dead) |
| 14 | blink cadence | 2.5–6.0 s | procedural-blink.ts:29-30 | yes — `anim.blink.interval{Min,Max}Sec` |
| 15 | blink close/open | 80/200 ms | procedural-blink.ts:31-32 | yes — `anim.blink.{close,open}Sec` |
| 16 | double-blink chance / pause | 0.15 / 0.1 s | procedural-blink.ts:43, :66 | yes — `anim.blink.double{Chance,pauseSec}` |
| 17 | blink asymmetry | 0.98 | procedural-blink.ts:90 | yes — `anim.blink.rightScale` |
| 18 | gaze max angle / saccade bounds | 0.26 rad; 0.5–2.0 s; 0.087 rad | gaze-saccades.ts:47-50 | yes — `anim.gaze.*` |
| 19 | gaze damping λ | 15 | gaze-saccades.ts:70 | yes — `anim.gaze.lambda` |
| 20 | gaze morph weight | 0.35 | gaze-saccades.ts:102 | yes — `anim.gaze.morphWeight` |
| 21 | eye-bone rotation scales | 0.9 / 0.75 (+0.061 rest) | gaze-saccades.ts:121-122, :128/:137 | yes — `anim.gaze.bone*` |
| 22 | saccade duration | 0.035–0.05 s | gaze-saccades.ts:151, :44 | yes — `anim.gaze.saccade*` |
| 23 | micro-movement amplitudes | 0.012/0.008/0.004 rad | head-micro-movements.ts:33-35 | yes — `anim.head.*` |
| 24 | breathing freq/amp | 0.22 Hz / 0.002 m; chest scale 0.02/0.035 | head-micro-movements.ts:36-37, :106-107 | yes — `anim.breath.*` |
| 25 | head harmonic coefficients | 6 freq/amp pairs | head-micro-movements.ts:51-65 | keep inline (they ARE the curve) but reference from config doc |
| 26 | emotion cross-fade | 0.4 s; decay eps 0.002 | emotion-layer.ts:36, :123 | yes — `anim.emotion.{crossFadeSec,decayEpsilon}` |
| 27 | emotion profile weights | happy/surprised/focused maps | emotion-layer.ts:8-25 | data — keep, but move next to config for discoverability |
| 28 | prebuffer / dt cap | 0.08 s / 0.1 s | audio-engine.ts:13; container.ts:283 | prebuffer → audio area (cross-note); dt cap → `anim.frame.dtCapSec` |

Recommended shape: one typed module `src/lipsync/anim-config.ts` exporting a frozen
`ANIM_DEFAULTS` object + `AnimConfig` type; runtime files import named values.
**Do NOT** bloat the studio CalibrationProfile — it stays the user-facing mouth-tuning
surface; anim config is developer-facing (studio-locked overrides optional later).

---

## 7. Performance — per-frame allocations in the hot path

Identified allocations executed every rendered frame while SPEAKING (viseme):

| # | Allocation | Location | Rate |
|---|-----------|----------|------|
| A-1 | `targets = new Map()` | viseme-scheduler.ts:79 | 60/s |
| A-2 | `this.queue = this.queue.filter(...)` — new array, O(queue) | viseme-scheduler.ts:82 | 60/s (worst with long utterances) |
| A-3 | `updated = new Map()` | viseme-scheduler.ts:120 | 60/s |
| A-4 | `allShapes = new Set([...])` | emotion-layer.ts:113 | 60/s |
| A-5 | `return new Map(this.activeWeights)` | emotion-layer.ts:134 | 60/s |
| A-6 | `endTurn` closure | face-controller.ts:475 | 60/s (frames mode) |
| A-7 | `buf.slice(idx)` new frame array | face-controller.ts:508 | ~30/s (frames mode) |
| A-8 | `EyeGazeWeights` object literal + `Object.entries()` in applyToDriver | gaze-saccades.ts:81-93, :101 | 60/s |
| A-9 | `{ left, right }` blink object | procedural-blink.ts:88-91 | 60/s |
| A-10 | RELAXING writes all 52 shapes even when current≈0 and target=0 (wasted driver writes × sub-meshes) | face-controller.ts:610-622 | 60/s |

Also: `meta.shapes.indexOf(shape)` linear scan per emotion shape per frame
(face-controller.ts:525) — use a Set. None of this breaks 60 FPS today (tiny objects,
generational GC), but it is exactly what a reviewer greps for in a "performance" refactor,
and A-2 is O(queue) with allocation. Existing telemetry (telemetry.ts) covers FPS/frameTime
only — no allocation/GC visibility. Strategy: make the hot path allocation-free **by
construction** (reused scratch structures), add opt-in debug counters to *prove* it in tests.

---

## 8. Extensibility (AvatarDirector direction)

- `AnimationSourceRegistry` (animation-sources.ts:22-39) is open for registration — good —
  but `AnimationSourceSpec.short: 'LIVE' | 'A2F'` (:17) is a **closed union**: a third source
  cannot label itself without editing the type. And `apply(ctx)` only speaks
  `setSource(mode: AnimationMode)` — the registry describes UI choices, not runtime sources;
  a "body gestures" source has no `AnimationMode`.
- Adding a third *runtime* mode today means editing the FaceController state machine
  (render switch, feed path, safety) — the module is not open/closed at the seam that matters.
  The blink provider (face-controller.ts:63, :255) is the right pattern already in place:
  FaceController owns scheduling/safety, providers own values.
- `resolveAnimationSource` (animation-router.ts:27-34) is a clean pure function — the right
  future home of per-turn policy — but production wiring always passes `liveTurn: true`
  (animation-controller.ts:79) and the compare/demo paths bypass it entirely.
- The 08-CONTEXT promise "FaceController remains the only writer of face morphs; other
  regions get their own owners" is currently broken by gaze (G-1) and by the dead
  `relaxToNeutral` rAF loop in the driver (face-driver.ts:91-111) — a latent second writer
  one call away from reactivating.

---

## 9. Tech debt from rapid builds (phases 7/8/11)

| ID | Smell | Evidence | Severity |
|----|-------|----------|----------|
| D-1 | Dead: `VisemeScheduler.purgeStaleEpochs` — zero callers | viseme-scheduler.ts:65; grep confirms | P3 |
| D-2 | Dead + dangerous: `FaceDriver.relaxToNeutral` spawns its own rAF loop writing morphs (second writer); zero production callers; every test mock carries it | face-driver.ts:70-112; types/avatar.ts:42; 8 test mocks | P2 |
| D-3 | Dead API family: `AudioEngine.setAdaptivePrebuffer` / `bumpPrebufferForJitter` / `getPrebufferSeconds` — no production callers (tests only); `setAdaptivePrebuffer(false, x)` silently ignores `x` | audio-engine.ts:121-135; grep | P3 |
| D-4 | Redundant state: `FaceController.epoch` mirrors `engine.getEpoch()`; `getEpoch()` (:699) has no production caller | face-controller.ts:44, :172, :277, :699 | P3 |
| D-5 | Dead fallback `?? 18` + stale docstring "domyślnie 18" | viseme-scheduler.ts:41, :12 | P3 |
| D-6 | Duplicated constants: 0.85 cap ×2; clamp01 ×2 (face-controller.ts:23, demo-frames.ts:29); jaw-guard margin ×3 sites; snap epsilon ×3 | see census | P3 |
| D-7 | `testPhoneme` hardcodes 8 poses duplicating viseme-table values (drift risk with Phase 17 tables) | face-controller.ts:377-445 | P3 |
| D-8 | Naming drift: `getFrameQueueLength()` (frames) vs `getQueueLength()` (visemes) on the same class | face-controller.ts:195, :703 | P3 |
| D-9 | Constructor does IO/side effects: localStorage read (loadVisemeOverrides) + G2P dynamic import | face-controller.ts:86-91 | P2 (testability) |
| D-10 | `charTokenFor` double-exported (viseme-overrides re-export alongside viseme-mappings) | viseme-overrides.ts:198 | P4 |
| D-11 | Mixed-language logs/comments across all runtime files (Phase 12 will touch these files — sequencing note) | everywhere | P3 (cross-area) |
| D-12 | `emotionLayer.analyzeText` allocates keyword arrays per call (per turn — not hot, but free to hoist) | emotion-layer.ts:45-81 | P4 |

---

## 10. Target-state decisions

**What changes** (mapped to plans):

1. State machine becomes exhaustive & race-proof: all 23 matrix cells defined; RELAXING
   handles interruption idempotently; mode switches never hard-snap the face (defer through
   the relax); dev tools guarded (16-01).
2. FaceController becomes the single writer again: gaze morphs flow through a
   `setGazeProvider` seam (mirroring blink); `carriesEyes` gates ALL procedural eye writers;
   scheduler receives a mouth-shape subset so the foundation rule can't zero non-speech
   regions; the dead `relaxToNeutral` loop is removed (16-01/16-02/16-04).
3. One emotion-mix policy in both tracks during SPEAKING (single `emotionMixFactor`,
   default 0.3 — **intentional behavior change** in frames mode, currently 100%; acceptance:
   parity test + UAT item). The "emotion-only shapes full weight" loop becomes live and
   meaningful again (16-02).
4. Render order fixed: face morphs computed before `renderer.render` (kills the one-frame
   lag) — **intentional, invisible-in-practice change** (16-02).
5. Timebase contract documented + injectable `nowMs` clock on FaceController for
   deterministic tests (16-03).
6. All 28 magic-number groups resolve to named config (16-04).
7. Hot path allocation-free by construction + debug counters (16-05).
8. Third source plugs in via a source-strategy seam without editing the state machine;
   registry unions opened (16-06).
9. Dead code removed, naming unified (16-04).
10. docs/4 + docs/3 synced; recruiter-facing runtime deep-dive drafted (16-07).

**What deliberately stays**:

- Epoch-based barge-in architecture (docs/4) — untouched.
- Contract v2 (relative `timeSec`, `baseSec` added once, `carriesEyes`/`carriesEmotion`) — untouched.
- Per-source smoothing split (scheduler λ vs frames passthrough) — untouched in mechanics;
  only constants move.
- RELAXING on the wall clock (documented rationale: it's a UI-time ease, not an audio event)
  — but injectable for tests.
- `CalibrationProfile` shape and studio sliders — no schema change in this phase.
- Blink provider pattern, additive blending, mouthClose priority rule, `1-exp(-λ·dt)` damping.
- Viseme data tables (Phase 17's lane).
- Bone-based eyeball rotation as the *visible* gaze channel (kept; documented as the
  bone region owner while morphs go through FaceController).

---

## 11. Cross-area notes (for the orchestrator)

- **Phase 14 (architecture)**: 16-02's minimal rewiring of container.ts/scene-controller.ts
  (gaze provider + render order) is the only place Phase 16 touches wiring; hand the bigger
  moves (controller splitting, event flow) to 14 and sequence 16-02 before or after it
  consciously — both edit container.ts:285-287.
- **Phase 12 (English-ization)**: every file in my area carries Polish comments/logs. If 12
  lands first, the file:line references in these plans shift — recommend 16 lands first, or
  plan owners re-anchor line refs at execution time.
- **Phase 17 (lip-sync pipeline)**: owns viseme DATA (tables, G2P). `testPhoneme` pose
  duplication (D-7) is flagged for 17 to absorb into its table refactor; Phase 16 only adds the
  state guard.
- **Phase 18 (CI)**: the new allocation/perf tests (16-05) are cheap and CI-safe; consider
  promoting them to the pipeline.
- **Phase 13 (README)**: 16-DRAFT-animation-runtime.md is written to be lifted into docs/ or
  linked from README — the runtime is the recruiter showpiece.
- **AudioEngine dead APIs** (D-3) are audio-area files; Phase 16 removes only the dead
  methods — flag to 14's owner so no parallel edit collides.

---

## 12. Proposed requirements

- **ANIM-01 State-machine correctness**: every state×event cell (23-row matrix) has defined,
  tested behavior; no code path can hard-snap or freeze the face; interruption is idempotent;
  dev tools (testPhoneme/previewViseme) cannot cut a live turn.
- **ANIM-02 Single writer**: FaceController is the only module writing morphTargetInfluences;
  gaze morphs flow through a provider; carriesEyes gates every procedural eye writer; the
  driver's rAF relax loop is removed.
- **ANIM-03 Timebase contract**: one documented clock policy (audio clock for speech/frames/
  blink; wall clock for relax; rAF ts for gaze scheduling); injectable clocks; no cross-clock
  arithmetic; FPS-independent damping preserved by tests.
- **ANIM-04 Layer composition**: explicit per-frame write order (documented in code); scheduler
  receives the speech-shape subset so the foundation rule cannot clobber eye/brow regions;
  one emotion-mix policy across both tracks; mouthClose priority and guards implemented once.
- **ANIM-05 Config extraction**: all tuning constants live in one typed defaults module;
  no bare magic numbers in runtime logic; CalibrationProfile unchanged.
- **ANIM-06 Hot-path performance**: zero per-frame allocations in the SPEAKING path (both
  tracks) — scratch structures, in-place queue pruning, Set lookups; verified via debug
  counters in tests; no behavior change.
- **ANIM-07 Extensibility**: a third animation source registers and runs without editing
  FaceController internals; no closed unions in source specs; the AvatarDirector region seam
  is documented.
- **ANIM-08 Dead code & naming**: purgeStaleEpochs, relaxToNeutral, adaptive-prebuffer family,
  epoch mirror, dead λ fallback, unreachable emotion loop — removed; duplicated constants
  merged; queue-length APIs named consistently.
- **ANIM-09 Test coverage**: the transition matrix fully covered including all races
  (double interruption, chunk-during-RELAXING, frames-during-RELAXING, mode-switch races,
  pendingMode drop); deterministic clocks replace fake-timer coupling.
- **ANIM-10 Docs sync**: docs/4 interruption sequence + docs/3 smoothing table updated to
  match implementation; animation-runtime deep-dive draft ready for docs/; 16-VERIFICATION.md
  executed.
