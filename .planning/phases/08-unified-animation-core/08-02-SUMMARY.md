---
phase: 08-unified-animation-core
plan: 02
subsystem: unified-animation-core
tags: [a2f, parser, arkit-52, frames-clip, gsd]

requires:
  - phase: 08-01
    provides: Kontrakt PoseFrame/FramesClip konsumowany przez FaceController.feedFrames
provides:
  - Czysty, funkcyjny parser JSON wrappera A2F → FramesClip (tests/a2f-parser.test.ts)
  - Dekapitalizer ARKit PascalCase→camelCase (52 kształty) z normalizeShapeName jako drugą linią
  - unknownShapes (deduplikowane) do telemetrii; czytelne błędy dla malformed JSON / braku frames
affects:
  - src/lipsync/a2f-parser.ts

tech-stack:
  added: []
  patterns: [Właścicielem formatu JSON jest WRAPPER A2F (docs/7 §5), ramki relatywne (timeSec = frame_time), porządkowanie po timeSec zamiast zakładania stałego fps]

key-files:
  created:
    - src/lipsync/a2f-parser.ts
    - tests/a2f-parser.test.ts

key-decisions:
  - "timeSec = frame_time — RELATYWNY, bez żadnego audioStart w parserze (celowe odwrócenie błędu z v1 kontraktu; baza dodawana w kliencie 08-01)"
  - "Parser ma WŁASNY dekapitalizer PascalCase→camelCase (MouthSmileLeft→mouthSmileLeft); normalizeShapeName tylko druga linia — sam nie składa PascalCase (~30/52 nazw L/R przepadłoby po cichu)"
  - "Krok ramek niestały (v3.0 diffusion = 30 fps używalnych) — porządkujemy po frame_time, nie po fps; fps passthrough informacyjny"
  - "carriesEyes: jawne meta ma pierwszeństwo, inaczej inferencja z obecności eyeBlink*/eyeLook* w ramkach; emotions w payload → carriesEmotion=true"

patterns-established:
  - "Parser czysto funkcyjny (bez DOM/audio) — testowalny w node; wzorzec powtórzony w demo-frames (08-03)"

requirements-completed:
  - A2F-01

duration: unknown (rekonstrukcja po fakcie)
completed: 2026-09-0? (przed Fazą 9; dokładna data nieznana — rekonstrukcja)
status: complete
---

# Phase 08: Plan 02 Summary

**Parser + normalizer odpowiedzi wrappera A2F (A2F-01): czysty moduł JSON → FramesClip zgodny z kontraktem v2.**

> Uwaga provenance: SUMMARY zrekonstruowany z planu 08-02-PLAN.md, kodu `src/lipsync/a2f-parser.ts` (154 linie) i testów `tests/a2f-parser.test.ts`.

## Accomplishments
- Utworzono `src/lipsync/a2f-parser.ts`: `parseA2fJson(json)` / `parseA2fPayload(payload)` → `A2fParseResult { clip, unknownShapes }`; API zgodne 1:1 z planem.
- Własny dekapitalizer `decapitalizeArKit` + whitelist `ARKIT_52` (52 kształty ARKit) — pełne mapowanie PascalCase→camelCase bez strat; `normalizeShapeName` jako druga linia mapowania.
- Wartości clamped 0..1; nieznane kształty pomijane i raportowane deduplikowane w `unknownShapes` (licznik do telemetrii, nie spam per ramka).
- Ramki relatywne: `timeSec = frame_time ?? 0`; sortowanie po timeSec odporno na niestały krok (mix 30/60 fps testowany).
- Meta clipu: `shapes` = suma kluczy z ≥1 ramki; `carriesEyes` z meta lub inferencji; `emotions` → `carriesEmotion=true`.
- Błędy czytelne: brak `frames` → Error; malformed JSON → `A2F: niepoprawny JSON — …` (try/catch w parseA2fJson).
- Testy `tests/a2f-parser.test.ts` (160 linii): pełna tabela 52 nazw PascalCase, spójność whitelisty, relatywność frame_time, sortowanie przy niestałym kroku, clamp, unknownShapes, błędy, inferencja/jawność carriesEyes, carriesEmotion.