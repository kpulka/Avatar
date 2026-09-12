---
phase: 11-ui-dual-persona-i-modularny-frontend-user-studio-scene-prese
plan: 02
subsystem: composition-root-controllers
tags: [refactor, composition-root, controllers, app-types, gsd]

requires:
  - phase: 11-01
    provides: SettingsStore, UiMode, TypedEventBus
provides:
  - AppEvents/AppServices (src/app/app-types.ts) — kontrakt zdarzeń i komend
  - Kontrolery domenowe: ConversationController, AnimationController, TelemetryController, SceneController (src/features/, bez DOM)
  - Composition root src/app/container.ts; main.ts zredukowany do 24 linii
  - speech-backend: getOutputSampleRate() + sampleRate w audio:chunk
affects:
  - src/main.ts
  - src/app/container.ts
  - src/app/app-types.ts
  - src/audio/speech-backend.ts
  - src/features/conversation-controller.ts
  - src/features/animation-controller.ts
  - src/features/telemetry-controller.ts
  - src/features/scene-controller.ts

tech-stack:
  added: []
  patterns: [Composition root (createApp/start), Controllers bez DOM, Zdarzenia na busie / komendy przez AppServices]

key-files:
  created:
    - src/app/container.ts
    - src/app/app-types.ts
    - src/features/conversation-controller.ts
    - src/features/animation-controller.ts
    - src/features/telemetry-controller.ts
    - src/features/scene-controller.ts
  modified:
    - src/main.ts
    - src/audio/speech-backend.ts

key-decisions:
  - "Kontrakt: STAN przez TypedEventBus (voice:state, transcript:*, audio:chunk, speech:interruption, a2f:stats, toast, compare:*, avatar:loaded); KOMENDY przez AppServices — brak duplikacji komend na busie"
  - "audio:chunk niesie pełny kontekst { bytes, alignment, epoch, startTime, sampleRate } — 11-05 używa tego do LastTurnBuffer/encodeWav bez zmian w backendzie"
  - "Refaktor czysty: przeniesienie callbacków z main.ts (676 linii, god-object) bez zmiany semantyki rozmowy; FaceController pozostaje jedynym pisarzem FaceDriver"
  - "main.ts = 24 linie (limit ~100): tylko WebGL check + createApp(canvas).start()"

patterns-established:
  - "Kontrolery w src/features/ bez document/getElementById (grep = 0 trafień); composition root jedyny montuje"

requirements-completed:
  - UI-04

duration: 120min
completed: 2026-09-10
status: complete
---

# Phase 11: Plan 02 Summary

**Wydzielono całą logikę z main.ts do kontrolerów src/features/*, spięto w src/app/container.ts; main.ts = 24 linie. Zero zmian zachowania — pełna regresja zielona.**

## Accomplishments
- Utworzono `app-types.ts` (AppEvents/AppServices) jako kontrakt między kontenerem, kontrolerami i (późniejszymi) komponentami UI.
- Utworzono `ConversationController` (start/stop/toggle/toggleMute/interrupt/say/setAgent) emitujący voice:state, transcript:*, audio:chunk, speech:interruption — 1:1 z dotychczasowymi callbackami, w tym embed bridge.
- Utworzono `AnimationController` (FaceController, demo A2F, kalibracja, preview, override) i `TelemetryController` (metryki TTFB/FPS/align/nodes) oraz `SceneController` — wszystkie bez DOM.
- Rozszerzono `speech-backend.ts` o `getOutputSampleRate()` i sampleRate w onAudioChunk (rzeczywisty rate sesji, nie hardcode).
- Utworzono `container.ts` (createApp/start): composition root tworzący services, kontrolery i pętlę render.
- Weryfikacja: brak `getElementById|document.` w `src/features/` (grep = 0); `npm test` + `npm run build` zielone.
- UAT manualny (smoke rozmowy po refaktorze): pending — wpis w 11-VERIFICATION.md.