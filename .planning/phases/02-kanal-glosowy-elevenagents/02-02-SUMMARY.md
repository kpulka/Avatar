---
phase: 02-kanal-glosowy-elevenagents
plan: 02
subsystem: speech-backend
tags: [websocket, raw-wss, elevenagents, ping-pong, reconnect, backoff]

requires:
  - phase: 02-01
    provides: Agent configuration and formats
provides:
  - Full TypeScript types for S2C and C2S protocols in src/types/audio.ts
  - RawWssClient handling WebSocket connection to /v1/convai/conversation
  - Automatic pong responses to ping events
  - Reconnection resilience with exponential backoff (1s -> 16s)
  - Unit tests verifying handshake, message parsing, and audio chunk sending
affects: [02-03, 02-04, 03-01]

tech-stack:
  added: []
  patterns: [Direct WebSocket protocol handler, Exponential backoff reconnection, Event subscription pattern]

key-files:
  created:
    - src/types/audio.ts
    - src/audio/raw-wss-client.ts
    - tests/raw-wss-client.test.ts
  modified: []

key-decisions:
  - "Surowy WSS pozwala na bezpośredni dostęp do event_id, alignmentu i chunków PCM z jednego strumienia"
  - "Ping-pong z automatycznym pong zapobiega zrywaniu socketu przez serwer i proxy"
  - "Wykładniczy backoff zapewnia odporność na chwilowe fluktuacje sieci (ROB-01)"

patterns-established:
  - "RawWssClient izoluje komunikację sieciową od silnika audio i sterownika twarzy"
  - "Wszystkie komunikaty są ściśle typowane przez dyskryminowaną unię w src/types/audio.ts"

requirements-completed:
  - CONV-01
  - ROB-01

duration: 12min
completed: 2026-09-01
status: complete
---

# Phase 02: Plan 02 Summary

**Zaimplementowano surowego klienta WebSocket ElevenAgents z handshake, parsowaniem zdarzeń S2C, automatycznym ping-pong i odpornością na rozłączenia.**

## Accomplishments
- Zdefiniowano ścisłe typy protokołu WebSocket w `src/types/audio.ts`.
- Zaimplementowano `RawWssClient` w `src/audio/raw-wss-client.ts` z obsługą handshake `conversation_initiation_client_data`.
- Obsłużono automatyczną odpowiedź `pong` na zdarzenia `ping` z serwera.
- Zaimplementowano pętlę automatycznego ponawiania połączenia z wykładniczym backoffem.
- Pokryto moduł testami jednostkowymi w `tests/raw-wss-client.test.ts` (wszystkie 5 testów zielonych).
