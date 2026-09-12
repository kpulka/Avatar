---
phase: 07-fonemowy-lip-sync-en
plan: 02
subsystem: viseme-scheduler-amplitudes
tags: [lipsync, viseme-scheduler, calibration, amplitudes, gsd]

requires:
  - phase: 07-01
    provides: Diagnostykę źródła alignmentu i fallback jaw-only
provides:
  - Nową semantykę skal: wartości wizem z tabeli mapowań są EFEKTYWNE — jedno mnożenie × scale profilu kalibracji (default 1.0)
  - Pełne domknięcie M/B/P — usunięty cap mouthClose (0.28 + 0.50×jaw); efektywny mouthClose >= 0.85 w hold
  - Lambda wygładzania per grupa mięśni (scaleForShape / lambdaForShape w VisemeScheduler)
  - Presety kalibracji jako mnożniki gustowe (subtle 0.85 / balanced 1.00 / expressive 1.15) i wersjonowany klucz localStorage
affects:
  - index.html

tech-stack:
  added: []
  patterns: [Single-attenuation scheduler (tabela × scale), Per-muscle-group smoothing tiers, Gustowy preset multipliers wokół 1.0]

key-files:
  created: []
  modified:
    - src/lipsync/calibration.ts
    - src/lipsync/viseme-scheduler.ts
    - index.html
    - src/ui/hud.ts
    - tests/calibration.test.ts
    - tests/viseme-scheduler.test.ts

key-decisions:
  - "Wartości z tabeli wizemów (docs/3) to wartości docelowe — usunięto drugą warstwę tłumienia (naturalScale 0.60 + stare scale 0.3-0.55), która spłaszczała wszystkie wizemy do pasma ~0.1-0.4"
  - "Usunięto cap domknięcia Math.min(closeScale, 0.28 + 0.50*jaw) — łamał wymóg pełnego domknięcia M/B/P; mouthClose mnoży się wyłącznie przez closeScale"
  - "Zachowano regułę tłumienia jawOpen przy aktywnym mouthClose (ochrona przed artefaktem 'dolna warga pod nos' na MetaPerson)"
  - "Lambda per grupa mięśni: domknięcie/press 1.7×, żuchwa/tongueOut 1.55×, smile 0.45×, okrągłe wargi 1.0× (baza coarticulationSpeed, default 18) — krótkie spółgłoski osiągają kształt w < 60 ms"
  - "Presety = mnożniki wokół 1.0 (0.85/1.00/1.15), a nie tłumiki; klucz STORAGE_KEY wersjonowany (w 07-02: _v2; podniesiony do _v3 w późniejszych fazach), by stare profile localStorage nie zatruty nowych wartości"

patterns-established:
  - "Semantyka 'tabela = wartości efektywna, profil = lekki mnożnik gustowy' jako kontrakt między danymi mapowań a schedulerem"

requirements-completed:
  - LIPS-06

duration: -
completed: 2026-09-02 (data nieudokumentowana)
status: complete
---

# Phase 07: Plan 02 Summary

**Naprawa „płaskości" mowy: usunięcie podwójnej attenuacji amplitud wizem w VisemeScheduler i przywrócenie pełnego domknięcia M/B/P. Największy pojedynczy widoczny zysk jakości — różnice między fonemami (żuchwa A vs E vs I, domknięcie M/B/P, dzióbek O/U) stały się widoczne.**

## Accomplishments
- `src/lipsync/calibration.ts`: presety CALIBRATION_PRESETS przepisane na mnożniki — subtle 0.85 (coarticulationSpeed 16), balanced 1.00 (default, 18), expressive 1.15 (22); zakresy scale w CalibrationProfile zaktualizowane; STORAGE_KEY wersjonowany.
- `src/lipsync/viseme-scheduler.ts`: usunięto blok `naturalScale` (domyślna 0.60) — wprowadzono `scaleForShape(shape)` mapujące kształt na pojedynczy scale z profilu (mouthClose/Press → closeScale, jawOpen → jawScale, smile/pucker/funnel/roll/teeth → odpowiednie scale, reszta 1.0); kontrybucja = `maxVal * scaleForShape(shape) * weight` (dokładnie jedno mnożenie).
- Usunięto cap domknięcia (`Math.min(closeScale, 0.28 + 0.50 * currentJaw)`) — mouthClose osiąga ~closeScale w fazie hold; reguła tłumienia jawOpen przy aktywnym mouthClose pozostaje bez zmian.
- Lambda wygładzania per kształt: `lambdaForShape(shape)` (domknięcie/press ×1.7, żuchwa/tongueOut ×1.55, smile ×0.45, pozostałe ×1.0 bazowej coarticulationSpeed); alpha liczone per kształt w pętli wygładzania.
- Slidery HUD kalibracji: zakresy nowej semantyki (jaw 0.50-1.30, close 0.50-1.20, pozostałe 0.40-1.30, step 0.05, default 1.00 = 100%).
- Testy: `tests/viseme-scheduler.test.ts` — nowa semantyka (single attenuation: jawOpen 'A' > 0.5 w hold), pełne domknięcie (mouthClose >= 0.85), lambda per grupa (żuchwa zbiega szybciej niż smile); `tests/calibration.test.ts` — asercje presetów + izolacja klucza wersjonowanego. Testy i build zielone.