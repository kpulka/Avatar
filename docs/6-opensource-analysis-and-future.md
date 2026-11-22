# 6. Open-Source Ecosystem, Emotions, Multilingual Support, Development

## 📌 Open-source projects worth a look

Before we write anything from scratch, we check what others have already solved — **always verify the license before commercial use**:

| Project | Role | Value for us | Licensing note |
| :--- | :--- | :--- | :--- |
| **TalkingHead (met4citizen)** | Ready-made JS class: Three.js + GLB + ARKit/Oculus blendshapes | Reference for interpolation and language rules (EN/DE/FR...); a reference point for our viseme scheduler | check the repo's license before wiring in the code |
| **Rhubarb Lip Sync** | Audio → visemes analysis (WASM) | Acoustic fallback for languages where character mapping is not enough (Phase 2) | the license restricts commercial use — verify |
| **HeadAudio / MFCC worklets** | Phonemization of audio in an AudioWorklet | An alternative to Rhubarb; < 10 ms latency | research-grade, needs tuning |
| **@elevenlabs/client + @elevenlabs/react** | Official ElevenAgents SDK | Quick agent tests; `onAudioAlignment` | official, we use it in the PoC to validate the configuration |
| **Pipecat / LiveKit Agents** | Voice pipeline frameworks | A ready skeleton for Mode B (own brain, Phase 2) | permissive |
| **elevenlabs-avatar / Threlte templates** | EL + WebGL templates | References for integration and lip smoothing | mainly inspiration |

**Ready Player Me — closed** (project discontinued). All references to RPM in older notes are outdated; realistic alternatives: MetaPerson (our choice, [docs/1](1-architecture-and-3d-models.md)), HeyGen LiveAvatar (ElevenLabs' official guide — a video avatar with no 3D engine), MetaHuman + Pixel Streaming (Phase 2).

---

## 🎭 Agent-driven emotions — ElevenAgents mechanisms

Instead of inventing our own metadata channel, we use two native mechanisms:

### Variant 1: client tools (recommended for the MVP)

The agent calls a client-side tool (`client_tool_call`) when it "feels" an emotion. We register a tool such as `set_emotion` with the parameters `emotion` and `intensity` in the agent's configuration; in the prompt we instruct the agent to call it before utterances with a clear emotional charge:

```jsonc
// The client receives:
{ "type": "client_tool_call",
  "client_tool_call": { "tool_name": "set_emotion",
    "tool_call_id": "call_123",
    "parameters": { "emotion": "thoughtful", "intensity": 0.7 } } }

// FaceController: emotional baseline of the blendshapes, on which the speech visemes are layered:
//   thoughtful → browInnerUp 0.5 · eyeSquint* 0.2
//   happy      → mouthSmile* 0.4 · cheekSquint* 0.3
//   surprised  → browOuterUp* 0.6 · eyeWide* 0.4 · jawOpen floor +0.15
// We respond: { "type": "client_tool_result", "tool_call_id": "call_123", "result": "ok" }
```

### Variant 2: `agent_response_metadata` (custom LLM)

If the agent runs on its own LLM (a custom LLM endpoint), the response may carry metadata (the event has to be enabled in the agent's `client_events`):

```jsonc
{ "type": "agent_response_metadata",
  "agent_response_metadata_event": {
    "metadata": { "emotion": "thoughtful", "intensity": 0.7, "gesture": "nod_affirmative" } } }
```

**Rule for mixing with speech**: the emotion is the **base** (offset), the visemes are the **addition** (delta). `FinalWeight = clamp(emotionBase[key] + visemeWeight[key])`, with a separate, slower damping for emotions (lambda ~3–6) — emotions must not "jump" between sentences.

---

## 🌍 Multilingual support

The mapping table in [docs/3](3-lip-sync-and-coarticulation.md) is **dedicated to EN+PL** (digraphs `sz/cz/rz/ch`, nasal vowels `a-ogonek`/`e-ogonek` mapped like `a/e` + a light `mouthFunnel`). Staged strategy:

```
Phase 1 (MVP):    EN + PL — character mapping (alignment), zero CPU
Phase 2 (option): other phonetic languages — further dictionary modules (a table per language)
Phase 2 (option): "non-phonetic" languages — acoustic fallback (Rhubarb WASM / MFCC)
```

The ElevenAgents agent speaks 70+ languages (a multilingual voice); **lip-sync is not the bottleneck of multilingual support** — the bottleneck is the character table. Adding a language = a new mapping module + visual tests.

---

## 🧠 Phase 2: full aliveness (body language)

Elements that carry the avatar across the "uncanny valley" — in order of ROI:

1. **Blinking** (already in the PoC): `eyeBlink*` every 2.5–6 s, closing 80 ms, opening 200 ms; occasional double blinks; deliberately skipping blinks during `eyeWide` (surprise).
2. **Head micro-movements**: Perlin noise → `Neck/Head` bones, amplitude 1–2°, frequency 0.2–0.5 Hz; reduced amplitude during speech (avoid "bobbing").
3. **Eye saccades**: aiming `eyeLook*` at random points every 1–4 s + "shared attention" (look at the user when they speak; slightly aside when the agent is "thinking").
4. **Body idle**: Mixamo animations (breathing, sway) via an `AnimationMixer` with a 0.3 s crossfade — the rig is already compatible ([docs/1](1-architecture-and-3d-models.md)).
5. **Accent gestures**: basic "beat gestures" synchronized with the punctuation of the alignment (a period = an accent gesture).

---

## 🗺️ Architecture development paths (summary)

| Direction | What changes | Cost/risk |
| :--- | :--- | :--- |
| Own brain (Mode B, [docs/2](2-elevenlabs-wss-integration.md)) | `SpeechBackend`: ElevenAgents → TTS WSS + own LLM + VAD | high (turn-taking!), gain: full control |
| Premium renderer (MetaHuman/Pixel Streaming) | `FaceDriver` → a driver on the Unreal side | high (GPU per stream), gain: photorealism |
| Video avatar (HeyGen LiveAvatar) | `AvatarLoader` → video stream; lip-sync unnecessary | medium (cost/min), gain: realism without a 3D engine |
| Acoustic lip-sync | viseme scheduler: alignment source → visemes source | low, gain: any language |

Thanks to the interfaces from [docs/1](1-architecture-and-3d-models.md), none of these directions forces a rewrite of the core.
