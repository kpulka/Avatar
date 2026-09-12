---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 11
current_phase_name: UI dual-persona i modularny frontend
status: executed_uat_pending
stopped_at: "Faza 11 wykonana: 11-01..11-06 ukończone, 11-07 kod gotowy; npm test 41/202 + build zielone; UAT manualny pending (11-VERIFICATION.md §3). NEXT: UAT 08-04 + UAT F11 → zamknięcie fazy."
last_updated: "2026-09-10"
last_activity: "2026-09-10"
last_activity_desc: "Egzekucja F11 w pętli: store/migracja, kontrolery, panele studia, compare core, warstwa user, scene presets; pełna regresja 41 plików/202 testów + build zielone"
progress:
  total_phases: 11
  completed_phases: 6
  total_plans: 50
  completed_plans: 35
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-01)

**Core value:** Płynna rozmowa głosowa z realistycznym awatarem — usta idealnie zsynchronizowane z mową, naturalne przerwania bez zamrożonej miny.
**Current focus:** Fazy 8–10 (zunifikowana animacja + NVIDIA Audio2Face); Faza 7 wstrzymana (UAT później)

## Current Position

Phase: 11 of 11 (UI dual-persona i modularny frontend) — wykonana; Faza 7 ⏸ deferred; Fazy 8–10 zrównoleglone
Plan: 11-01..11-06 ✅ wykonane; 11-07 kod ✅, UAT manualny ⏳ (11-VERIFICATION.md §3)
Status: F11 executed — bramki automatyczne PASS (41 plików / 202 testy, build); UAT pending
Last activity: 2026-09-10 — egzekucja F11 w pętli (plan-po-planie, test+build po każdym kroku)

Progress: ~35/50 plans (6/11 faz kompletnych; Faza 7 w UAT; Faza 11 UAT pending)

## Performance Metrics

**Velocity:**

- Total plans completed: 29
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 4 | - | - |
| 2 | 5 | - | - |
| 3 | 5 | - | - |
| 4 | 4 | - | - |
| 5 | 4 | - | - |
| 6 | 4 | - | - |
| 7 | 3/4 | - | - |
| 8 | 0/4 | - | - |
| 9 | 0/5 | - | - |
| 10 | 0/4 | - | - |
| 11 | 0/7 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Init: ElevenAgents (Tryb A) jako mózg konwersacji — barge-in i alignment serwerowo
- Init: Surowy WSS zamiast SDK — audio + alignment na jednej osi czasu (precyzja lipsync)
- Init: Epoch-based barge-in + FaceController jako jedyny właściciel morph targetów
- Init: PoC używa PCM 44.1 kHz (nie mp3) — gapless bez kosztu dekodera
- P7: Amplitudy wizem = wartości tabeli × 1 scale profilu (presety to mnożniki gustowe, nie tłumiki); pełne domknięcie M/B/P wraca
- P7: ElevenLabs daje timing liter, nie fonemy — warstwa G2P (CMUdict) po stronie klienta; litery nieme wchłaniają czas sąsiadów
- P7: Lambda wygładzania per grupa mięśni (domknięcie 1.7×, żuchwa 1.55×, okrągłe 1.0×, smile 0.45×)
- P7: Fallback bez alignmentu = tylko jawOpen ∝ energia RMS + telemetria źródła alignmentu w HUD
- P7: v1.3 EN — mocniejsze amplitudy + "smaczek" (zęby/język/pucker per wizem); docs/EN-visemes.md jako dokument roboczy
- P8-10: Kierunek = zunifikowany tor animacji (wizemy + absolutne ramki A2F), wspólny barge-in (epoka); A2F lokalnie (RTX 3090) → dopiero potem Cloud Run (go/no-go w Fazie 9)
- P8-10 review (2026-09-02): A2F = Audio2Face-3D SDK MIT + wagi HF (nie NIM/NGC); kontrakt ramek v2 (relatywny timeSec, FramesClip carriesEyes/carriesEmotion, dekapitalizer PascalCase); solver na rigu z avatar.glb; model v3.0 primary; chmura wyłącznie scale-to-zero (płacimy tylko za przetworzenie); emocje: A2E w turach A2F + EmotionLayer w IDLE; EN-only

### Roadmap Evolution

- Phase 11 added (2026-09-10): UI dual-persona i modularny frontend — user/studio, porównywarka algorytmów, scene presets, refaktor modułowy; decyzje w `11-CONTEXT.md`; start po UAT 08-04, równolegle z Fazą 9 (UI-01..UI-05)

### Pending Todos

> **Kolejka GSD (2026-09-10).** Tor A = domknięcie F11/F8 (teraz, bez instalacji); Tor B = F9→F10 (blokowany instalacjami); Tor C = po F10.

- ~~**GATE:** review-unifikacja podejścia A2F ↔ wizemy~~ — **WYKONANE 2026-09-02**: decyzje w PROJECT.md, plany 08–10 zaktualizowane
- **A1** (opcj.): `/gsd-code-review 11` — review kodu F11 przed UAT; findings → gsd-code-fixer
- **A2**: UAT F11 konwersacyjnie (`/gsd-verify-work 11`) + zaadaptowany UAT **08-04** przez nowe Studio → Animacja (demo A2F, Przerwij, switch mid-speech, 60 FPS) — checklisty: `11-VERIFICATION.md` §3 i `TODO_humanInTheLoop.md` pkt 1
- **A3**: zamknięcie F11 — `11-VERIFICATION.md` (`manual_uat: pass`), ROADMAP 11-07 [x] (7/7), dopisać SUMMARY dla 11-01..11-06 (execution inline ich nie wytworzył)
- **A4**: zamknięcie F8 (08-04) — utworzyć `08-VERIFICATION.md` z sesji UAT + dowodów kodu; dopisać SUMMARY 08-01..03; ROADMAP 08-checkboxy
- **A5**: commit checkpoint (4 commity: store/ui-mode, kontenery+panele, compare+user, docs/verification) — po zatwierdzeniu użytkownika
- **A6**: aktualizacja `TODO_humanInTheLoop.md` do ścieżek nowego Studio (UAT 1:1 z UI)
- **B1**: środowisko F9 po stronie człowieka (CUDA 12.9, TensorRT 10.13+, Python 3.10, HF + zgoda A2E, klon SDK, modele, TRT; preflight bez FAIL)
- **B2**: `/gsd-execute-phase 9` od 09-01 (dump fixture + rig ARKit-52 z avatar.glb) → 09-02..09-04
- **B3**: 09-05 ocena jakości + **GO/NO-GO** do chmury (użytkownik)
- **B4**: `/gsd-execute-phase 10` — tylko po GO; polityka scale-to-zero
- **C1**: `/gsd-verify-work 7` — dokończyć 07-04 UAT po Fazie 10
- **C2**: `/gsd-complete-milestone` — PROJECT/REQUIREMENTS (Validated), archiwum faz, backlog v2

### Blockers/Concerns

- **Luka artefaktów GSD (do domknięcia w A3/A4):** brak `SUMMARY.md` dla 08-01..08-03 oraz 11-01..11-06 (egzekucja inline zamiast `/gsd-execute-phase`) i brak `08-VERIFICATION.md`; plan zamknięcia w A3/A4.
- 07-04 wymaga sesji z żywym agentem EN (mikrofon + model MetaPerson) — plan typu verify, nieautonomiczny.
- Faza 9 wymaga: RTX 3090 + CUDA 12.8+/TensorRT 10.13+ + konto HF (click-through A2E) — kroki nieautonomiczne; A2E gated = click-through licencji.
- Do potwierdzenia w 09-01 (dump): czy wyjście A2F-3D zawiera eyeBlink L/R (decyzja carriesEyes); dokładne nazwy/units blendshape'ów solvera; format wejścia `IBlendshapeSolver` vs ekstrakt z avatar.glb.
- Pakiet `cmu-pronouncing-dictionary` (~2 MB gz, leniwy chunk) — jeśli niedostępny, plan 07-03 ma ścieżkę awaryjną (cmusphinx/cmudict z GitHuba).

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Lip-sync PL na fonemach | Faza 7 celuje w EN (decyzja użytkownika); ścieżka char→viseme pozostaje dla PL | Deferred | 2026-09-02 |
| Akustyczna ekstrakcja wizem (Rhubarb/WASM) | Odkryte jako EXP-03; fallback jaw-only wystarcza na v1.1 | Deferred | 2026-09-02 |
| A2F w chmurze (Faza 10) | Cloud Run MVP — dopiero po lokalnym go/no-go z Fazy 9 | Deferred (gate) | 2026-09-02 |
| Faza 7 — UAT (07-04) | Przesunięta na rzecz A2F; resume po Fazie 10 | Paused | 2026-09-02 |

## Session Continuity

Last session: 2026-09-10
Stopped at: F11 wykonana (kod 7/7, testy 41/202 + build zielone). NEXT: UAT 08-04 → UAT manualny F11 (60 FPS, presety, blind, a11y, RMS; 11-VERIFICATION.md §3) → zamknięcie fazy.
Resume file: .planning/phases/11-ui-dual-persona-i-modularny-frontend-user-studio-scene-prese/11-VERIFICATION.md
