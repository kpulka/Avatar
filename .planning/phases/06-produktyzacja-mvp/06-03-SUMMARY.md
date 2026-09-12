---
phase: 06-produktyzacja-mvp
plan: 03
subsystem: telemetry-and-graceful-degradation
tags: [telemetry, ttfb, jitter, adaptive-prebuffer, graceful-degradation, webgl-fallback, prod]

requires:
  - phase: 06-02
    provides: SettingsModal and UI configuration
provides:
  - TelemetryManager (src/prod/telemetry.ts) tracking FPS, TTFB, barge-ins, session time
  - Adaptive prebuffer in AudioEngine (up to 0.20s on network jitter) (ROB-02)
  - 2D audio mode graceful degradation on WebGL failure (src/ui/webgl-fallback.ts)
  - Live HUD telemetry indicators for TTFB, barge-ins, and session time
  - Unit tests verifying telemetry timing and adaptive prebuffering
affects: [06-04]

tech-stack:
  added: []
  patterns: [Real-time latency profiling, Adaptive jitter buffering, Graceful audio-first fallback]

key-files:
  created:
    - src/prod/telemetry.ts
    - tests/telemetry.test.ts
  modified:
    - src/audio/audio-engine.ts
    - src/ui/hud.ts
    - src/main.ts
    - index.html
    - src/ui/webgl-fallback.ts

key-decisions:
  - "Adaptacyjny prebuffer automatycznie wydłuża okno absorpcji jittera (80ms -> 180ms), zapobiegając przerwom w mowie"
  - "Brak WebGL nie blokuje rozmowy — awatar przechodzi w tryb Audio 2D z pełną transkrypcją i nasłuchem"

patterns-established:
  - "Pomiar TTFB od momentu wysłania intencji mowy do pierwszego bajtu PCM"

requirements-completed:
  - ROB-02

duration: 12min
completed: 2026-09-01
status: complete
---

# Phase 06: Plan 03 Summary

**Zaimplementowano zaawansowany silnik telemetrii (TelemetryManager), adaptacyjny prebuffer w AudioEngine oraz graceful degradation do widoku Audio 2D.**

## Accomplishments
- Utworzono moduł `TelemetryManager` mierzący TTFB, liczbę przerwanych wypowiedzi i czas sesji.
- Zaimplementowano w `AudioEngine` adaptacyjny prebuffer reagujący na niestabilność sieci (ROB-02).
- Zintegrowano wskaźniki telemetrii w nagłówku HUD (`index.html`, `hud.ts`, `main.ts`).
- Wdrożono tryb awaryjny Audio 2D w `src/ui/webgl-fallback.ts`.
- Pokryto moduł testami w `tests/telemetry.test.ts` (wszystkie 3 testy zielone).
