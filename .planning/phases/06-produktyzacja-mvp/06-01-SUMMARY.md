---
phase: 06-produktyzacja-mvp
plan: 01
subsystem: embed-bridge-and-cache
tags: [embed, iframe, postmessage, indexeddb, model-cache, prod]

requires:
  - phase: 05-04
    provides: Phase 5 realism and verified visual pipeline
provides:
  - EmbedBridge postMessage communications module (src/prod/embed-bridge.ts)
  - URL query parser for agent_id, theme, autostart
  - ModelCache with IndexedDB storage and in-memory fallback (src/avatar/model-cache.ts)
  - Bi-directional event integration with ElevenAgentsSpeechBackend
  - Unit tests for cache persistence and postMessage contracts
affects: [06-02, 06-03, 06-04]

tech-stack:
  added: []
  patterns: [Cross-frame postMessage RPC bridge, Client-side binary caching via IndexedDB, URL configuration parsing]

key-files:
  created:
    - src/prod/embed-bridge.ts
    - src/avatar/model-cache.ts
    - tests/embed-bridge.test.ts
    - tests/model-cache.test.ts
  modified:
    - src/main.ts
    - src/audio/speech-backend.ts

key-decisions:
  - "Obsługa protokołu postMessage umożliwia osadzenie awatara w iframe na dowolnej domenie bez naruszania CORS"
  - "Cache'owanie binarne modeli w IndexedDB redukuje czas ponownego załadowania awatara do zera"

patterns-established:
  - "Zdarzenia nadrzędne C2A (connect, interrupt, say, set_agent) oraz zdarzenia potomne A2C (ready, state_change, transcript)"

requirements-completed:
  - PROD-01

duration: 12min
completed: 2026-09-01
status: complete
---

# Phase 06: Plan 01 Summary

**Zaimplementowano mostek komunikacji iframe/postMessage (EmbedBridge) oraz cache modeli GLB w IndexedDB (ModelCache).**

## Accomplishments
- Utworzono moduł `EmbedBridge` z obsługą protokołu `postMessage` i parsowaniem parametrów URL.
- Zaimplementowano moduł `ModelCache` przechowujący pliki modeli w `IndexedDB` z fallbackiem w pamięci RAM.
- Zintegrowano mostek z pętlą główną `src/main.ts` i `ElevenAgentsSpeechBackend`.
- Pokryto moduły testami w `tests/embed-bridge.test.ts` oraz `tests/model-cache.test.ts`.
