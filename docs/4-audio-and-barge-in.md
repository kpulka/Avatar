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

  // Called on the interruption event (docs/2)
  onInterruption() {
    this.queue = this.queue.filter(() => false);     // clear everything
    this.state = 'RELAXING';
    this.relaxStartedAt = performance.now();
  }

  // Single loop — from the Three.js render loop, dt in seconds
  render(dt) {
    if (this.state === 'SPEAKING') {
      // algorithm from docs/3: sum of active visemes + damping
      this.renderSpeaking(this.engine.ctx.currentTime, dt);
      if (this.queue.length === 0 && !this.engine.hasPendingAudio()) {
        this.state = 'RELAXING';                     // natural fade-out at the end of the sentence
        this.relaxStartedAt = performance.now();
      }
    } else if (this.state === 'RELAXING') {
      // Smooth return to neutral: ~150 ms cosine ease (decay-to-zero rule from docs/3)
      const t = (performance.now() - this.relaxStartedAt) / 150;
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
   • stop() all nodes            • clear the viseme queue
   • tailTime = 0                 • state → RELAXING (150–300 ms ease)
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
- [ ] Interruption: audio stop < 50 ms, face neutral < 300 ms, zero "trapped" chunks (test: interrupt 10× at random moments).
