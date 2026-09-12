---
phase: 07-fonemowy-lip-sync-en
plan: 04
subsystem: lipsync-verification-uat
tags: [verification, uat, ab-testing, docs-sync, gsd]

requires:
  - phase: 07-03
    provides: Warstwę fonemową EN scaloną z FaceController
provides:
  - Przełącznik A/B silnika lip-sync (phoneme/char) — FaceController.setLipSyncEngine + persist w localStorage (avatar_lipsync_engine)
  - Checklist UAT fazy 07 (fonemy, domknięcia, timing, barge-in, FPS, A/B, badge ALIGN) — DO WYKONANIA w 07-VERIFICATION.md
  - TODO: synchronizacja docs/3-lip-sync-i-koartykulacja.md z nową architekturą
affects:
  - src/lipsync/face-controller.ts
  - src/ui/hud.ts
  - index.html
  - src/main.ts
  - docs/3-lip-sync-i-koartykulacja.md

tech-stack:
  added: []
  patterns: [Runtime A/B engine toggle (persisted, bez przeładowania), Manual UAT checklist jako artefakt weryfikacyjny]

key-files:
  created: []
  modified:
    - src/lipsync/face-controller.ts
    - src/ui/hud.ts
    - index.html
    - src/main.ts
    - docs/3-lip-sync-i-koartykulacja.md

key-decisions:
  - "Faza nie jest done dopóki UAT nie potwierdzi charakterystyki fonemów na żywym agencie EN — 07-04 to plan typu verify (nieautonomiczny, wymaga sesji dev z agentem EN: mikrofon + model MetaPerson)"
  - "UAT odroczony: ROADMAP.md odnotowuje fazę 07 jako ⏸ PAUZA (2026-09-02) — prace nad A2F (Fazy 8-10) mają priorytet, resume UAT 07-04 po Fazie 10; kod fazy 7 (LIPS-05/06/07) pozostaje aktywny domyślnie"
  - "Wybór silnika persistowany w localStorage (klucz avatar_lipsync_engine, default 'phoneme') — w obecnym UI po Fazie 11 migrowany do SettingsStore (src/app/store/migrate.ts)"

patterns-established:
  - "Przełącznik A/B jako standardowy mechanizm weryfikacji humanoidalnej dla zmian jakościowych w torze animacji"

requirements-completed: []  # LIPS-05/06/07 uznane Complete (code+testy) już w planach 07-01..07-03; UAT wizualny wciąż pending (REQUIREMENTS.md: 'Complete (code+testy; UAT wizualny w 07-04)')

duration: -
completed: 2026-09-02 (data nieudokumentowana; UAT nadal pending)
status: pending-uat
---

# Phase 07: Plan 04 Summary

**Plan weryfikacyjny/UAT fazy 07: przełącznik A/B phoneme/char do porównania starej i nowej ścieżki, manualny UAT na żywym agencie EN i synchronizacja docs/3 z nową architekturą. Egzekucja częściowa — UAT odroczony na rzecz Faz 8-10 (A2F).**

## Accomplishments
- Przełącznik A/B silnika lip-sync: `FaceController.setLipSyncEngine('phoneme' | 'char')` (pole `lipSyncEngine`, default 'phoneme', warunek `usePhonemes` rozszerzony w `onAudioChunk` — linie ~310 src/lipsync/face-controller.ts); checkbox HUD + persist w localStorage `avatar_lipsync_engine` (po refaktorze UI Faz 11: migracja klucza w src/app/store/migrate.ts). Część „auto" planu wykonana.
- TODO (odroczone, resume po Fazie 10): manualny UAT na żywym agencie EN i zapis wyników w `07-VERIFICATION.md` — checklist 9 pozycji: badge ALIGN (EL ✓ przez całą sesję), litery nieme („Do you know, though?"), domknięcia M/B/P („map, mop, pop, maybe", mouthClose >= 0.85), charakterystyka fonemów („vision, question, team, about"), timing 30 s bez dryfu (re-walidacja LIPS-01), 10× barge-in < 50 ms audio / < 300 ms twarz (re-walidacja CONV-04), 60 FPS, A/B char↔phoneme, kontrolny fallback jaw-only.
- TODO: pełna synchronizacja `docs/3-lip-sync-i-koartykulacja.md` (warstwa G2P, semantyka skal, lambda tiers, fallback jaw-only) — docs/3 docelowo wg post_task planu 07-04; docs roboczy EN-visemes (docs/EN-visemes.md, tabela ARPAbet + propozycje wartości blendshape'ów z adnotacjami „co zadziałało") powstał jako baza warsztatowa Edytora Wizemów dla tej weryfikacji.
- Status fazy w ROADMAP.md: 07-01..07-03 [x], 07-04 [ ] — faza 07 ⏸ PAUZA (2026-09-02), kod fazy 7 aktywny domyślnie; nie zamyka fazy — brak results UAT (świadomie NIE konfabulowane).