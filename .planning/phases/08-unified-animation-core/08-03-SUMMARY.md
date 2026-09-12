---
phase: 08-unified-animation-core
plan: 03
subsystem: unified-animation-core
tags: [demo-frames, pose-router, e2e-offline, a2f, gsd]

requires:
  - phase: 08-01
    provides: Tryb frames FaceController (feedFrames, setAnimationMode/deferToTurnEnd)
  - phase: 08-02
    provides: Parser A2F → FramesClip (tu niekonieczny — demo syntetyczne)
provides:
  - Syntetyczny FramesClip 60 fps + mowopodobne PCM (buildDemoFrames / synthesizeDemoAudio) — "suchy bieg" A2F bez GPU
  - PoseRouter (animation-router.ts): polityka wyboru źródła per tura z degradacją
  - E2E offline: audio + ramki odtwarzane na osi AudioContext.currentTime (test braku dryfu 30 s)
  - Przełącznik LIVE/A2F w UI (oryginalnie HUD/kalibrator; po Fazie 11 → panel Studio → Animacja)
affects:
  - src/lipsync/demo-frames.ts
  - src/lipsync/animation-router.ts
  - src/main.ts (podłączenie demo)

tech-stack:
  added: []
  patterns: [Cienki router czysty testowalny bez GPU, demo data jako plugging-punkt dla realnego A2F (Faza 9)]

key-files:
  created:
    - src/lipsync/demo-frames.ts
    - src/lipsync/animation-router.ts
    - tests/animation-router.test.ts
  modified:
    - tests/animation-frames.test.ts (buildDemoFrames + dryf 30 s)
    - src/main.ts

key-decisions:
  - "LIVE tura (WSS) → ZAWSZE wizemy (A2F-batch łamałby TTFB <1,5 s); tura offline/demo + mode=frames + EN → frames; PL → wizemy (A2F trenowany na EN)"
  - "a2fHealthy undefined (Faza 8, demo syntetyczne) → frames dozwolone; a2fHealthy=false → degradacja do wizemów (health-check doszedł w Fazie 9)"
  - "Generator demo wygładza pozy (filtr trójkątny ~100 ms) — modeluje płynne wyjście neuronowe A2F; sam kontroler frames pozostaje bez wygładzania (kontrakt v2)"
  - "Po Fazie 11 przełącznik LIVE/A2F przejął panel Studio → Animacja (src/ui/studio/panels/animation-panel.ts) + AnimationSourceRegistry; oryginalny select w HUD/kalibratorze został zastąpiony (patrz 11-VERIFICATION §4)"

patterns-established:
  - "Syntetyczne dane E2E zamiast zależności od GPU/serwera — wzorzec 'suchego biegu' przed integracją (Faza 9)"

requirements-completed:
  - A2F-03 (częściowo: E2E offline; pełna degradacja z health-check w Fazie 9)

duration: unknown (rekonstrukcja po fakcie)
completed: 2026-09-0? (przed Fazą 9; dokładna data nieznana — rekonstrukcja)
status: complete
---

# Phase 08: Plan 03 Summary

**E2E offline bez GPU: syntetyczne ramki + audio odtwarzane przez tryb `frames`, router per-tura i barge-in — "suchy bieg" przed realnym A2F (Faza 9).**

> Uwaga provenance: SUMMARY zrekonstruowany z planu 08-03-PLAN.md, kodu (`demo-frames.ts` 208 linii, `animation-router.ts` 34 linie) i testów.

## Accomplishments
- `src/lipsync/demo-frames.ts`: `buildDemoFrames(...)` → FramesClip 60 fps z frazy (samogłoski otwierają szczękę, M/B/P domykają, okrągłe samogłoski w dzióbek, syczące w uśmiech), pozy wygładzone filtrem ~100 ms; `synthesizeDemoAudio(...)` — mowopodobny sygnał (źródło dźwięczne/szumne per fonem, zmienna F0). Deterministyczne, bez DOM.
- `src/lipsync/animation-router.ts`: `resolveAnimationSource(ctx)` — cienka, czysta polityka per-tura (LIVE→viseme zawsze; offline+EN+mode=frames→frames; a2fHealthy=false→degradacja; PL→viseme).
- Podłączenie w `main.ts`: demo A2F frames → `audioEngine.playChunk` (PCM + `startSec`) → `setAnimationMode('frames')` + `feedFrames(clip, startSec, epoch)`; przełącznik w UI z `deferToTurnEnd: true` mid-turn i persystencją wyboru.
- Barge-in przerywa demo frames epoką — bufor czyszczony, RELAXING→IDLE (test na danych syntetycznych w animation-frames.test.ts).
- Testy: `tests/animation-router.test.ts` (6 testów — tablica przypadków routera), `tests/animation-frames.test.ts` dopięte o buildDemoFrames (długość ±1 klatka, wartości 0..1, timeSec rosnące, mouthClose w shapes dla M/B/P) oraz test dryfu 30 s (playback klatka-po-klatce na fake ctx.currentTime — koniec audio trafia w ostatnią ramkę, brak narastającego rozjazdu).
- Po Fazie 11: przełącznik LIVE/A2F żyje w panelu Studio → Animacja (`src/ui/studio/panels/animation-panel.ts`, `src/features/animation-controller.ts`, rejestr `src/lipsync/animation-sources.ts`) — oryginalny wpis w HUD/kalibratorze został zastąpiony; router pozostaje polityką źródłową.