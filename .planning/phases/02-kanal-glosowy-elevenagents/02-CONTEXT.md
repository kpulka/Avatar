---
phase: "02"
name: "Kanał głosowy ElevenAgents"
created: 2026-09-01
---

# Phase 2: Kanał głosowy ElevenAgents — Context

## Decisions

- **Tryb A (ElevenAgents)**: Cała pętla konwersacyjna (ASR, LLM, TTS, turn-taking, detekcja barge-in) realizowana po stronie ElevenLabs.
- **Surowy WSS (`/v1/convai/conversation`)**: Używamy surowego WebSocketu zamiast SDK do głównego potoku audio/lip-sync, aby audio i znaczniki alignmentu były planowane na tej samej osi czasu (`AudioContext.currentTime`). SDK `@elevenlabs/client` służy do weryfikacji konfiguracji i dymnego testu agenta.
- **Formaty audio**:
  - Mikrofon (klient -> serwer): PCM 16 kHz mono, Int16, base64 w paczkach `{ user_audio_chunk: string }`.
  - Odtwarzanie (serwer -> klient): PCM 44.1 kHz mono, Float32 przez `AudioBuffer` (`createBuffer` + `copyToChannel`). Format czytany dynamicznie z `conversation_initiation_metadata`.
- **Prebuffering & Gapless**: Buforowanie 2-3 chunków (~100-200 ms) przed rozpoczęciem odtwarzania pierwszego chunka dla absorpcji jittera sieci. Kolejne chunki planowane na `ctx.currentTime`.
- **AudioWorklet**: Dedykowany procesor audio w wątku roboczym zapewniający bezstratne próbkowanie i downsampling do 16 kHz bez blokowania pętli głównej UI.
- **Ping-Pong & Reconnect**: Automatyczna odpowiedź `{ type: "pong", event_id }` oraz mechanizm reconnectu z wykładniczym backoffem przy utracie połączenia.
- **Tryb Demo / Offline Mock**: Wbudowany symulator mowy i eventów WSS na potrzeby testów bez podłączonego klucza API lub gdy użytkownik testuje aplikację offline.
