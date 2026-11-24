# 0. Roadmap: PoC → MVP → Phase 2

> **Status (checked 2026-11-24):** the PoC (ROADMAP phases 1–4) and the MVP (phases 5–6) are marked complete in `.planning/ROADMAP.md` (2026-09-01). Their acceptance runs are recorded in `.planning/phases/04-barge-in-i-szlif-poc/04-VERIFICATION.md` and `.planning/phases/06-produktyzacja-mvp/06-VERIFICATION.md`, both with `status: passed`. The checkboxes in the sections below are the original targets; they were not ticked in place. The current milestone is v1.1 (phases 12–18, plus the inserted 11.1 and 11.2; see ROADMAP). "Stage 2" below lists directions, not commitments.

Guiding principle: **thin vertical slice** — each stage ends with a working, demonstrable product, not a collection of modules. Documents 1–6 are the technical reference; this file is the execution plan.

---

## 🎯 Stage 0 — PoC (goal: 3–5 working days)

**Business goal:** "I speak to the browser, a realistic character answers with a voice, the lips are in sync, and I can interrupt it mid-sentence."

**Scope IN:**
1. ElevenAgents agent configured in the dashboard (prompt, voice, LLM model, language EN).
2. Web client (Vite + TypeScript + Three.js), connected via a **raw WebSocket** `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=...` (why not the SDK — see [docs/2, section "SDK vs raw WSS"](2-elevenlabs-wss-integration.md)).
3. MetaPerson `.glb` model (bust/head — not a full body) with ARKit blendshapes.
4. Lip-sync from `audio_event.alignment` (EN mapping from [docs/3](3-lip-sync-and-coarticulation.md)).
5. PCM playback via Web Audio + viseme scheduling on the same time axis.
6. Handling of `interruption` events → stop audio + face relaxation (`FaceController` from [docs/4](4-audio-and-barge-in.md)).
7. Procedural blinking (idle) — the cheapest way to bring the character to life.

**Scope OUT (deliberately):** emotions, Polish language, full body/gestures, custom SSS (stock PBR is enough), product UI, authentication (public agent), automated tests.

**Steps:**
| Day | Task | Definition of Done |
| :--- | :--- | :--- |
| 1 | Agent in the dashboard + empty 3D client (scene, light, camera) + GLB loading | The avatar renders statically; `Conversation` answers by voice for a short test prompt (SDK used to test the agent). |
| 2 | Raw WSS: mic capture (AudioWorklet → PCM 16 kHz → base64), `audio` events → PCM playback | Smooth voice conversation (no lips yet) — gapless, no crackles. |
| 3 | `FaceController` + viseme scheduler from the alignment | Lips visually match the speech (control test: M/B/P closes the lips). |
| 4 | `interruption` → stop audio + face relaxation; WSS reconnect/error handling | Interrupting at any moment does not leave a "frozen" expression. |
| 5 | Buffering, latency tuning, metrics measurement | The acceptance criteria below are met. |

**PoC acceptance criteria (measurable):**
- [ ] Audio response starts < 1.5 s after the end of the user's utterance (measured: `user_transcript` → first `audio`).
- [ ] Lip-sync: no visible mouth/sound drift in a 30 s utterance (visual check + log of time differences).
- [ ] Barge-in: audio stops < 50 ms after the `interruption` event; face in neutral state < 300 ms.
- [ ] 60 FPS @ 1080p on a GTX 1060 / Apple M1-class GPU; model < 25 MB; first render < 5 s on a 20 Mbps connection.
- [ ] 10-minute conversation without a memory leak (audio nodes cleaned up in `onended`).

---

## 🚀 Stage 1 — MVP (goal: 2–4 weeks)

**Business goal:** a product that can be shown to a client/stakeholders with branded UI and the Polish language.

Scope (each point has its own chapter in the docs):
1. **Agent "as code"** — configuration via the ElevenLabs CLI (prompt versioning in the repo), private agent, **signed URL from the backend** instead of a public `agent_id` ([docs/2](2-elevenlabs-wss-integration.md)).
2. **Polish lip-sync** — EN+PL table with digraphs (`sz`, `cz`, `rz`, `ch`, and the nasal vowels `a-ogonek`, `e-ogonek`...) ([docs/3](3-lip-sync-and-coarticulation.md)).
3. **Skin realism** — pre-integrated SSS via `onBeforeCompile` + studio lighting + ACES tone mapping ([docs/5](5-shaders-and-realism.md)).
4. **Aliveness** — procedural head micro-movements, eye saccades, idle sway; body-speech texture from [docs/6](6-opensource-analysis-and-future.md).
5. **Emotions** — the agent calls the client tool `set_emotion` → `FaceController` sets the blendshape emotion bases ([docs/6](6-opensource-analysis-and-future.md)).
6. **UI/UX** — mute, audio input/output selection, status indicator (`listening/speaking`), transcription.
7. **Robustness** — reconnect with backoff, telemetry (TTFB, drift, FPS), handling of missing WebGL/microphone.

**MVP acceptance criteria:**
- [ ] Full Polish flow: question → answer with correct digraph lip-sync.
- [ ] Barge-in works at each of 10 random interruption moments (0 face freezes).
- [ ] Private avatar (signed URL); API key not visible in the browser's network traffic.
- [ ] SSS visible on ears/nose/lips in a before/after comparison (reference screenshots).
- [ ] Lighthouse/metrics: cold load < 5 s, no stutter > 5 ms/frame during speech.

---

## 🔭 Stage 2 — Development (directions, not commitments)

- **Own brain (mode B)**: Speech Engine / Multi-Context WSS + own LLM (full control over prompts, tools, costs) — see [docs/2](2-elevenlabs-wss-integration.md).
- **Body speech**: Mixamo skeleton, gesturing, `AnimationMixer` animation crossfade.
- **Acoustic lip-sync** (Rhubarb WASM) as a fallback for languages without phonetic spelling.
- **Alternative renderer**: MetaHuman via Unreal Pixel Streaming (maximum realism, GPU cost per stream) — decision matrix in [docs/1](1-architecture-and-3d-models.md).

---

## ⚠️ Risk register

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| Lip-sync drift when playing through the SDK (WebRTC) | high | medium | The PoC uses raw WSS: audio + alignment on one `AudioContext` time axis ([docs/2](2-elevenlabs-wss-integration.md), [docs/4](4-audio-and-barge-in.md)). |
| Browser autoplay policy (AudioContext blocked) | certain | PoC blocker | Start the conversation only after a user gesture (click "Talk"); `ctx.resume()` in the handler. |
| Blendshape names other than ARKit camelCase in the export | medium | high | Validation on load: missing keys → list of errors in the console + name normalization (`jaw_open` → `jawOpen`) ([docs/1](1-architecture-and-3d-models.md)). |
| Gaps/crackles between audio chunks | medium | medium | PCM format (not mp3) — `createBuffer` + `copyToChannel`, no decoder cost; start buffer of 2–3 chunks ([docs/4](4-audio-and-barge-in.md)). |
| MetaPerson licenses (commercial cost) | medium | high | Check the Avatar SDK price list before the product phase; alternatives in [docs/1](1-architecture-and-3d-models.md). |
| ElevenLabs agent costs (conversation minutes, bursts) | low | medium | Budget in the dashboard; shared-layer/flash TTS agent; usage monitoring. |
| Data retention (conversation recordings) — GDPR | medium | high | Agent privacy/retention configuration; Zero Retention mode if required ([docs/6](6-opensource-analysis-and-future.md)). |
| SSS performance on weak GPUs | medium | medium | Quality presets (PoC: no SSS; GPU auto-detection in the MVP). |

---

## 🧭 Engineering principles

1. **Interfaces before implementations** — `SpeechBackend`, `FaceDriver`, `AvatarLoader` ([docs/1](1-architecture-and-3d-models.md)): the only way to keep technological flexibility.
2. **One owner of morph targets** (`FaceController`) — no writing to `morphTargetInfluences` from other modules.
3. **One time axis** — audio and visemes are scheduled exclusively on `AudioContext.currentTime`.
4. **Fail fast on load** — a model/agent without the required keys/parameters = a clear error, not silent degradation.
5. **Every phase ends with a demo** — if it cannot be shown, it is not ready.
