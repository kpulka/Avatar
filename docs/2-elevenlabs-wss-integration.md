# 2. ElevenLabs integration: ElevenAgents (Mode A) and TTS WebSocket (Mode B)

ElevenLabs offers two ways to power the avatar's speech. Both deliver the **character alignment** needed for lip-sync.

| | Mode A — ElevenAgents | Mode B — own pipeline (TTS WSS) |
| :--- | :--- | :--- |
| What the server does | STT + LLM + TTS + turn-taking + **barge-in detection** + VAD | TTS only (text → audio + alignment) |
| What we write | rendering, audio playback, lip-sync, UI | everything from Mode A **plus** STT, VAD, LLM, interruption logic |
| When | **PoC and MVP** | Phase 2 (full control: own LLM, tools, costs) |

---

## 🅰️ Mode A — ElevenAgents

### What the agent does for us

The agent is a complete conversation loop on the ElevenLabs side: it recognizes the user's speech (ASR), generates a response (the LLM from the configuration), synthesizes the voice (TTS), decides when to speak (**turn-taking**), and **itself detects when the user talks over it** — it stops the generation and sends an `interruption` event. The client implements no AI at all.

### Configuration (dashboard / CLI)

In the ElevenLabs dashboard (Agents section) we configure:
* **System prompt** (personality, style, language),
* **Voice** (5k+ voices; for Polish — a multilingual voice),
* **LLM model** (built-in models or a custom LLM endpoint),
* **Advanced → client_events**: enable the events used by the client (including `agent_response_metadata` if we want emotions — [docs/6](6-opensource-analysis-and-future.md)).

In the MVP: agent configuration as code (ElevenLabs CLI), versioned in the repo — the prompt changes through a PR, not by clicking.

### Endpoint and authorization

```
wss://api.elevenlabs.io/v1/convai/conversation?agent_id={agent_id}
```

* **Public agent (PoC)**: an `agent_id` in the URL is enough — zero secrets in the browser.
* **Private agent (MVP)**: the client fetches a signed URL from **our backend**:
  ```
  GET https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id={agent_id}
  Header: xi-api-key: <key — server only>
  → { "signed_url": "wss://...&token=..." }
  ```
  The API key **never** reaches the browser. The backend can add its own user authorization in the same place.

### SDK vs raw WSS — an important decision

| | SDK (`@elevenlabs/client`) | Raw WebSocket |
| :--- | :--- | :--- |
| Mic, ping/pong, reconnect | free | we write it (~50 lines) |
| Audio playback | **the SDK plays it itself** (WebRTC by default) | **we schedule it** on `AudioContext.currentTime` |
| Lip-sync | `onAudioAlignment` callback (wall clock — drift possible) | alignment + audio from the **same event** on one time axis — **ideal synchronization** |

**Decision for the avatar: raw WSS.** Lip-sync with the sound is a core feature — audio and visemes must share one time axis. We use the SDK for testing the agent and as a reference point.

### Protocol — client → server

```jsonc
// 1. Start the conversation (any moment after the WSS opens)
{ "type": "conversation_initiation_client_data",
  "custom_config": { /* e.g. dynamic_variables from the user's context */ },
  "contextual_update": { "text": "User opened the avatar demo page" } }

// 2. Continuous microphone streams (base64 PCM 16 kHz mono)
{ "user_audio_chunk": "<base64>" }

// 3. Reply to a ping (keeps the connection alive)
{ "type": "pong", "event_id": 123 }

// 4. Context without interrupting the agent (optional)
{ "type": "contextual_update", "text": "User switched to pricing tab" }

// 5. Client tool result (see docs/6 — emotions)
{ "type": "client_tool_result", "tool_call_id": "...", "result": "ok", "is_error": false }
```

### Protocol — server → client (events we care about)

| Event | Payload | How we use it |
| :--- | :--- | :--- |
| `conversation_initiation_metadata` | including `agent_output_audio_format: "pcm_44100"`, `user_input_audio_format: "pcm_16000"` | we set the audio formats at startup (do not hardcode!) |
| `audio` | `audio_base_64` (PCM 44.1 kHz) + **`alignment`**: `chars[]`, `char_start_times_ms[]`, `char_durations_ms[]` | **core**: playback + viseme scheduler |
| `interruption` | `reason` | stop audio, face relaxation, cancel the queue ([docs/4](4-audio-and-barge-in.md)) |
| `agent_response_correction` | shortened text after an interruption | update the transcript in the UI |
| `user_transcript` / `agent_response` | transcripts | UI/subtitles, TTFB telemetry |
| `vad_score` | 0–1 | "user is speaking" indicator in the UI |
| `client_tool_call` | `tool_name`, `parameters` | emotions/procedures ([docs/6](6-opensource-analysis-and-future.md)) |
| `ping` | `ping_ms` | reply with `pong` (keeps the WSS alive) |

```jsonc
// Example audio event (abridged)
{ "type": "audio",
  "audio_event": {
    "audio_base_64": "SUQz//...",
    "event_id": 12345,
    "alignment": {
      "chars": ["H", "e", "l", "l", "o"],
      "char_start_times_ms": [0, 50, 80, 120, 160],
      "char_durations_ms": [50, 30, 40, 40, 60]
    } } }
```

**Note:** the alignment refers to the **normalized text** (numbers → words, abbreviations expanded). `chars` may not match the agent's prompt 1:1 — we map only on the characters from the alignment, never on the original text.

### Client: minimal handling skeleton

```javascript
const ws = new WebSocket(signedUrl); // or ?agent_id=... for a public agent
let epoch = 0; // invalidates scheduled audio/visemes after an interruption — see docs/4

ws.onopen = () => ws.send(JSON.stringify({ type: 'conversation_initiation_client_data' }));
// + start the AudioWorklet: mic → 16 kHz → base64 → { user_audio_chunk }

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  switch (msg.type) {
    case 'audio':
      const { audio_base_64, alignment } = msg.audio_event;
      audioEngine.playChunk(base64ToPcm(audio_base_64), epoch);   // docs/4
      faceController.schedule(alignment, audioEngine.chunkStart(epoch), epoch); // docs/3+4
      break;
    case 'interruption':
      epoch++; audioEngine.hardStop(); faceController.beginRelax(); // docs/4
      break;
    case 'ping':
      setTimeout(() => ws.send(JSON.stringify({ type: 'pong', event_id: msg.ping_event.event_id })),
                 msg.ping_event.ping_ms ?? 0);
      break;
    // user_transcript, agent_response, vad_score → UI
  }
};
```

---

## 🅱️ Mode B — TTS WebSocket `stream-input` (Phase 2)

Endpoint for standalone real-time TTS (e.g. when the brain is our own LLM):

```
wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input?model_id=eleven_flash_v2_5
```

* **Model**: `eleven_flash_v2_5` (recommended for low TTFB) or `eleven_multilingual_v2` (quality). **Note:** this endpoint **does not support `eleven_v3`** — for v3 there is a separate Text-to-Dialogue WSS.
* **Auth**: `xi-api-key` in the header or in the first message (BOS). In the browser = exposing the key → **only through our own proxy** in production.

### Messages

```jsonc
// BOS — generation parameters
{ "text": " ",
  "voice_settings": { "stability": 0.5, "similarity_boost": 0.8 },
  "generation_config": { "chunk_length_schedule": [120, 160, 250, 290] } }

// Text fragments (e.g. streaming from an LLM)
{ "text": "Hello world, how can I help you today? " }
{ "text": "Last sentence.", "flush": true }   // flush=true forces generation of the rest of the buffer

// EOS — close the stream
{ "text": "" }
```

* `chunk_length_schedule`: number of characters buffered before the next batch is generated. Small first values = faster TTFB, larger later ones = better prosody. The default `[120,160,250,290]` makes sense; at the end of a turn **always `flush: true`**.
* **Keep-alive**: 20 s of inactivity closes the connection; sending `" "` (a single space) keeps it open. `""` closes it.
* **Response**: JSON messages with `audio` (base64; mp3 by default — for gapless set `output_format=pcm_44100` in the URL), `isFinal` and `normalizedAlignment` (`char_start_times_ms`, `chars_durations_ms`, `chars`) — the same data shape as in Mode A, so the viseme scheduler is shared.

### Mode B also means (outside the scope of this document)

Our own: microphone capture and resampling, STT (e.g. ElevenLabs Scribe realtime), VAD (e.g. Silero WASM), an LLM with tool calling, interruption detection and handling. Helper frameworks: **Speech Engine (ElevenLabs)**, Multi-Context WSS, Pipecat, LiveKit Agents. This is a deliberate reserve for Phase 2 — Mode A delivers all of these elements ready-made.

---

## 🔗 Client-side pipelines (shared by both modes)

```
        WSS message (audio + alignment)
                     │
       ┌─────────────┴─────────────┐
       ▼                           ▼
[ PCM → AudioBuffer ]     [ alignment → Viseme Scheduler ]
 AudioEngine               (char → ARKit mapping, docs/3)
 (queue on ctx.time)                │
       │                              ▼
       └──────────► FaceController ◄───────┘
              (sole owner of morph targets, docs/4)
```

Both pipelines **must** schedule on the same time axis (`AudioContext.currentTime`) and honor the same `epoch` — otherwise interruptions will desynchronize the sound and the facial expression (details and pitfalls: [docs/4](4-audio-and-barge-in.md)).
