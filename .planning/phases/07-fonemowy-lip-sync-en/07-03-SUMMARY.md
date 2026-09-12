---
phase: 07-fonemowy-lip-sync-en
plan: 03
subsystem: g2p-phoneme-lipsync-en
tags: [lipsync, g2p, cmudict, arpabet, phonemes, gsd]

requires:
  - phase: 07-02
    provides: Semantykę skal efektywnych i lambda tiers w VisemeScheduler
provides:
  - Moduł G2P EN: leksykon CMUdict (cmu-pronouncing-dictionary, leniwy dynamiczny import) + regułowy fallback letter-to-sound dla OOV (src/lipsync/g2p/g2p-en.ts)
  - Merge czasu fonemów z kotwic znakowych alignmentu ElevenLabs (src/lipsync/g2p/phoneme-merge.ts) — litery nieme oddają czas sąsiadom
  - Tabelę mapowań ARPAbet → combosy ARKit (src/lipsync/g2p/phoneme-visemes.ts, 13 wizemów)
  - Kolejkę fonemową w FaceController z automatyczną degradacją do ścieżki char gdy G2P niegotowy/niedostępny
affects:
  - src/lipsync/face-controller.ts
  - package.json

tech-stack:
  added: [cmu-pronouncing-dictionary (npm, ~135k wpisów, leniwy chunk)]
  patterns: [Lazy memoized dynamic import (osobny chunk Vite, nie w bundle startowym), Word-run tokenizacja alignmentu + proporcjonalny podział czasu słowa na fonemy, Phoneme→viseme single-source mapping table]

key-files:
  created:
    - src/lipsync/g2p/g2p-en.ts
    - src/lipsync/g2p/phoneme-merge.ts
    - src/lipsync/g2p/phoneme-visemes.ts
    - tests/g2p-en.test.ts
    - tests/phoneme-merge.test.ts
    - tests/phoneme-visemes.test.ts
  modified:
    - package.json
    - src/lipsync/face-controller.ts

key-decisions:
  - "ElevenLabs zwraca alignment znaków, nie fonemów — brakująca warstwa G2P zbudowana klientowo: CMUdict (pakiet npm, nazwany eksport `dictionary`, 135155 wpisów, klucze lowercase) ładowany leniwie dynamicznym importem (osobny chunk ~1-2 MB gz, poza bundle startowym)"
  - "Timing słów pochodzi wprost z kotwic alignmentu EL; czas słowa rozkłada się na fonemy proporcjonalnie (waga 1.2 samogłoski/dyftongi, 0.8 spółgłoski, min 35 ms) — litery nieme wchłaniają sąsiednie fonemy i NIE generują fantomowych ruchów ('know' → N OW bez K)"
  - "Regułowy fallback letter-to-sound dla OOV (digrafy SH/CH/TH/PH/WH/CK/QU/NG/KN/WR/MB, pary samogłoskowe, magic-e) — wynik nie-null, niepusty; leksykon i tak pokrywa praktycznie całą mowę EN"
  - "Tabela ARPAbet→wizemy to CELE EFEKTYWNE (spójna z semantyką skal 07-02 — scheduler mnoży ×1.0 domyślnie); nieznany fonem → null → pomijany bez błędu; mouthSmile aplikowany symetrycznie Left/Right"
  - "Fallback akustyczny (source='energy-fallback') ma priorytet nad G2P — bez alignmentu nie ma tekstu do konwersji; G2P niegotowy (pierwsze ~1-2 s sesji) lub trwale nieudany → automatyczna degradacja do ścieżki char, awatar zawsze mówi"
  - "Ścieżka per znak pozostaje w FaceController jako fallback — nie usuwano jej"

patterns-established:
  - "Warstwa G2P między alignmentem znaków a wizemami jako wzorzec dla języków o ortografii niefonetycznej (ścieżka char dla PL pozostaje)"

requirements-completed:
  - LIPS-05

duration: -
completed: 2026-09-02 (data nieudokumentowana)
status: complete
---

# Phase 07: Plan 03 Summary

**Warstwa fonemowa EN: tekst + timing z alignmentu ElevenLabs → fonemy ARPAbet (CMUdict + reguły OOV) → wizemy ARKit. Eliminuje fantomowe ruchy na literach niemych i nadmierną artykulację dwuznaków — brakująca warstwa, której ElevenLabs nie dostarcza.**

## Accomplishments
- `src/lipsync/g2p/g2p-en.ts`: `ensureG2pLoaded()` (memoizowany dynamiczny import `cmu-pronouncing-dictionary`, odczyt nazwanego eksportu `dictionary`, Map lowercase→fonemy z odciętymi cyframi stresu), `isG2pReady()`, `g2pAvailable()`, `wordToPhonemesSync()` (lookup z obsługą apostrofów i łączników) oraz regułowy `rulesFallback()` dla słów spoza leksykonu.
- `src/lipsync/g2p/phoneme-merge.ts`: `mergeCharAlignmentToPhonemes(alignment)` — tokenizacja runów liter, `source != 'elevenlabs'` → [], proporcjonalny podział czasu słowa na fonemy (wagi 1.2/0.8, min 35 ms); kotwice czasu pochodzą z `char_start_times_ms`/`char_durations_ms` z EL.
- `src/lipsync/g2p/phoneme-visemes.ts`: `mapPhonemeToShapes(phoneme)` — pełna tabela ARPAbet → combosy ARKit (samogłoski z różnicowaniem żuchwa/pucker/funnel/smile; P/B/M → mouthClose 1.0 + mouthPress; F/V → mouthRollLower; TH/DH → tongueOut; SH/CH → mouthFunnel), symetria Left/Right, nieznany fonem → null.
- `src/lipsync/face-controller.ts`: fire-and-forget `ensureG2pLoaded()` w konstruktorze; w `onAudioChunk` rozgałęzienie fonemowe (priorytet: energy-fallback z 07-01 → G2P → ścieżka char) kolejkujące spans przez istniejące API `VisemeScheduler.enqueue` bez zmian schedulera.
- Testy (6+6+6 przypadków, zielone): `g2p-en.test.ts` (know/though/question/team/about/nation, brak cyfr stresu, OOV nie-null), `phoneme-merge.test.ts` ('know' → 2 spans bez K, 'what' → W AH T, fallback → [], interpunkcja bez spanów), `phoneme-visemes.test.ts` (M bez jawOpen, F z mouthRollLower, O vs A rozróżnialne, nieznany → null). Build zielony, leniwy chunk CMUdict poza bundle startowym.