---
phase: 05-realizm-i-ozywienie
plan: 01
subsystem: head-micro-movements
tags: [micro-movements, breathing, harmonic-noise, organic-motion, realism]

requires:
  - phase: 04-04
    provides: Phase 4 barge-in and verified PoC foundation
provides:
  - HeadMicroMovements class (src/realism/head-micro-movements.ts)
  - Multi-harmonic noise for head yaw/pitch (< 2°) and roll (< 1°)
  - Biological breathing cycle (0.25 Hz, ~4s, 2.5mm vertical rise, subtle pitch)
  - Integration with Three.js avatar container
  - Unit tests verifying anatomical bounds and frequency
affects: [05-02, 05-03, 05-04]

tech-stack:
  added: []
  patterns: [Harmonic noise synthesis, Physiological breathing oscillator, Relative coordinate integration]

key-files:
  created:
    - src/realism/head-micro-movements.ts
    - tests/head-micro-movements.test.ts
  modified:
    - src/main.ts

key-decisions:
  - "Niewspółmierne częstotliwości harmoniczne zapobiegają odczuciu powtarzalności pętli ruchu"
  - "Amplituda yaw/pitch ściśle ograniczona do < 2° (REAL-01), aby nie odciągać uwagi od mowy"

patterns-established:
  - "Modyfikacja transformacji kontenera Three.js w pętli renderującej ze skalowaniem czasu dt"

requirements-completed:
  - REAL-01

duration: 10min
completed: 2026-09-01
status: complete
---

# Phase 05: Plan 01 Summary

**Zaimplementowano generator mikroruchów głowy i cyklu oddechowego (HeadMicroMovements) zintegrowany z kontenerem awatara Three.js.**

## Accomplishments
- Stworzono klasę `HeadMicroMovements` w `src/realism/head-micro-movements.ts`.
- Wdrożono szum harmoniczny dla rotacji yaw/pitch (< 2°) i roll (< 1°).
- Zaimplementowano asymetryczny oscylator oddechu (0.25 Hz, ~4s okres).
- Zintegrowano moduł w pętli animacji `src/main.ts`.
- Pokryto testami jednostkowymi w `tests/head-micro-movements.test.ts` (wszystkie 3 testy zielone).
