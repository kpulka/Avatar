# Requirements: Avatar

**Defined:** 2026-09-01
**Core Value:** Płynna rozmowa głosowa z realistycznym awatarem — usta idealnie zsynchronizowane z mową, naturalne przerwania bez zamrożonej miny.

> Źródło prawdy technicznej: `docs/0-roadmap-poc-mvp.md` (kryteria akceptacji etapów) oraz `docs/1-6`. Każde wymaganie nawiązuje do konkretnych sekcji dokumentacji.

## v1 Requirements

### Konwersacja (CONV)

- [ ] **CONV-01**: Użytkownik może rozmawiać z awatarem głosem w czasie rzeczywistym — mikrofon → ElevenAgents (STT+LLM+TTS+turn-taking) → odpowiedź słowna (docs/2, Tryb A)
- [ ] **CONV-02**: Start odpowiedzi audio < 1,5 s od zakończenia wypowiedzi użytkownika (mierzalne: `user_transcript` → pierwszy event `audio`; docs/0)
- [ ] **CONV-03**: Użytkownik może przerwać wypowiedź awatara w dowolnym momencie — serwer wykrywa mowę, klient obsługuje event `interruption` (docs/4)
- [ ] **CONV-04**: Po przerwaniu: audio zamiera < 50 ms, twarz w stanie neutralnym < 300 ms, zero "uwięzionych" chunków (epoch; docs/4)
- [ ] **CONV-05**: Rozmowa 10 min bez wycieków pamięci (sprzątanie `AudioBufferSourceNode` w `onended`), bez trzasków między chunkami (PCM gapless + prebuffer; docs/4)

### Lip-Sync (LIPS)

- [ ] **LIPS-01**: Usta zsynchronizowane z mową EN — brak wyraźnego dryfu w wypowiedzi 30 s (alignment → scheduler wizemów na osi `AudioContext.currentTime`; docs/3, docs/4)
- [ ] **LIPS-02**: Spółgłoski wargowe M/B/P domykają wargi w momencie dźwięku (`mouthClose: 1.0` z priorytetem; docs/3) — test kontrolny PoC
- [ ] **LIPS-03**: Koartykulacja: płynne przejścia między wizemami (blend-in/hold/blend-out, additive blending, damping niezależny od FPS, wygaszanie do zera; docs/3)
- [ ] **LIPS-04**: Lip-sync PL: dwuznaki (sz, cz, rz, ch, dź, dż, th-like), nosówki ą/ę oraz heurystyka C (moduł PL tabeli mapowań; docs/3)

### Awatar / Render (AVAT)

- [ ] **AVAT-01**: Model MetaPerson `.glb` renderuje się w Three.js z walidacją fail-fast: brakujące blendshape'y ARKit → czytelny błąd + lista braków (docs/1)
- [ ] **AVAT-02**: 60 FPS @ 1080p na GPU klasy GTX 1060 / Apple M1 podczas aktywnej mowy (docs/0, docs/5)
- [ ] **AVAT-03**: Model < 25 MB; pierwszy render < 5 s @ 20 Mbps (docs/0, docs/1)
- [ ] **AVAT-04**: Skóra bez efektu plastiku w PoC: `MeshPhysicalMaterial` + sheen/clearcoat + oświetlenie 3-point + environment + ACES (docs/5, etap 1)
- [ ] **AVAT-05**: SSS pre-integrated na uszach/nosie/wargach w MVP: `onBeforeCompile` (wrap diffuse + translucency term + maska grubości), A/B zrzuty referencyjne (docs/5, etap 2)
- [ ] **AVAT-06**: Ożywienie: proceduralne mruganie, sakkady oczu, mikroruchy głowy (szum Perlina), idle sway (docs/6)

### Twardość / Produkt (ROB)

- [ ] **ROB-01**: Reconnect WSS z backoffem + obsługa błędów: brak mikrofonu, brak WebGL, restart rozmowy bez przeładowania strony (docs/2, docs/4)
- [ ] **ROB-02**: Telemetria dev: TTFB odpowiedzi, drift lip-syncu (log różnic czasów), FPS counter (docs/0)
- [ ] **ROB-03**: Agent prywatny przez signed URL z backendu — `xi-api-key` niewidoczny w sieci przeglądarki (MVP; docs/2)
- [ ] **ROB-04**: Konfiguracja agenta as code (ElevenLabs CLI, wersjonowana w repo) — zmiany promptu przez PR (MVP; docs/2)
- [ ] **ROB-05**: Emocje sterowane agentem: client tool `set_emotion` → baza emocjonalna blendshape'ów nakładana pod wizemy mowy, wolniejszy damping (MVP; docs/6)
- [ ] **ROB-06**: UI: przycisk Talk (unlock AudioContext), mute mikrofonu, wskaźnik stanu (listening/speaking), transkrypcja live (MVP; docs/2)

## v2 Requirements

### Rozszerzenia mowy i realizmu (Faza 2)

- **EXP-01**: Własny pipeline mózgu (Tryb B: Speech Engine / Multi-Context WS / Pipecat; docs/2, docs/6)
- **EXP-02**: Gestykulacja ciała z animacjami Mixamo (crossfade `AnimationMixer`; docs/1, docs/6)
- **EXP-03**: Lip-sync akustyczny (Rhubarb WASM / MFCC) dla języków bez fonetycznego zapisu (docs/3, docs/6)
- **EXP-04**: Alternatywny renderer: MetaHuman + Unreal Pixel Streaming lub HeyGen LiveAvatar (macierz docs/1, docs/6)
- **EXP-05**: Dodatkowe moduły językowe (tabela znak→wizem per język; docs/6)

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
| AVAT-01 | Phase 1 | Pending |
| AVAT-03 | Phase 1 | Pending |
| AVAT-04 | Phase 1 | Pending |
| CONV-01 | Phase 2 | Pending |
| ROB-01 | Phase 2 | Pending |
| LIPS-01 | Phase 3 | Pending |
| LIPS-02 | Phase 3 | Pending |
| LIPS-03 | Phase 3 | Pending |
| CONV-02 | Phase 4 | Pending |
| CONV-03 | Phase 4 | Pending |
| CONV-04 | Phase 4 | Pending |
| CONV-05 | Phase 4 | Pending |
| AVAT-02 | Phase 4 | Pending |
| ROB-02 | Phase 4 | Pending |
| AVAT-05 | Phase 5 | Pending |
| AVAT-06 | Phase 5 | Pending |
| LIPS-04 | Phase 5 | Pending |
| ROB-03 | Phase 6 | Pending |
| ROB-04 | Phase 6 | Pending |
| ROB-05 | Phase 6 | Pending |
| ROB-06 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-01*
*Last updated: 2026-09-01 after initial definition*
