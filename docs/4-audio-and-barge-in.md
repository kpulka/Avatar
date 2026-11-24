# 4. Audio and Interruption Handling ("Barge-in")

## 📌 Two areas of responsibility

In Mode A ([docs/2](2-elevenlabs-wss-integration.md)) **the server detects the interruption** (the agent listens all the time; when the user starts speaking while the agent's utterance is in progress, ElevenLabs stops the generation and sends the `interruption` event + `agent_response_correction`). The client is responsible only for:

1. **Immediate stop of playback** of the scheduled audio.
2. **Cancelling the viseme queue** and a smooth relaxation of the face.
3. Clean-up of scheduled but not yet played chunks.

In Mode B (our own pipeline) we additionally need our own VAD and closing of the TTS stream — see the section at the end.

---

## 🎵 AudioEngine — Web Audio API

### Why Web Audio, not `<audio>`?

* **Gapless**: we schedule chunks on the precise `ctx.currentTime` axis — no seams between packets.
* **Immediate stop**: `node.stop()` without pop/click + clean-up of scheduled nodes.
* **Shared time axis for lip-sync**: visemes and sound are scheduled on the same clock — this is the condition for synchronization ([docs/3](3-lip-sync-and-coarticulation.md)).

### PCM, not mp3 — important

The ElevenAgents agent streams **raw PCM 44.1 kHz** by default (`agent_output_audio_format` from `conversation_initiation_metadata` — we read it at startup, we do not hardcode it). We avoid `decodeAudioData` (designed for files; decoding mp3 on chunks can add gaps/breaks from the encoder):

```javascript
class AudioEngine {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.activeNodes = [];
    this.tailTime = 0;     // end of the last scheduled audio
    this.epoch = 0;        // "generation" number — see below
  }

  // After a user gesture (click "Talk") — browser autoplay policy!
  async unlock() { if (this.ctx.state === 'suspended') await this.ctx.resume(); }

  playChunk(pcmBytes, sampleRate = 44100) {
    const buffer = this.ctx.createBuffer(1, pcmBytes.length / 2, sampleRate); // mono, 16-bit
    buffer.copyToChannel(this.toFloat32(pcmBytes), 0);

    // Gapless: start = max(now, end of previous) — with a small prebuffer
    const start = Math.max(this.ctx.currentTime + 0.06, this.tailTime);
    this.tailTime = start + buffer.duration;

    const node = this.ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(this.master);
    node.start(start);                     // may be "in the future" — that is OK
    this.activeNodes.push(node);
    node.onended = () => {
      const i = this.activeNodes.indexOf(node);
      if (i !== -1) this.activeNodes.splice(i, 1);   // no node leaks
    };
    return start;                          // !! FaceController schedules visemes relative to THIS time
  }

  toFloat32(bytes) {
    const out = new Float32Array(bytes.length / 2);
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    for (let i = 0; i < out.length; i++)
      out[i] = view.getInt16(i * 2, true) / 32768;
    return out;
  }
}
```

**Prebuffering**: do not start the first chunk immediately — wait for 2–3 chunks (~100–200 ms) from the first `audio` event, then play gaplessly. This absorbs network jitter and prevents "choppy" starts (recommendation from the ElevenLabs documentation: adaptive buffering).

---

## 🛑 Barge-in — revised architecture

### Bugs we are fixing (they were in the previous version of this document)

1. **The `isInterrupted` flag + `setTimeout(200 ms)` reset** — race condition: a new utterance started within the 200 ms window would be **silently rejected**. Fix: an **epoch** — every start of an utterance increments a counter; all scheduled audio/visemes store the epoch in which they were created; after an interruption everything with the old epoch is ignored and cleaned up. Zero timers, zero time windows.
2. **Two modules write to `morphTargetInfluences`** (`updateMorphTargets` and a separate `smoothResetFace`) — the conflict between the writers caused the expression to jitter. Fix: **a single owner — `FaceController`** (state machine).
3. **AudioEngine managed the viseme queue separately** — visemes were outside interruption control. Fix: the viseme scheduler lives in `FaceController`, which listens to interruptions through the shared epoch.

### FaceController — state machine (single owner of the face)

```
IDLE ──(first audio chunk, epoch++)──► SPEAKING
SPEAKING ──(interruption / end of queue)──► RELAXING
RELAXING ──(all weights ≈ 0)──► IDLE
```

```javascript
class FaceController {
  constructor(faceDriver, audioEngine) {
    this.driver = faceDriver;
    this.engine = audioEngine;
    this.state = 'IDLE';
    this.epoch = 0;
    this.queue = [];                 // scheduled visemes (docs/3)
    this.relaxStartedAt = 0;
  }

  // Called on every audio event (docs/2)
  onAudioChunk(alignment, chunkStartTimeSec, epoch) {
    if (epoch !== this.epoch) return;               // defensive check
    if (this.state === 'RELAXING' || this.state === 'IDLE') {
      this.state = 'SPEAKING';                       // new utterance
      this.epoch = epoch;                            // = engine.epoch
    }
    for (let i = 0; i < alignment.chars.length; i++) {
      this.queue.push({
        epoch,
        shapes: mapCharToShapes(alignment.chars, i),  // table from docs/3 (with lookahead)
        startTimeSec: chunkStartTimeSec + alignment.char_start_times_ms[i] / 1000,
        durationSec:  alignment.char_durations_ms[i] / 1000,
      });
    }
  }

  // Called on the interruption event (docs/2) — idempotent (see the transition rules below)
  onInterruption() {
    this.queue.length = 0; this.frameBuffer = [];    // clear both tracks
    if (this.commitPendingMode()) return;            // a deferred mode switch lands on this boundary
    if (this.state === 'IDLE') return;               // nothing to relax from
    this.state = 'RELAXING';                         // SPEAKING relaxes, RELAXING re-anchors its timer
    this.relaxStartedAt = this.nowMs();
  }

    // Single loop — from the Three.js render loop, dt in seconds
  render(dt) {
    if (this.state === 'SPEAKING') {
      // algorithm from docs/3: sum of active visemes + damping, on the AUDIBLE audio clock
      this.renderSpeaking(this.audibleClock(), dt);
      if (this.queue.length === 0 && !this.engine.hasPendingAudio()) {
        this.state = 'RELAXING';                     // natural fade-out at the end of the sentence
        this.relaxStartedAt = this.nowMs();          // injectable wall clock (see "Timebase contract")
      }
    } else if (this.state === 'RELAXING') {
      // Smooth return to neutral: ~150 ms cosine ease (decay-to-zero rule from docs/3)
      const t = (this.nowMs() - this.relaxStartedAt) / 150;
      if (this.renderRelax(Math.min(1, t)) === 0) this.state = 'IDLE';
    }
    // IDLE: the same procedural blinks/micro-movements (docs/6)
  }
}
```

### Interruption sequence (end-to-end)

```
User starts speaking while the agent's utterance is in progress
        │ (detection on the ElevenAgents side — server VAD/turn-taking)
        ▼
Client: { "type": "interruption" }
        │
   ┌────┴──────────────────────────┐
   ▼                               ▼
AudioEngine.hardStop()        FaceController.onInterruption()
   • epoch++                     • epoch ignored in the check
   • stop() all nodes            • clear the viseme queue and the frame buffer
   • tailTime = 0                 • state → RELAXING (150 ms ease; IDLE stays IDLE)
   • (the server itself stops     • mouth returns to neutral
     the TTS generation)             — never a "frozen face"
```

```javascript
hardStop() {
  this.epoch++;                       // invalidates everything scheduled (audio and visemes)
  for (const node of this.activeNodes) {
    try { node.onended = null; node.stop(); node.disconnect(); } catch (e) {}
  }
  this.activeNodes = [];
  this.tailTime = 0;
}
```

### Transition rules (hardened in Phase 16)

Every state × event cell has a defined, tested behavior (`tests/face-controller-transitions.test.ts`, `tests/race-condition-epoch.test.ts`, `tests/face-controller-clock.test.ts`). The rules that matter:

| Situation | Behavior |
| :--- | :--- |
| Interruption in `IDLE` | stays `IDLE`; a pending (deferred) mode switch is still committed |
| Interruption in `SPEAKING` | both tracks cleared → `RELAXING` from the current weights |
| Interruption in `RELAXING` (double barge-in) | stays `RELAXING`, the relax timer is **re-anchored** (bounded at 2 × 150 ms, never frozen) |
| Valid chunk / `feedFrames` in `RELAXING` | → `SPEAKING` (resume). Speech paths never zero-write morphs, so rapid turn-taking has no one-frame flicker |
| Stale-epoch chunk / frames in any state | ignored |
| Mode switch (viseme ↔ frames), immediate or deferred | always lands on a turn boundary and eases through `RELAXING` from the current weights — never a snap to neutral. Mid-turn requests are deferred to the end of the turn or the next interruption; a LIVE turn from the WSS always forces `viseme` and drops a pending deferred switch by design |
| `testPhoneme` / `previewViseme` while `SPEAKING` | ignored — a calibrator button cannot cut a live turn |

### Single writer and per-frame layer order

`FaceController` is the **only** module that writes face morphs (`FaceDriver.applyWeight`); the driver's own rAF "relax" loop was deleted precisely because it was a second writer. Procedural layers are *providers* that hand values in: blink (`setBlinkProvider`) and gaze (`setGazeProvider`, eyeLook\* weights computed by `SceneController`, applied by `FaceController`). Bone regions have their own single owners: eyeball bones — `GazeSaccades` (via `SceneController`), head/chest — `HeadMicroMovements`. When an A2F clip `carriesEyes`, **all** procedural eye writers are switched off — blink, gaze morphs *and* eyeball bones.

Write order inside `FaceController.render` (later writers win):

1. blink → `eyeBlink*` (skipped when frames carry the eyes)
2. gaze morphs → `eyeLook*` (same `carriesEyes` gate)
3. scheduler → **speech subset only** (`jaw*`, `mouth*`, `tongue*`, `cheek*`, `nose*`), so the decay-to-zero rule of docs/3 can never zero eye or brow regions
4. emotion mix → `emotion.mixFactorSpeaking` (0.3) on speech shapes and on the non-speech emotion shapes (frames mode: clip-absolute shapes first, then the same mix on the rest)
5. manual overrides (HUD sliders / previews) — only while not `SPEAKING`

Per frame the app also runs `animationController.update` **before** `sceneController.update` (which calls `renderer.render`), so the picture shows this frame's pose, not the previous one.

### Timebase contract

One clock per concern, **no arithmetic across clocks**:

| Clock | Owns | Why |
| :--- | :--- | :--- |
| Audio clock (`audibleClock`: `AudioContext` time compensated for output latency) | viseme scheduling, frames playback (`baseSec + timeSec`), the end-of-turn test | lips must match what is *heard*, not what is queued |
| Wall clock (`nowMs`, default `performance.now`, injectable) | `RELAXING`, turn-boundary re-anchoring | the 150 ms ease-out is a UI-time ramp, not an audio event; injectable so tests drive it by hand |
| rAF timestamp / `dt` (capped at 0.1 s by the render loop) | damping `1 − exp(−λ·dt)`, emotion cross-fade, gaze/saccade scheduling | FPS-independent by construction; the cap makes integrators run in deliberate slow motion under very long frames |

Blink deliberately uses the raw `ctx.currentTime` (monotonic, not lip-synced). All tuning constants live in `src/lipsync/anim-config.ts` ([docs/3](3-lip-sync-and-coarticulation.md)).

**Why this is sensitive to races, and why the epoch solves it:** the `audio` event may already be "in flight" when the `interruption` arrives (WS ordering does not guarantee that the browser processed them in the same microtask order). With the epoch: a chunk delayed past the interruption arrives at `onAudioChunk` with the old epoch → ignored. A new agent utterance → a new epoch → everything is clean. No timers.

---

## 🎤 Mode B: own interruption pipeline (Phase 2, outline only)

Without ElevenAgents we have to do the following ourselves:
1. **VAD**: Silero VAD (WASM) or WebRTC VAD on the microphone stream; threshold + hysteresis (300 ms hangover) so it does not fire on breathing.
2. **Interrupting the generation**: close the TTS WS (or `flush` + ignore the remaining chunks via the epoch).
3. **Turn-taking**: the decision "user is done vs. just breathing" — the hardest element; frameworks: Pipecat / LiveKit Agents / Speech Engine ([docs/6](6-opensource-analysis-and-future.md)).

---

## ✅ Audio quality checklist (PoC)

- [ ] `AudioContext` unlocked by a user gesture (autoplay policy).
- [ ] PCM chunks 44.1 kHz mono 16-bit (`agent_output_audio_format` read from the metadata).
- [ ] Prebuffer of 2–3 chunks before the first sound.
- [ ] All `AudioBufferSourceNode`s cleaned up in `onended` (no leaks in a 10-minute conversation).
- [x] Interruption: audio stop < 50 ms, face neutral < 300 ms, zero "trapped" chunks — verified by automated tests: `hardStop()` stops and disconnects every node synchronously (`tests/barge-in-pipeline.test.ts`), the face reaches `IDLE` at the 150 ms relax duration on the injected wall clock (`tests/face-controller-clock.test.ts`), stale-epoch chunks are dropped (`tests/race-condition-epoch.test.ts`). Real-device latency (output device buffers) and the "interrupt 10× at random moments" feel check remain a manual UAT item.
