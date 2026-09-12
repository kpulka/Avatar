---
phase: 11-ui-dual-persona-i-modularny-frontend-user-studio-scene-prese
plan: 05
subsystem: compare-engine
tags: [a-b-compare, pcm, wav, animation-sources, last-turn-buffer, gsd]

requires:
  - phase: 11-02
    provides: audio:chunk z sampleRate, AppServices, kontrolery
provides:
  - encodeWav (src/audio/pcm-to-wav.ts) — RIFF 44B mono 16-bit
  - LastTurnBuffer — bufor PCM ostatniej tury agenta (reset na user/listening, limit 60 s)
  - AnimationSourceRegistry (src/lipsync/animation-sources.ts) — rejestr źródeł animacji (viseme, a2f-local)
  - CompareController — sekwencja A/B na tym samym PCM, blind mode, cancel, stan partial, raport compare:result
affects:
  - src/audio/pcm-to-wav.ts
  - src/features/last-turn-buffer.ts
  - src/features/compare-controller.ts
  - src/lipsync/animation-sources.ts

tech-stack:
  added: []
  patterns: [AnimationSourceRegistry (capability registry), Fair A/B na jednym źródle PCM, Guard IDLE + pas bezpieczeństwa audio:chunk]

key-files:
  created:
    - src/audio/pcm-to-wav.ts
    - src/features/last-turn-buffer.ts
    - src/features/compare-controller.ts
    - src/lipsync/animation-sources.ts
    - tests/pcm-to-wav.test.ts
    - tests/compare-controller.test.ts

key-decisions:
  - "Tor A i tor B dostają bajtowo identyczne PCM z LastTurnBuffer (rmsDiff = 0 w testach) — uczciwość porównania"
  - "Anulowanie: speech:interruption / transcript:user → cancel PRZED schedulowaniem; audio:chunk → cancel jako pas bezpieczeństwa (udokumentowany koszt: hardStop może obciąć pierwszy chunk nowej tury — pokryte testem)"
  - "Nowe źródło animacji = wpis w rejestrze (register) — zero zmian w UI; F10 doda a2f-cloud jako dane"
  - "predict offline → stan error, LIVE nietknięte; pokrycie ramek < 80% → compare:result z partial: true"

patterns-established:
  - "CompareController pozostaje jedynym dodatkowym pisarzem twarzy poza ścieżką LIVE — brak drugiego pisarza FaceDriver"

requirements-completed:
  - UI-02

duration: 120min
completed: 2026-09-10
status: complete
---

# Phase 11: Plan 05 Summary

**Silnik porównywarki A/B: encodeWav, LastTurnBuffer, AnimationSourceRegistry i CompareController — czyste moduły testowalne bez DOM i GPU.**

## Accomplishments
- Utworzono `pcm-to-wav.ts` (encodeWav: nagłówki RIFF/WAVE/fmt/data, mono 16-bit, poprawne rozmiary) — testy strukturalne w `tests/pcm-to-wav.test.ts`.
- Utworzono `last-turn-buffer.ts`: kumuluje audio:chunk (z sampleRate z eventu), reset na transcript:user / listening, limit maxSeconds 60 s z warnem.
- Utworzono `animation-sources.ts`: AnimationSourceSpec/AnimationSourceRegistry z wbudowanymi `viseme` i `a2f-local`; test rejestracji nowego źródła bez zmian innych plików.
- Utworzono `compare-controller.ts`: stany idle→ready→predicting→playing-a/b→done/error, blind z losową kolejnością raz per run, cancel na interruption/user (bez hardStop) i audio:chunk (z hardStop), raport compare:result { order, predictMs, frames, rtf, partial }, helper rmsDiff.
- Testy `tests/compare-controller.test.ts` (250 linii): identyczne bajty i sampleRate obu torów, sekwencje stanów, cancel, blind mapping, offline → error, brak drugiego pisarza.
- `npm test` + `npm run build` zielone. UAT manualny (słuchowe A/B, blind, RMS < 1% held-out): pending — backstop do pomiaru w 11-VERIFICATION.md.