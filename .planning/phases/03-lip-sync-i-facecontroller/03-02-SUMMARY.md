---
phase: 03-lip-sync-i-facecontroller
plan: 02
subsystem: viseme-mappings
tags: [lip-sync, visemes, arkit, digraphs, lookahead, phonetics]

requires:
  - phase: 03-01
    provides: FaceController state machine
provides:
  - Complete English phonetic-to-ARKit mapping table (src/lipsync/viseme-mappings.ts)
  - Lookahead support for digraphs (SH, CH, TH, PH, QU, WH, NG)
  - Contextual heuristic for letter C (soft vs hard)
  - Priority lip closure mouthClose: 1.0 for M, B, P (LIPS-02)
  - Unit tests verifying mapping rules and vowel/consonant shapes
affects: [03-03, 03-04, 05-02]

tech-stack:
  added: []
  patterns: [Lookahead tokenization, Rule-based phonetic heuristics, ARKit facial mapping]

key-files:
  created:
    - src/lipsync/viseme-mappings.ts
    - tests/viseme-mappings.test.ts
  modified: []

key-decisions:
  - "Dwuznaki sprawdzane przed pojedynczymi znakami zapewniają naturalne zaokrąglenie warg (np. SH, CH, QU)"
  - "Wymuszenie mouthClose: 1.0 na M/B/P jest kluczowym wskaźnikiem realistycznego lip-syncu (LIPS-02)"
  - "Heurystyka litery C różnicuje 'cell'/'city' (jak S) od 'cat'/'cup' (jak K)"

patterns-established:
  - "mapCharToShapes jako znormalizowana funkcja translacji znaków na Map<string, number>"

requirements-completed:
  - LIPS-01
  - LIPS-02

duration: 10min
completed: 2026-09-01
status: complete
---

# Phase 03: Plan 02 Summary

**Zaimplementowano pełną tabelę mapowań fonetycznych EN na wagi ARKit z lookahead dla dwuznaków, heurystyką C i pełnym domknięciem M/B/P.**

## Accomplishments
- Stworzono moduł `src/lipsync/viseme-mappings.ts` z obsługą samogłosek, spółgłosek i dwuznaków.
- Zaimplementowano regułę priorytetowego domknięcia warg `mouthClose: 1.0` dla M, B, P (LIPS-02).
- Zaimplementowano heurystykę kontekstową dla litery C.
- Pokryto moduł testami jednostkowymi (wszystkie 4 testy zielone).
