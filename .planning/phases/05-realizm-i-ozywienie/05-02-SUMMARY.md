---
phase: 05-realizm-i-ozywienie
plan: 02
subsystem: gaze-and-saccades
tags: [eye-gaze, saccades, pointer-tracking, arkit, realism]

requires:
  - phase: 05-01
    provides: HeadMicroMovements
provides:
  - GazeSaccades controller (src/realism/gaze-saccades.ts)
  - Pointer/mouse gaze tracking with 15° clamp and exponential damping
  - Random micro-saccades (0.5 - 2.0s, < 5°, 35-50ms)
  - Conjugate eye shape mapping (eyeLookIn/Out/Up/Down)
  - Integration with pointer events and animation loop in src/main.ts
affects: [05-03, 05-04]

tech-stack:
  added: []
  patterns: [Pointer event normalization, Ocular saccade kinematics, Conjugate gaze mapping]

key-files:
  created:
    - src/realism/gaze-saccades.ts
    - tests/gaze-saccades.test.ts
  modified:
    - src/main.ts

key-decisions:
  - "Clampowanie kąta spojrzenia do 15° (REAL-02) zapobiega nienaturalnemu zezowaniu lub przewracaniu oczami"
  - "Mikrosakady (35-50ms) symulują biologiczne fiksacje fovealne i ożywiają spojrzenie awatara"

patterns-established:
  - "applyToDriver nakłada wagi blendshape'ów oczu bezpośrednio do FaceDriver"

requirements-completed:
  - REAL-02

duration: 10min
completed: 2026-09-01
status: complete
---

# Phase 05: Plan 02 Summary

**Zaimplementowano kontroler spojrzenia i mikrosakad oczu (GazeSaccades) zintegrowany ze wskaźnikiem myszy i pętlą Three.js.**

## Accomplishments
- Stworzono klasę `GazeSaccades` w `src/realism/gaze-saccades.ts`.
- Wdrożono śledzenie kursora z ograniczeniem do 15° i dampingiem.
- Zaimplementowano generator mikrosakad oka (0.5–2.0 s, czas 35–50 ms, kąt < 5°).
- Zmapowano kierunki spojrzenia na wagi ARKit (`eyeLookIn/Out/Up/Down` dla obu oczu).
- Pokryto moduł testami jednostkowymi w `tests/gaze-saccades.test.ts` (wszystkie 3 testy zielone).
