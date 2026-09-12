---
phase: 03-lip-sync-i-facecontroller
plan: 04
subsystem: procedural-blinking
tags: [procedural-animation, eye-blink, realism, anti-robotics, arkit]

requires:
  - phase: 03-03
    provides: VisemeScheduler and FaceController
provides:
  - ProceduralBlink generator (src/lipsync/procedural-blink.ts)
  - Natural interval timing (2.5s - 6.0s) with 15% double-blink chance
  - Asymmetric eyelid cycle (80ms closing / 200ms opening)
  - Full integration into FaceController and Three.js animation loop
  - Unit tests verifying blink curve and scheduling
affects: [03-05, 04-01, 05-01]

tech-stack:
  added: []
  patterns: [Procedural organic animation, Eyelid kinematics, Subconscious behavioral cues]

key-files:
  created:
    - src/lipsync/procedural-blink.ts
    - tests/procedural-blink.test.ts
  modified:
    - src/lipsync/face-controller.ts
    - src/main.ts

key-decisions:
  - "Asymetryczny cykl (80ms zamykanie, 200ms otwieranie) eliminuje mechaniczny wygląd mrugnięć"
  - "Mruganie pozostaje aktywne w stanach IDLE, SPEAKING i RELAXING (nie zamraża powiek podczas mowy)"
  - "Subtelna asymetria powiek (~2%) zwiększa organiczny realizm twarzy"

patterns-established:
  - "ProceduralBlink podpięty do FaceController.render() aplikuje wagi bezpośrednio do eyeBlinkLeft/Right"

requirements-completed:
  - LIPS-01
  - LIPS-03

duration: 10min
completed: 2026-09-01
status: complete
---

# Phase 03: Plan 04 Summary

**Zaimplementowano proceduralny generator mrugania powiekami (ProceduralBlink) zintegrowany z FaceController i pętlą Three.js.**

## Accomplishments
- Utworzono klasę `ProceduralBlink` w `src/lipsync/procedural-blink.ts`.
- Wdrożono biologiczny asymetryczny profil zamykania (80 ms) i otwierania (200 ms).
- Dodano losowy interwał (2.5–6.0 s) z obsługą podwójnych mrugnięć.
- Zintegrowano mruganie w `FaceController.render()` i pętli animacji `src/main.ts`.
- Pokryto moduł testami jednostkowymi (wszystkie 33 testy projektu zielone).
