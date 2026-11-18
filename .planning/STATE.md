---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Portfolio Polish
current_phase: 12
current_phase_name: English language (i18n)
status: planning_complete
stopped_at: "Fazy 12–18 w pełni rozplanowane (CONTEXT + plany + VERIFICATION + drafty, integracja ROADMAP/REQUIREMENTS zrobiona). Wykonanie v1.1: najpierw 18-01 (secrets scan — repo publiczne), potem 12 → 13 → 15 → 16 → 17 → 14 → reszta 18. Blokada operacyjna: rate limit API (subagenci padają na RateLimitError — praca inline orkiestratora)."
last_updated: "2026-11-18"
last_activity: "2026-11-18"
last_activity_desc: "Planning v1.1 Portfolio Polish: komplet artefaktów faz 12–18 (CONTEXT z dowodami pomiarowymi, plany z kryteriami akceptacji, VERIFICATION, drafty: glossary/ui-spec/animation-runtime/lipsync-deep-dive/ARCHITECTURE/README); ROADMAP (fazy 12–18 + kolejność wykonania), REQUIREMENTS (58 wymagań I18N/READ/ARCH/UIX/ANIM/LIP/QUAL + traceability), STATE (v1.1)"
progress:
  total_phases: 18
  completed_phases: 6
  total_plans: 94
  completed_plans: 39
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-01)

**Core value:** Płynna rozmowa głosowa z realistycznym awatarem — usta idealnie zsynchronizowane z mową, naturalne przerwania bez zamrożonej miny.
**Current focus:** v1.1 Portfolio Polish — planning faz 12–18 ZAKOŃCZONY (wszystkie artefakty gotowe, integracja ROADMAP/REQUIREMENTS zrobiona); czeka na rozpoczęcie wykonania (rekomendacja: 18-01 secrets scan najpierw). Równolegle zaległe z v1.0: UAT F11/F8 (człowiek), F9 (OOM — zgoda człowieka), F7 (UAT po F10).

## Current Position

Phase: v1.1 planned — fazy 12–18 z kompletem artefaktów (CONTEXT/PLANY/VERIFICATION/DRAFTY); wykonanie nierozpoczęte
Plan: 44 nowe plany (12-01..18-07) gotowe do wykonania; kolejność: **18-01 → 12 → 13 → 15 → 16 → 17 → 14 → 18 (02..07)**
Status: planning complete; v1.0 w tle: F11/F8 UAT pending (człowiek), F9 zablokowana OOM, F10 po go/no-go
Last activity: 2026-11-18 — planning kompletu v1.1 + integracja centralna (ROADMAP/REQUIREMENTS/STATE)

Progress: 39/94 planów wykonanych (v1.0: F1–F6 26/26, F7 3/4, F8 3/4, F11 7/7; v1.1: 0/44 — planning done)

## Performance Metrics

**Velocity:**

- Total plans completed: 39
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
| 8 | 3/4 | - | - |
| 9 | 0/5 | - | - |
| 10 | 0/4 | - | - |
| 11 | 7/7 | - | - |

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
- P11 review A1 (2026-09-12): **lock zamraża bieżącą wartość klucza**, nie nadpisuje jej własną — tweaker tylko odbiera userowi prawo zmiany (CONTEXT:53,57). Klucze usera i studia są rozłączne, więc źródłem wartości zamrożonej jest właściwy profil (`getEffective`). Regresja: `tests/settings-store.test.ts` (lock po zmianie wartości).
- P11 review A1 (2026-09-12): composition root musi odpinać **wszystkie** Unsub w `dispose()` (mostek legacy + skrót Ctrl+Shift+D) — Pattern 2 „zero wycieków" dotyczy też kontenera.
- F11 smoke (2026-09-12): `createLoader().hide()` nie był wołany **nigdzie**, więc wskaźnik „Ładowanie modelu…" wisiał na ekranie na zawsze. Naprawione: `events.on('avatar:loaded', () => loaderUi.hide())` w kontenerze (pokrywa też ścieżkę fallbacku demo-awatara), zweryfikowane w przeglądarce (overlay → `display: none`).
- P11 review A1 — **jedyne otwarte**: decyzja o przycięciu słownika CMU (3,92 MB / 961 kB gzip, lazy) oraz udokumentowanie sesyjnego backdoora `?studio=1`. Reszta P2 **domknięta 2026-09-12** (allowlista originów, gate w `canCompare()`, defensywna kopia w `getEffective`, vendor chunk `three`, usunięte duplikaty 12 MB i 4,2 MB; zmierzone, że 3,92 MB to słownik, nie three).
- Środowisko F9 (2026-09-11/12): droga bez logowania NVIDIA — CUDA 13.2 + TensorRT 10.13 z pip (`setup-tensorrt-from-pip.ps1`), `trtexec_shim.py` na API Pythona TRT, modele A2F z HF bez tokenu (gated jest tylko A2E); SDK zbudowany (`sample-a2f-executor.exe`).

### Roadmap Evolution

- Phase 11 added (2026-09-10): UI dual-persona i modularny frontend — user/studio, porównywarka algorytmów, scene presets, refaktor modułowy; decyzje w `11-CONTEXT.md`; start po UAT 08-04, równolegle z Fazą 9 (UI-01..UI-05)
- Milestone v1.1 added (2026-11-18): **Portfolio Polish** — fazy 12–18 (EN-ization, README, architektura+guards, web UI, mechanika animacji, fonemy/lip-sync, CI/security/licencja/deploy/higiena); 58 wymagań (I18N/READ/ARCH/UIX/ANIM/LIP/QUAL); artefakty 12+ po angielsku (D2 w 12-CONTEXT); komplet CONTEXT/PLAN/VERIFICATION + drafty per faza; kolejność wykonania w ROADMAP §Progress

### Pending Todos

> **Kolejka GSD (stan 2026-11-18).** Tor A = domknięcie F11/F8 — **WYKONANY**; Tor B = F9→F10 (środowisko gotowe, blokada OOM — zgoda człowieka); Tor C = po F10; **Tor D = wykonanie v1.1 (fazy 12–18)**.

**Tor D — v1.1 Portfolio Polish (nowe, 2026-11-18):**

- **D1**: `18-01` secrets scan NAJPIERW (repo publiczne; pełna historia git) + SECURITY.md — może wykonać się natychmiast, niezależnie od reszty
- **D2**: `/gsd-execute-phase 12` (EN-ization; 7 planów, 3 fale tłumaczeń docs) — rekomendowane przed 13–17 (tłumaczenie komentarzy przed refaktorami)
- **D3**: `/gsd-execute-phase 13` (README; 13-03 gated na Fazę 15 — screenshots po naprawie light theme)
- **D4**: `/gsd-execute-phase 15` → `/gsd-execute-phase 16` → `/gsd-execute-phase 17` (refaktory; 16 i 17 świadomie sekwencjonowane z 14 — patrz 16-CONTEXT §11)
- **D5**: `/gsd-execute-phase 14` (ARCHITECTURE.md + guards; 14-05 po 16/17 żeby dokument był prawdziwy; 14-01/14-02 przed 18-03/18-04)
- **D6**: `/gsd-execute-phase 18` (reszta: CI, licencja, demo, higiena; 3 decyzje ownera zbiorczo: licencja MIT, quota demo Pages, dyspozycja .bak/config.json — patrz 18-CONTEXT §6.5)
- **D7**: decyzje człowieka zebrane w jednym asku na starcie Fazy 18: licencja (D2), live-agent na Pages (D4), `.bak`/`config.json` (D6)

**Tory A–C (zaległe z v1.0):**

- ~~**GATE:** review-unifikacja podejścia A2F ↔ wizemy~~ — **WYKONANE 2026-09-02**: decyzje w PROJECT.md, plany 08–10 zaktualizowane
- ~~**A1**: review kodu F11 przed UAT~~ — **WYKONANE 2026-09-12** (architekt GLM 5.3): **APPROVED-WITH-NITS**, plany 11-01..11-07 wszystkie DONE; P1 (semantyka locków) i P2 (unsub w `dispose()`) naprawione + testy regresyjne; pozostałe P2 w decyzjach powyżej
- **A2** (człowiek): UAT F11 konwersacyjnie + zaadaptowany UAT **08-04** przez nowe Studio → Animacja (demo A2F, Przerwij, switch mid-speech, 60 FPS) — checklisty: `11-VERIFICATION.md` §3 i `TODO_humanInTheLoop.md` pkt 1
- ~~**A3**: zamknięcie F11 — SUMMARY 11-01..11-06~~ — **WYKONANE 2026-09-12** (dodatkowo 11-07); zostaje `manual_uat: pass` w `11-VERIFICATION.md` i ROADMAP 11-07 [x] **po sesji UAT**
- ~~**A4**: artefakty F8 — `08-VERIFICATION.md` + SUMMARY 08-01..03~~ — **WYKONANE 2026-09-12**; `08-VERIFICATION.md` ma `manual_uat: pending` (do zamknięcia po UAT 08-04)
- ~~**A5**: commit checkpoint~~ — **WYKONANE 2026-09-12** — 5 commitów: `32dc05d` (gitignore+config), `e3da658` (src+public), `20b2874` (testy), `856797a` (a2f scaffold), `7da0052` (kanon .planning+docs); repo przedtem śledziło **tylko 14 plików docs** — cały kod był nieśledzony
- ~~**A6**: aktualizacja `TODO_humanInTheLoop.md` do ścieżek nowego Studio~~ — **WYKONANE wcześniej (2026-09-10/11)**
- **B1** (człowiek): środowisko F9 — **w praktyce gotowe**: CUDA 12.9/13.2, TensorRT 10.13 (pip), Python 3.10, SDK zbudowany, 4 modele A2F pobrane; preflight: 9×PASS + 2×WARN (tylko `CUDA_PATH`/`TENSORRT_ROOT_DIR` — kosmetyczne). Zostaje wolny commit/RAM na build silników
- **B2**: `/gsd-execute-phase 9` od 09-01 — start po odblokowaniu OOM (patrz Blockers); potem 09-02..09-04 (rig ARKit-52 z `avatar.glb`, `extract_rig.py` czeka na szablon topologii NPZ z wyjścia A2F)
- **B3** (człowiek): 09-05 ocena jakości + **GO/NO-GO** do chmury
- **B4**: `/gsd-execute-phase 10` — tylko po GO; polityka scale-to-zero
- **C1**: `/gsd-verify-work 7` — dokończyć 07-04 UAT po Fazie 10
- **C2**: `/gsd-complete-milestone` — PROJECT/REQUIREMENTS (Validated), archiwum faz, backlog v2

### Blockers/Concerns

- **Rate limit API OpenCode (miesięczny, reset ~23 dni od 2026-11-18):** subagenci padają natychmiast na RateLimitError — planning v1.1 wykonany w całości inline przez orkiestratora. Przy wykonaniu faz 12–18: albo czekać na reset, albo wykonywać plany inline (`/gsd-fast`/`/gsd-quick` zamiast swarmów), albo delegować pojedynczo z dużymi przerwami. Wpływa na tempo, nie na treść planów.
- **Decyzje człowieka wymagane na starcie Fazy 18** (zbiorczo, 18-CONTEXT §6.5): licencja (rekomendacja MIT — audyt zależności: same permissive), live-agent na demo Pages (rekomendacja: NIE — quota), dyspozycja `.planning/config.json.bak-*` i zmodyfikowanego `config.json` (pliki sprzed tej sesji — nietknięte).
- ~~Luka artefaktów GSD (A3/A4)~~ — **ZAMKNIĘTE 2026-09-12**: dopisane SUMMARY 07-01..07-04, 08-01..08-03, 11-01..11-07 oraz `08-VERIFICATION.md`; `manual_uat` w 07-04/08-VERIFICATION/11-VERIFICATION pozostaje `pending` (świadomie, bez konfabulacji wyników).
- **OOM przy budowie silników TRT (blokuje B2):** `gen_sample_data.py` → TRT `buildSerializedNetwork` rzuca `OutOfMemory` (brak wolnego commitu/RAM). Pomiar 2026-09-12: 32 GB total / **11,2 GB wolne** (przy pierwszej próbie było 7,7 GB) — retry ma sens, ale to ciężki job GPU/CPU wymagający zgody użytkownika; alternatywa: zamknięcie aplikacji/restart. Komenda i env w `docs/A2F-LOCAL.md` §4.
- `extract_rig.py` odroczone: solver wymaga szablonu topologii NPZ, który powstaje dopiero z wyjścia A2F (09-01) — nie da się napisać wcześniej bez zgadywania.
- 07-04 wymaga sesji z żywym agentem EN (mikrofon + model MetaPerson) — plan typu verify, nieautonomiczny.
- Faza 9 wymaga: RTX 3090 + CUDA/TensorRT + konto HF (click-through A2E) — kroki nieautonomiczne; A2E gated = click-through licencji.
- Do potwierdzenia w 09-01 (dump): czy wyjście A2F-3D zawiera eyeBlink L/R (decyzja carriesEyes); dokładne nazwy/units blendshape'ów solvera; format wejścia `IBlendshapeSolver` vs ekstrakt z avatar.glb.
- Pakiet `cmu-pronouncing-dictionary` (~2 MB gz, leniwy chunk) — jeśli niedostępny, plan 07-03 ma ścieżkę awaryjną (cmusphinx/cmudict z GitHuba).
- P2 review A1 — **domknięte 2026-09-12**: allowlista originów w `embed-bridge.ts` (`?parent_origin=<url[,url]>`, tryb same-origin bez allowlisty, `?allow_any_origin=1` jako jawna furtka; emisja nigdy „w ciemno" do `*`), gate obecności awatara w `canCompare()`, defensywna kopia wartości obiektowych w `getEffective`, vendor chunk `three`; usunięte duplikaty: `public/models/avatar/model.glb` (11,96 MB) oraz `src/avatar/avatar_black.zip` (4,2 MB — martwy, zawierał ten sam model).
- Rozmiar bundla (2026-09-12, zmierzone): największy chunk to **nie** three.js (596 kB), lecz `cmu-pronouncing-dictionary` — **3,92 MB / 961 kB gzip**, ładowany dynamicznym importem w `src/lipsync/g2p/g2p-en.ts` (lazy, poza pierwszym renderem). Pierwszy render = ~750 kB (three 596 kB + app 154 kB). **Otwarta decyzja:** pruning słownika (np. top-N słów + reguły OOV, które już są) vs zostawienie pełnego (961 kB gzip na żądanie, bolesne na mobile).
- `a2f/sdk/` (2 GB) i `a2f/.venv/` są w `.gitignore` (zgodnie z `a2f/README.md`: „nie commitujemy binarek").

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Lip-sync PL na fonemach | Faza 7 celuje w EN (decyzja użytkownika); ścieżka char→viseme pozostaje dla PL | Deferred | 2026-09-02 |
| Akustyczna ekstrakcja wizem (Rhubarb/WASM) | Odkryte jako EXP-03; fallback jaw-only wystarcza na v1.1 | Deferred | 2026-09-02 |
| A2F w chmurze (Faza 10) | Cloud Run MVP — dopiero po lokalnym go/no-go z Fazy 9 | Deferred (gate) | 2026-09-02 |
| Faza 7 — UAT (07-04) | Przesunięta na rzecz A2F; resume po Fazie 10 | Paused | 2026-09-02 |

## Session Continuity

Last session: 2026-11-18
Stopped at: Planning v1.1 Portfolio Polish KOMPLETNY — fazy 12–18 (artefakty w `.planning/phases/12..18-*`), integracja ROADMAP/REQUIREMENTS/STATE zrobiona, 44 plany gotowe do wykonania. NEXT: (1) `18-01` secrets scan (natychmiast możliwy); (2) wykonanie faz wg kolejności z ROADMAP §Progress (18-01 → 12 → 13 → 15 → 16 → 17 → 14 → 18); (3) zbiorczy ask do ownera na starcie Fazy 18 (licencja/Pages quota/.bak); (4) tło v1.0: UAT F11/F8 człowiek, OOM F9.
Resume file: .planning/ROADMAP.md (§Progress — v1.1 execution order) + .planning/STATE.md (Tor D)
