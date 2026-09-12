---
phase: 04-barge-in-i-szlif-poc
plan: 02
subsystem: race-condition-protection
tags: [race-condition, epoch, network-jitter, audio-engine, face-controller]

requires:
  - phase: 04-01
    provides: Barge-in interruption pipeline
provides:
  - Strict epoch-based packet and viseme filtering in AudioEngine and FaceController
  - Verification test in tests/race-condition-epoch.test.ts
  - Immunity to network jitter and late-arriving packets after barge-in (INT-01)
affects: [04-03, 04-04]

tech-stack:
  added: []
  patterns: [Epoch invalidation, Stale message rejection, Network jitter shielding]

key-files:
  created:
    - tests/race-condition-epoch.test.ts
  modified:
    - src/audio/audio-engine.ts
    - src/lipsync/face-controller.ts

key-decisions:
  - "Stale audio chunks ze starym epoch są cicho odrzucane z kodem powrotu 0"
  - "FaceController natychmiast ignoruje wizemy jeśli przekazany epoch !== activeEpoch"

patterns-established:
  - "Filtrowanie po znaczniku epoki jako standard ochrony przed wyścigami w aplikacjach czasu rzeczywistego"

requirements-completed:
  - INT-01

duration: 10min
completed: 2026-09-01
status: complete
---

# Phase 04: Plan 02 Summary

**Wdrożono i zweryfikowano filtrację epok (epoch) zabezpieczającą silnik audio i mimiki przed wyścigami pakietów i opóźnionymi danymi po przerwaniu.**

## Accomplishments
- Potwierdzono odrzucanie opóźnionych chunków audio ze starym numerem epoki w `AudioEngine.playChunk`.
- Potwierdzono odrzucanie opóźnionych wizemów w `FaceController.onAudioChunk`.
- Przetestowano i potwierdzono bezbłędne wznowienie nowej wypowiedzi z kolejną epoką.
- Napisano test jednostkowy w `tests/race-condition-epoch.test.ts`.
