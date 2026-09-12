# Requirements: Avatar

**Defined:** 2026-09-01
**Core Value:** Płynna rozmowa głosowa z realistycznym awatarem — usta idealnie zsynchronizowane z mową, naturalne przerwania bez zamrożonej miny.

> Źródło prawdy technicznej: `docs/0-roadmap-poc-mvp.md` (kryteria akceptacji etapów) oraz `docs/1-6`. Każde wymaganie nawiązuje do konkretnych sekcji dokumentacji.

## v1 Requirements

### Konwersacja (CONV)

- [x] **CONV-01**: Użytkownik może rozmawiać z awatarem głosem w czasie rzeczywistym — mikrofon → ElevenAgents (STT+LLM+TTS+turn-taking) → odpowiedź słowna (docs/2, Tryb A)
- [x] **CONV-02**: Start odpowiedzi audio < 1,5 s od zakończenia wypowiedzi użytkownika (mierzalne: `user_transcript` → pierwszy event `audio`; docs/0)
- [x] **CONV-03**: Użytkownik może przerwać wypowiedź awatara w dowolnym momencie — serwer wykrywa mowę, klient obsługuje event `interruption` (docs/4)
- [x] **CONV-04**: Po przerwaniu: audio zamiera < 50 ms, twarz w stanie neutralnym < 300 ms, zero "uwięzionych" chunków (epoch; docs/4)
- [x] **CONV-05**: Rozmowa 10 min bez wycieków pamięci (sprzątanie `AudioBufferSourceNode` w `onended`), bez trzasków między chunkami (PCM gapless + prebuffer; docs/4)

### Lip-Sync (LIPS)

- [x] **LIPS-01**: Usta zsynchronizowane z mową EN — brak wyraźnego dryfu w wypowiedzi 30 s (alignment → scheduler wizemów na osi `AudioContext.currentTime`; docs/3, docs/4)
- [x] **LIPS-02**: Spółgłoski wargowe M/B/P domykają wargi w momencie dźwięku (`mouthClose: 1.0` z priorytetem; docs/3) — test kontrolny PoC
- [x] **LIPS-03**: Koartykulacja: płynne przejścia między wizemami (blend-in/hold/blend-out, additive blending, damping niezależny od FPS, wygaszanie do zera; docs/3)
- [x] **LIPS-04**: Lip-sync PL: dwuznaki (sz, cz, rz, ch, dź, dż, th-like), nosówki ą/ę oraz heurystyka C (moduł PL tabeli mapowań; docs/3)

### v1.1 — Naprawa lip-syncu EN (Faza 7)

Diagnoza (2026-09-02): mowa EN wizualnie płaska — trzy nałożone przyczyny: (a) podwójna attenuacja amplitud w schedulerze, (b) lambda wygładzania za wolna dla spółgłosek, (c) mapowanie liter (nie fonemów) bez G2P dla angielskiej ortografii. Szczegóły: `.planning/phases/07-fonemowy-lip-sync-en/07-CONTEXT.md`.

- [x] **LIPS-05**: Fonemowa interpretacja EN: warstwa G2P (leksykon CMUdict + reguły dla słów spoza leksykonu/OOV) między alignmentem znaków a wizemami — litery nieme nie generują ruchów ust; timing słów pochodzi z alignmentu ElevenLabs; degradacja do ścieżki char gdy G2P niedostępny
- [x] **LIPS-06**: Wyrazistość amplitud: wartości wizem z tabeli są efektywne (jedno mnożenie × scale profilu, default 1.0) — M/B/P osiąga widoczne pełne domknięcie (efektywny mouthClose ≥ 0.85); lambda wygładzania per grupa mięśni (domknięcie ~1.7×, żuchwa ~1.55×, okrągłe ~1.0×, smile ~0.45×)
- [x] **LIPS-07**: Diagnostyka źródła alignmentu: telemetria + HUD dev pokazuje per chunk źródło (ElevenLabs vs fallback); fallback akustyczny jaw-only (tylko `jawOpen` ∝ energia RMS, bez fałszywych samogłosek)

### Awatar / Render (AVAT)

- [x] **AVAT-01**: Model MetaPerson `.glb` renderuje się w Three.js z walidacją fail-fast: brakujące blendshape'y ARKit → czytelny błąd + lista braków (docs/1)
- [x] **AVAT-02**: 60 FPS @ 1080p na GPU klasy GTX 1060 / Apple M1 podczas aktywnej mowy (docs/0, docs/5)
- [x] **AVAT-03**: Model < 25 MB; pierwszy render < 5 s @ 20 Mbps (docs/0, docs/1)
- [x] **AVAT-04**: Skóra bez efektu plastiku w PoC: `MeshPhysicalMaterial` + sheen/clearcoat + oświetlenie 3-point + environment + ACES (docs/5, etap 1)
- [x] **AVAT-05**: SSS pre-integrated na uszach/nosie/wargach w MVP: `onBeforeCompile` (wrap diffuse + translucency term + maska grubości), A/B zrzuty referencyjne (docs/5, etap 2)
- [x] **AVAT-06**: Ożywienie: proceduralne mruganie, sakkady oczu, mikroruchy głowy (szum Perlina), idle sway (docs/6)

### Twardość / Produkt (ROB)

- [x] **ROB-01**: Reconnect WSS z backoffem + obsługa błędów: brak mikrofonu, brak WebGL, restart rozmowy bez przeładowania strony (docs/2, docs/4)
- [x] **ROB-02**: Telemetria dev: TTFB odpowiedzi, drift lip-syncu (log różnic czasów), FPS counter (docs/0)
- [x] **ROB-03**: Agent prywatny przez signed URL z backendu — `xi-api-key` niewidoczny w sieci przeglądarki (MVP; docs/2)
- [x] **ROB-04**: Konfiguracja agenta as code (ElevenLabs CLI, wersjonowana w repo) — zmiany promptu przez PR (MVP; docs/2)
- [x] **ROB-05**: Emocje sterowane agentem: client tool `set_emotion` → baza emocjonalna blendshape'ów nakładana pod wizemy mowy, wolniejszy damping (MVP; docs/6)
- [x] **ROB-06**: UI: przycisk Talk (unlock AudioContext), mute mikrofonu, wskaźnik stanu (listening/speaking), transkrypcja live (MVP; docs/2)

## v2 Requirements

### Rozszerzenia mowy i realizmu (Faza 2)

- **EXP-01**: Własny pipeline mózgu (Tryb B: Speech Engine / Multi-Context WS / Pipecat; docs/2, docs/6)
- **EXP-02**: Gestykulacja ciała z animacjami Mixamo (crossfade `AnimationMixer`; docs/1, docs/6)
- **EXP-03**: Lip-sync akustyczny (Rhubarb WASM / MFCC) dla języków bez fonetycznego zapisu (docs/3, docs/6)
- **EXP-04**: Alternatywny renderer: MetaHuman + Unreal Pixel Streaming lub HeyGen LiveAvatar (macierz docs/1, docs/6)
- **EXP-05**: Dodatkowe moduły językowe (tabela znak→wizem per język; docs/6)

### v2.1 — Zunifikowana animacja + NVIDIA Audio2Face (Fazy 8–10)

Decyzja kierunkowa (2026-09, potwierdzona po review-unifikacji 2026-09-02): zachowujemy LIVE wizemy jako domyślny, real-time tor; dodajemy **neuronowy tor A2F-3D** (SDK MIT, offline/batch dla tur EN) pod wspólnym interfejsem animacji i wspólnym barge-in (epoka). Smoothing/koartykulacja per-źródło; wspólne: state machine, epoka, safety rigu. Emocje: A2E prowadzi mimikę w turach A2F; EmotionLayer pozostaje bazą IDLE i toru wizemowego. Lokalnie na RTX 3090 → dopiero potem Cloud Run **tylko w modelu scale-to-zero** (płacimy wyłącznie za przetworzenie). Szczegóły: `docs/7-audio2face-cloudrun.md`, `.planning/phases/08-*/08-CONTEXT.md`.

- [ ] **UNA-01**: FaceController ma dwa tryby animacji (`viseme` / `frames` — wartości bezwzględne z ramek) przełączalne w runtime (per-tura z odroczeniem na granicę); wspólna epoka barge-in i jedyny właściciel morphów w obu; wspólne safety rigu (clamp, cap mouthClose) (docs/4, docs/7)
- [ ] **A2F-01**: Parser/normalizer wyjścia A2F (JSON ramek, ARKit PascalCase 52 shape'y → camelCase przez dekapitalizer parsera) → `FramesClip` (ramki relatywne, meta shapes/carriesEyes/carriesEmotion); nieznane shape'y pomijane + zliczane (docs/7 §5)
- [ ] **A2F-02**: Lokalny Audio2Face-3D SDK (MIT; wagi HF NVIDIA Open Model License) na RTX 3090 + solver blendshape na rigu ARKit-52 z naszego `avatar.glb` + REST wrapper `/predict` (wav → JSON ramek, gzip, bez capu) — docs/A2F-LOCAL.md
- [ ] **A2F-03**: E2E offline w aplikacji: audio + ramki zsynchronizowane (playback gapless trybem `frames`), przełącznik A/B `LIVE / A2F` w HUD z degradacją bez dziury (EN-only dla A2F)
- [ ] **A2F-04**: Porównanie jakości na zdaniach kontrolnych EN (docs/EN-visemes §6) + barge-in w trybie A2F (stop <50 ms, neutral <300 ms) + rozstrzygnięcie v3.0/v2.3; go/no-go do chmury (09-VERIFICATION.md)
- [ ] **A2F-05**: (MVP cloud, po go/no-go) Wrapper na Cloud Run GPU L4 **wyłącznie scale-to-zero (płacimy tylko za przetworzenie; min-instances=0 bez wyjątków; no-gpu-zonal-redundancy)**, autoryzacja, asynchroniczny front na cold start, alarm budżetowy; przełącznik `A2F (cloud)`; jeśli cold start wymagałby warm instancji → NO-GO (docs/7)

### v1.2 — UI dual-persona i modularny frontend (Faza 11)

Decyzje (2026-09-10): dwie warstwy — `user` (ładna scena + rozmowa + porównywarka algorytmów) i `studio` (schowane narzędzia tweakera, dostęp `?studio=1`/skrót); porównywarka działa na ostatniej turze (to samo audio+alignment; A2F z tym samym PCM); pełny, etapowany refaktor modułowy; realizacja równolegle z Fazą 9 po UAT 08-04. Szczegóły: `.planning/phases/11-*/11-CONTEXT.md`.

- [ ] **UI-01**: Dwie warstwy UI: `user` (dock rozmowy, captions, status, segment algorytmu) i `studio` (Animacja, Wizemy, Inspektor, A2F, Sesja, Scena) — dostęp `?studio=1` / skrót / persisted; funkcje deklarują warstwę przez `panel-registry` (`visibleIn`), przeniesienie funkcji między personami = zmiana jednego pola
- [ ] **UI-02**: Porównywarka algorytmów: segment `LIVE | A2F` + „Porównaj" odtwarzające tę samą wypowiedź w obu torach (to samo audio+alignment; A2F zasilony tym samym PCM), chipsy A/B, opcjonalny tryb blind („który lepszy?"); przełączenie mid-turn bez cięcia twarzy (deferToTurnEnd)
- [ ] **UI-03**: Scene presets: min. 3 presety tła/oświetlenia/kadru (studio-dark / studio-soft / cinema + sync z motywem jasnym), przełączalne w runtime i wybieralne przez usera; domyślny preset trzyma 60 FPS @ 1080p
- [ ] **UI-04**: Modularny frontend: `SettingsStore` (jeden schemat + precedencja defaults → profil tweakera → user), kontrolery w `src/features/`, panele zamiast god-object `hud.ts`, `main.ts` ≤ ~100 linii (composition root `app/container.ts`), markup paneli w modułach
- [ ] **UI-05**: Profil tweakera: export/import JSON, blokady ustawień dla usera (niewidoczne/disabled), zero martwych ustawień (`micSensitivity` podpięte albo usunięte)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Własne STT/VAD/LLM w v1 | ElevenAgents dostarcza całą pętlę serwerowo — pisanie własnego turn-taking to najtrudniejszy element, świadomie odraczamy (docs/2) |
| Full-body gestykulacja w MVP | Idle sway wystarczy do "żywości"; gesty wymagają retargetingu Mixamo — Faza 2 (docs/0) |
| WebGPU / DLSS5 / neural rendering | Brak dostępu do natywnych bibliotek GPU w sandboxie przeglądarki (docs/5) |
| Mobile (iOS Safari) w v1 | Polityka autoplay/mikrofonu na mobile wymaga osobnych testów; desktop-first (docs/0 ryzyka) |
| Gotowe UI produktowe w PoC | PoC używa minimalnego HUD; branded UI dopiero w F6 (docs/0) |
| Odtwarzanie audio przez SDK (`@elevenlabs/client`) | SDK gra audio sam → brak wspólnej osi czasu → dryf lip-syncu; surowy WSS daje pełną kontrolę (docs/2 decyzja) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AVAT-01 | Phase 1 | Complete |
| AVAT-03 | Phase 1 | Complete |
| AVAT-04 | Phase 1 | Complete |
| CONV-01 | Phase 2 | Complete |
| ROB-01 | Phase 2 | Complete |
| LIPS-01 | Phase 3 | Complete |
| LIPS-02 | Phase 3 | Complete |
| LIPS-03 | Phase 3 | Complete |
| CONV-02 | Phase 4 | Complete |
| CONV-03 | Phase 4 | Complete |
| CONV-04 | Phase 4 | Complete |
| CONV-05 | Phase 4 | Complete |
| AVAT-02 | Phase 4 | Complete |
| ROB-02 | Phase 4 | Complete |
| AVAT-05 | Phase 5 | Complete |
| AVAT-06 | Phase 5 | Complete |
| LIPS-04 | Phase 5 | Complete |
| ROB-03 | Phase 6 | Complete |
| ROB-04 | Phase 6 | Complete |
| ROB-05 | Phase 6 | Complete |
| ROB-06 | Phase 6 | Complete |
| LIPS-05 | Phase 7 | Complete (code+testy; UAT wizualny w 07-04) |
| LIPS-06 | Phase 7 | Complete (code+testy; UAT wizualny w 07-04) |
| LIPS-07 | Phase 7 | Complete (code+testy; UAT wizualny w 07-04) |
| UNA-01 | Phase 8 | Not Started |
| A2F-01 | Phase 8 | Not Started |
| A2F-02 | Phase 9 | Not Started |
| A2F-03 | Phase 9 | Not Started |
| A2F-04 | Phase 9 | Not Started |
| A2F-05 | Phase 10 | Not Started (po go/no-go z Fazy 9) |
| UI-01 | Phase 11 | Not Started |
| UI-02 | Phase 11 | Not Started |
| UI-03 | Phase 11 | Not Started |
| UI-04 | Phase 11 | Not Started |
| UI-05 | Phase 11 | Not Started |

**Coverage:**

- v1 requirements: 21 total
- v1.1 requirements (fix EN): 3 total
- v2.1 requirements (unified anim + A2F): 6 total
- v1.2 requirements (UI dual-persona): 5 total
- Mapped to phases: 35
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-01*
*Last updated: 2026-09-10 — dodano v1.2 (UI-01..UI-05, Faza 11: dual-persona + modularny frontend)*

