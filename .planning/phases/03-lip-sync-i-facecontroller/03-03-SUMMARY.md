---
phase: 03-lip-sync-i-facecontroller
plan: 03
subsystem: viseme-scheduler
tags: [visemes, coarticulation, easing, exponential-damping, mouthClose-priority, foundation-rule]

requires:
  - phase: 03-02
    provides: Phonetic mapping table (mapCharToShapes)
provides:
  - VisemeScheduler class handling coarticulation and viseme lifecycle
  - Cosine easing (blend-in 35ms, hold, blend-out 45ms)
  - Additive blending with 1.0 limit
  - Exponential damping alpha = 1 - exp(-lambda * dt) (lambda = 22)
  - Foundation Rule enforcing convergence to 0 for unvoiced shapes
  - Priority mouthClose suppression of jawOpen (LIPS-02)
  - Refactored FaceController delegating scheduling to VisemeScheduler
affects: [03-04, 03-05, 04-01]

tech-stack:
  added: []
  patterns: [Cosine lifecycle easing, Exponential damping filter, Additive viseme blending]

key-files:
  created:
    - src/lipsync/viseme-scheduler.ts
    - tests/viseme-scheduler.test.ts
  modified:
    - src/lipsync/face-controller.ts

key-decisions:
  - "Exponential damping z lambda = 22 [1/s] eliminuje drgania i uzależnienie mimiki od liczby klatek na sekundę (LIPS-03)"
  - "Reguła fundamentu: zerowanie nieaktywnych kluczy gwarantuje brak efektu 'zamrożonej miny' po zakończeniu wypowiedzi"
  - "Gdy mouthClose > 0.3, jawOpen jest tłumione o 85%, dając realistyczny kontakt warg przy M/B/P"

patterns-established:
  - "VisemeScheduler jako czysty silnik matematyczny koartykulacji oddzielony od Three.js"

requirements-completed:
  - LIPS-01
  - LIPS-03

duration: 15min
completed: 2026-09-01
status: complete
---

# Phase 03: Plan 03 Summary

**Zaimplementowano VisemeScheduler z koartykulacją, cosine easingiem, exponential dampingiem i regułą fundamentu.**

## Accomplishments
- Stworzono klasę `VisemeScheduler` w `src/lipsync/viseme-scheduler.ts`.
- Zaimplementowano 3-fazowy cykl życia wizemu (blend-in, hold, blend-out) z cosine easingiem.
- Wdrożono exponential damping `1 - exp(-lambda * dt)` z lambdą 22 1/s.
- Zaimplementowano regułę fundamentu (wygaszanie do 0.0) oraz priorytet `mouthClose`.
- Pokryto moduł testami jednostkowymi (wszystkie 4 testy schedulera zielone).
