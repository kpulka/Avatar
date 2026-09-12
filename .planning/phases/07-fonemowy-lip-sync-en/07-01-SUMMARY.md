---
phase: 07-fonemowy-lip-sync-en
plan: 01
subsystem: lipsync-diagnostics
tags: [lipsync, alignment, telemetry, energy-fallback, gsd]

requires:
  - phase: 06-04
    provides: Produkcyjny MVP z FaceController i speech-backend
provides:
  - Rozszerzony interfejs CharAlignment o source ('elevenlabs' | 'energy-fallback') i energies (RMS per okno)
  - Moduł fallbacku akustycznego jaw-only (src/audio/energy-fallback.ts) — bez fałszywych samogłosek A/O/E/I
  - Telemetrię źródła alignmentu (recordAlignmentChunk / getAlignmentStats)
  - Badge HUD dev ALIGN: EL ✓ / ALIGN: FALLBACK ⚠
affects:
  - src/audio/speech-backend.ts

tech-stack:
  added: []
  patterns: [Alignment source tracking, RMS-energy jaw-only fallback, Per-metric telemetry counters]

key-files:
  created:
    - src/audio/energy-fallback.ts
    - tests/energy-fallback.test.ts
  modified:
    - src/types/avatar.ts
    - src/audio/speech-backend.ts
    - src/prod/telemetry.ts
    - src/main.ts
    - src/lipsync/face-controller.ts
    - tests/face-controller-state.test.ts
    - src/ui/hud.ts
    - index.html

key-decisions:
  - "Fallback akustyczny generuje WYŁĄCZNIE jawOpen ∝ energia RMS (okna 70 ms) — stare generowanie na przemian liter A/O/E/I powodowało rytmiczne machanie ustami bez fonetycznego sensu"
  - "Cisza (rms <= 0.02) nie generuje żadnej wizemy — naturalny zanik ruchu"
  - "Ścieżka alignmentu ElevenLabs bez zmian funkcjonalnych — tylko oznaczana source='elevenlabs' po walidacji"
  - "FaceController rozgałęzia kolejkowanie: source='energy-fallback' → wyłącznie kształty jawOpen, pętla per znak nie jest wykonywana"

patterns-established:
  - "Rozróżnienie źródła danych w strukturze nośnika (source field) + licznik telemetrii per źródło jako wzorzec diagnostyczny dla torów z fallbackiem"

requirements-completed:
  - LIPS-07

duration: -
completed: 2026-09-02 (data nieudokumentowana)
status: complete
---

# Phase 07: Plan 01 Summary

**Diagnostyka źródła alignmentu + uczciwy fallback akustyczny jaw-only. Celem było wykluczenie najpodejrzewańszego źródła objawu „usta otwierają się i zamykają" (stary fallback RMS generował fałszywe samogłoski) i danie devowi narzędzia do weryfikacji, czy wizemy napędzane są prawdziwym alignmentem ElevenLabs.**

## Accomplishments
- Rozszerzono `CharAlignment` (src/types/avatar.ts) o opcjonalne pola `source` ('elevenlabs' | 'energy-fallback') i `energies` (RMS 0..1 per okno) — pola opcjonalne, więc istniejące użycia bez zmian.
- Wyodrębniono logikę fallbacku z `speech-backend.ts` do samodzielnego modułu `src/audio/energy-fallback.ts` (`generateEnergyFallbackAlignment(pcmBytes, sampleRate)`): analiza RMS w oknach 70 ms, `chars` wypełnione spacjami (placeholder mapujący się na pustą mapę kształtów), `energies` per okno, `source: 'energy-fallback'`. Stary fallback produkujący litery A/O/E/I został usunięty.
- Parsowanie prawdziwego alignmentu w `speech-backend.ts` ustawia `source: 'elevenlabs'` po walidacji; ścieżka timingowa bez zmian funkcjonalnych.
- `TelemetryManager` (src/prod/telemetry.ts): liczniki `alignmentElevenlabs`/`alignmentFallback`, metody `recordAlignmentChunk(source)` i `getAlignmentStats()`; `main.ts` rejestruje źródło per chunk.
- HUD dev: badge źródła alignmentu — `ALIGN: EL ✓` (zielony) gdy fallback == 0, `ALIGN: FALLBACK ⚠` (czerwony) gdy fallback > 0 (w bieżącym układzie UI po Fazie 11 odpowiednik w panelu telemetrii, src/ui/studio/panels/session-panel.ts).
- `FaceController.onAudioChunk` rozgałęzia kolejkowanie dla `source === 'energy-fallback'`: wyłącznie `jawOpen = min(0.5, energy * 2.0)`, cisza (energy <= 0.02) → brak wizemy, z uwzględnieniem syncOffset z profilu kalibracji.
- Testy: `tests/energy-fallback.test.ts` (PCM 44100 Hz — połowa pełna amplituda, połowa cisza; pusty PCM → 1 element) + test jaw-only w `tests/face-controller-state.test.ts`. Wszystkie testy i build zielone.