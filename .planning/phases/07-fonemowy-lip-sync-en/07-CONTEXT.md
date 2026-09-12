---
phase: "07"
name: "Fonemowy lip-sync EN — naprawa płaskości"
created: "2026-09-02"
---

# Phase 7: Fonemowy lip-sync EN — naprawa płaskości — Context

## Dlaczego ta faza istnieje (diagnoza, wrzesień 2026)

UAT wykazało, że mowa EN wygląda wizualnie **płasko**: "usta otwierają się i zamykają w jednej formie",
nie da się odróżnić charakterystycznych fonemów (M/B/P, F/V, S/Z, O/U). Analiza kodu potwierdziła
**trzy nałożone przyczyny** (od najbardziej krytycznej):

### Przyczyna 1: Podwójna attenuacja amplitud (główny winowajca "płaskości")

`VisemeScheduler.update()` (`src/lipsync/viseme-scheduler.ts:94-105`) mnoży każdą wartość z tabeli
wizemów przez `naturalScale` (domyślnie 0.60) **a dodatkowo** przez scale z profilu kalibracji
(`balanced`: jawScale 0.55, puckerScale 0.50, funnelScale 0.40, closeScale 0.30...). Efektywnie:

- 'A' → jawOpen = 0.55 × 0.55 = **0.30** (żuchwa ledwo się rusza)
- M/B/P → mouthClose = 1.0 × min(0.30, 0.28 + 0.50×jaw) ≈ **0.30** (wargi NIGDY się nie domykają!)
- mouthSmile, pucker, funnel → efektywnie 0.10–0.30 (niewidoczne)

Wszystkie wizemy spłaszczają się do wąskiego pasma ~0.1–0.4 → "buzia się otwiera i zamyka".
Uwaga: wartości w `viseme-mappings.ts` są już docelowymi wartościami z docs/3 — scheduler
dodaje niechcianą drugą warstwę tłumienia. Ponadto linia 97 (`Math.min(closeScale, 0.28 + 0.50 * currentJaw)`)
kapuje domknięcie zawsze do ~0.3 — łamie wymóg LIPS-02 (pełne domknięcie M/B/P).

### Przyczyna 2: Zbyt wolne wygładzanie zjada charakterystyczne spółgłoski

Pojedyncza lambda = 18 dla wszystkich kształtów → stała czasowa ~55 ms, dojście do celu ~140 ms.
Spółgłoski EN trwają 40–80 ms → kształt nigdy nie osiąga celu zanim fonem się skończy.
docs/3 sam przewiduje wolniejsze lambda (~6-8) TYLKO dla powrotu uśmiechu po pauzie, nie dla całej mowy.

### Przyczyna 3: Litery zamiast fonemów (char→viseme bez G2P)

ElevenLabs zwraca **alignment znaków** (`chars`, `char_start_times_ms`, `char_durations_ms`) —
potwierdzone w `@elevenlabs/types` 0.22.1 i live docs. **Nie ma fonemów.** Tabela `viseme-mappings.ts`
została zaprojektowana pod polski (ortografia fonetyczna). Dla EN skutkuje:

- **Litery nieme = fantomowe wizemy**: "know" (machnięcie na nieme K), "though" (GH na końcu),
  "listen" (T), "island", "hour", "comb"
- **Dwuznaki samogłoskowe nieobsłużone**: "ee/ea/oo/ou/ai/oi/oa" → każda litera osobna wizema
  ("team" = 4 ruchy zamiast 3 fonemów; "about" — zła sekwencja kształtów)
- **Sufiksy**: "-tion" = 4 wizemy zamiast /ʃən/ = 2; "-ed"/"-es" pełna artykulacja dla często-niemych końcówek

### Podejrzany dodatkowy: fallback RMS generuje rytmiczne machanie

`speech-backend.ts:251 generateFallbackAlignmentFromPcm` — gdy alignment z serwera nie nadejdzie,
generuje **fałszywe samogłoski** (A/O/E/I naprzemiennie co 70 ms okna RMS) — dokładnie objaw
"usta otwierają się i zamykają". Brak telemetrii pokazującej, czy fallback jest aktywny.

## Decyzje (zatwierdzone przez użytkownika)

1. **Timing zostaje jak jest** — architektura osi czasu jest poprawna (surowy WSS, wspólne
   `AudioContext.currentTime` dla audio i wizemów, epoch-invalidacja przy barge-in, gapless tailTime).
   Nie ruszać `AudioEngine`, `RawWssClient`, pętli schedulowania czasów.
2. **Amplitudy**: usunąć podwójną attenuację — wartości z tabeli wizem = wartości docelowe,
   preset kalibracji = lekkie mnożniki gustowe (subtle 0.85 / balanced 1.00 / expressive 1.15),
   closeScale default ~1.0 (pełne domknięcie M/B/P wraca). Zachować regułę tłumienia jawOpen
   przy mouthClose (przeciwdziała artefaktowi "warga wjeżdża pod nos" na MetaPerson).
3. **Lambda per grupa mięśni**: domknięcie ~1.7×, żuchwa ~1.55×, okrągłe wargi ~1.0×, smile ~0.45×
   (bazą jest `coarticulationSpeed` z profilu).
4. **Warstwa fonemowa EN**: pełny leksykon CMUdict (pakiet npm `cmu-pronouncing-dictionary`,
   leniwie ładowany dynamicznym importem) + reguły letter-to-sound dla słów poza leksykonem.
   Timing słów pochodzi z alignmentu ElevenLabs (kotwice); czas liter niemych wchłaniają sąsiednie
   fonemy (proporcjonalny podział czasu słowa na fonemy).
5. **Tylko EN** — ścieżka char→viseme pozostaje jako fallback (brak G2P / przełącznik A/B w HUD).
6. **Fallback akustyczny jaw-only**: bez alignmentu usta ruszają tylko `jawOpen` ∝ energia RMS
   (bez fałszywych samogłosek) + telemetria źródła alignmentu w HUD dev.

## Kanon i ograniczenia

- Interfejs `SpeechBackend`, state machine FaceController, epoch, `FaceDriver` — bez zmian strukturalnych.
- Tylko `FaceController` pisze do `morphTargetInfluences` (naruszalna zasada z docs/4).
- Kolejka schedulera przyjmuje dowolne `shapes: Map<string, number>` — fonemy wpisują się bez zmian API.
- Model MetaPerson: brak `tongueOut` → `applyWeight` na brakującym kształcie jest no-op (FaceDriver
  `shapeTargetMap`) — mapowania z `tongueOut` są bezpieczne.
- Testy: `vitest run`; build: `npm run build` (tsc && vite build). Oba muszą przechodzić po każdym planie.
