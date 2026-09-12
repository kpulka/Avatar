---
phase: 08-unified-animation-core
plan: 01
subsystem: unified-animation-core
tags: [face-controller, frames-mode, barge-in, epoch, lip-sync, gsd]

requires:
  - phase: 06
    provides: FaceController (single-writer), VisemeScheduler, AudioEngine z epoką
provides:
  - Tryb 'frames' w FaceController (absolutne pozy z FramesClip, kontrakt v2)
  - Typy PoseFrame / FramesClip / AnimationMode w src/types/avatar.ts
  - Wspólny barge-in (epoka) i state machine IDLE/SPEAKING/RELAXING dla obu torów
  - Safety rigu wspólne: clamp 0..1, mouthClose ≤ 0.85, guard jaw-vs-close
  - Gating wg clipu: carriesEyes (blink OFF), carriesEmotion (addytywna emocja OFF)
affects:
  - src/lipsync/face-controller.ts
  - src/types/avatar.ts

tech-stack:
  added: []
  patterns: [Absolute frame stream obok toru wizemowego, timeSec relatywne + baseSec dodawany jednorazowo, deferToTurnEnd na granicy tury]

key-files:
  created:
    - tests/animation-frames.test.ts
  modified:
    - src/types/avatar.ts
    - src/lipsync/face-controller.ts
    - docs/7-audio2face-cloudrun.md

key-decisions:
  - "Unifikacja na poziomie właściciela morphów + osi czasu + epoki, NIE wygładzania — smoothing/koartykulacja pozostaje właściwością ŹRÓDŁA (scheduler dla wizemów, brak dla ramek)"
  - "PoseFrame.timeSec jest WZGLĘDNY względem startu audio tury; baseSec dodawany JEDNORAZOWO w feedFrames(clip, baseSec, epoch)"
  - "Tor frames zapisuje currentWeights — RELAXING interpoluje z ostatniej ramki, nie ze stanu sprzed epoki (brak teleporu pozy)"
  - "Brak klucza z clip.shapes w ramce = świadome 0 (zeroowanie kształtów owned) — zastępuje heurystykę '>10 kluczy'"

patterns-established:
  - "Kontrakt ramek v2 (PoseFrame/FramesClip) konsumowany przez FaceController i produkowany przez a2f-parser (08-02)"

requirements-completed:
  - UNA-01

duration: unknown (rekonstrukcja po fakcie)
completed: 2026-09-0? (przed Fazą 9; dokładna data nieznana — rekonstrukcja)
status: complete
---

# Phase 08: Plan 01 Summary

**Absolutny tor ramek w FaceController (UNA-01): tryb `frames` obok wizemowego, wspólna epoka, state machine, safety i jedyny właściciel morphów.**

> Uwaga provenance: niniejszy SUMMARY został zrekonstruowany z planu 08-01-PLAN.md, kodu (`src/lipsync/face-controller.ts`, `src/types/avatar.ts`) i testów (`tests/animation-frames.test.ts`) — oryginalny plik nie istniał w repozytorium.

## Accomplishments
- Dodano kontrakt v2 w `src/types/avatar.ts`: `PoseFrame` (timeSec względny + weights camelCase), `FramesClip` (frames/fps/shapes/carriesEyes/carriesEmotion/emotions), `AnimationMode = 'viseme' | 'frames'`.
- W `FaceController`: `setAnimationMode(mode, { deferToTurnEnd })` z czyszczeniem stanu (scheduler, bufor ramek, manualOverrides) i wariantem odroczonym do granicy tury / przerwania; `getAnimationMode()`.
- `feedFrames(clip, baseSec, epoch)`: ignoruje starą epokę, sortuje bufor rosnąco po timeSec, przechodzi do SPEAKING; baza czasu dodawana JEDNORAZOWE — timeSec pozostaje relatywny.
- W `render(dt)` tryb frames: dobór ramki binarnie wg `engine.ctx.currentTime`, cap `mouthClose ≤ 0.85` (CLOSE_SAFETY_CAP z lustrą VisemeScheduler), clamp 0..1, guard jaw-vs-close, zeroowanie kształtów owned nieobecnych w ramce.
- RELAXING po wyczerpaniu ramek startuje z `currentWeights` zapisywanych przez tor frames (ostatnia poza, nie stan sprzed epoki).
- Gating wg clipu: `carriesEyes=true` → ProceduralBlink OFF; `carriesEmotion=true` → EmotionLayer addytywna OFF w trakcie mowy (IDLE/RELAXING bez zmian).
- Barge-in w frames identyczny jak w viseme: `onInterruption()` czyści bufor ramek i stosuje `pendingMode`.
- Testy `tests/animation-frames.test.ts`: 17 testów trybu frames (aplikacja bezwzględna, RELAXING z ostatniej ramki, barge-in, stara epoka, cap mouthClose, zero owned, gating eyes/emotion, deferToTurnEnd, dryf 30 s).
- Regresja trybu wizemowego zachowana (domyślny tryb `viseme` bez zmian); dokumentacja w `docs/7-audio2face-cloudrun.md` §5 zaktualizowana o integrację v2.