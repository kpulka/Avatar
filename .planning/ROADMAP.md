# Roadmap: Avatar

## Overview

Podróż od zera do działającego MVP awatara konwersacyjnego, podzielona na 6 epików-faz. Epiki 1-4 realizują **PoC** (wertykalny slice: render → głos → usta → przerwania, wg `docs/0-roadmap-poc-mvp.md`), epiki 5-6 podnoszą go do **MVP** (realizm, PL, emocje, produktyzacja). Każda faza kończy się działającym, demoowalnym produktem. **Kontrakt na koniec każdej fazy**: ostatni plan to retrospekcja i obowiązkowa korekta następnej fazy — rzeczywistość implementacyjna zawsze zdryfuje wobec planu, więc roadmapa żyje i poprawia się po każdym epiku. Kanon techniczny: `docs/1-6` (każdy plan nawiązuje do konkretnych sekcji).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Fundament 3D** - Scena Three.js + MetaPerson GLB + oświetlenie studiem (PoC)
- [ ] **Phase 2: Kanał głosowy ElevenAgents** - Surowy WSS + mikrofon + odtwarzanie PCM gapless (PoC)
- [ ] **Phase 3: Lip-Sync i FaceController** - Alignment → wizemy ARKit + koartykulacja + mruganie (PoC)
- [ ] **Phase 4: Barge-in i szlif PoC** - Przerwania, twardość, metryki, kryteria akceptacji PoC (PoC)
- [ ] **Phase 5: Realizm i ożywienie** - SSS pre-integrated + PL lip-sync + proceduralne ożywienie (MVP)
- [ ] **Phase 6: Produktyzacja MVP** - Emocje, agent as code, signed URL, UI, kryteria MVP (MVP)

## Phase Details

### Phase 1: Fundament 3D
**Goal**: Statyczny, realistyczny awatar renderuje się w przeglądarce z walidowanym rigiem ARKit — baza pod wszystko.
**Depends on**: Nothing (first phase)
**Requirements**: AVAT-01, AVAT-03, AVAT-04
**Docs refs**: `docs/1-architektura-i-modele-3d.md` (loader, REQUIRED_SHAPES, sub-meshy, zasady), `docs/5-shadery-i-realizm.md` (etap 1: stock PBR, oświetlenie 3-point + environment + ACES, anizotropia, budżet FPS)
**Success Criteria** (what must be TRUE):
  1. Awatar MetaPerson `.glb` (bust/head) renderuje się po kliknięciu "Load" w aplikacji Vite+TS+Three.js
  2. Brakujące blendshape'y z REQUIRED_SHAPES → czytelny błąd z listą braków (fail-fast, nie cicha degradacja)
  3. Skóra renderuje się z sheen/clearcoat + 3-point lighting + environment + ACES — brak efektu plastiku na zrzucie referencyjnym
  4. Scena utrzymuje 60 FPS @ 1080p (statyczna) na GPU klasy GTX 1060/M1; model < 25 MB ładuje się < 5 s
**Plans**: 4 plans

Plans:
- [ ] 01-01: Szkielet aplikacji Vite + TypeScript + Three.js (pętla render, kamera, resize, HUD statusu, obsługa braku WebGL)
- [ ] 01-02: Loader MetaPerson GLB — GLTFLoader/DRACO/KTX2, walidacja fail-fast REQUIRED_SHAPES, normalizacja nazw, synchronizacja sub-meshy mowy, `frustumCulled=false` (docs/1)
- [ ] 01-03: Oświetlenie studiem PoC — 3-point + RoomEnvironment/HDRI + ACES + sheen/clearcoat skóry + anizotropia tekstur (docs/5, etap 1)
- [ ] 01-04: **Retrospekcja i korekta Fazy 2** — learnings z loadera/rigu (realne nazwy blendshape'ów, rozmiar, tekstury) → aktualizacja szczegółów i planów Fazy 2 w ROADMAP.md + sync `docs/1`/`docs/5` z rzeczywistością

### Phase 2: Kanał głosowy ElevenAgents
**Goal**: Awatar "umie mówić i słuchać": pełna pętla głosowa z agentem ElevenAgents bez animacji ust — audio gapless po naszej kontroli.
**Depends on**: Phase 1
**Requirements**: CONV-01, ROB-01
**Docs refs**: `docs/2-integracja-elevenlabs-wss.md` (Tryb A: endpoint, protokół C2S/S2C, signed URL/public agent, PCM 44.1 kHz, ping-pong), `docs/4-audio-i-obsluga-przerwan.md` (AudioEngine: createBuffer/copyToChannel, prebuffer, unlock AudioContext, `onended` cleanup), `docs/6-analiza-opensource-i-rozwoj.md` (SDK do testów agenta)
**Success Criteria** (what must be TRUE):
  1. Agent skonfigurowany w dashboardzie (prompt, głos EN, client_events) i zwalidowany przez `@elevenlabs/client` przed własnym WSS
  2. Klient mówi z awatarem przez surowy WSS `/v1/convai/conversation`: mic (AudioWorklet → PCM 16 kHz → base64) → odpowiedź audio z agenta
  3. Audio odtwarzane gapless przez AudioEngine (PCM 44.1 kHz, prebuffer 2-3 chunki, zero trzasków) po geście użytkownika (autoplay policy)
  4. Ping/pong utrzymuje połączenie; reconnect z backoffem działa po zerwaniu sieci (ROB-01)
**Plans**: 5 plans

Plans:
- [ ] 02-01: Konfiguracja agenta ElevenAgents w dashboardzie (prompt systemowy, głos EN, model, client_events) + test dymny przez SDK `@elevenlabs/client` (docs/2, docs/6)
- [ ] 02-02: Client surowego WSS — połączenie (public `agent_id`), `conversation_initiation_client_data`, parsowanie eventów (`audio`, `user_transcript`, `agent_response`, `ping`, `interruption`), reconnect z backoffem (docs/2)
- [ ] 02-03: Przechwytywanie mikrofonu — AudioWorklet → resampling 16 kHz → base64 → `user_audio_chunk`; przycisk Talk odblokowujący AudioContext (docs/2, docs/4)
- [ ] 02-04: AudioEngine — PCM → AudioBuffer (`createBuffer`+`copyToChannel`), harmonogram gapless na `ctx.currentTime`, prebuffer 2-3 chunki, sprzątanie `onended`, HUD transkrypcji z `user_transcript`/`agent_response` (docs/4)
- [ ] 02-05: **Retrospekcja i korekta Fazy 3** — rzeczywisty kształt alignmentu (znaki znormalizowane, realne `char_durations_ms`), jitter sieci vs prebuffer, TTFB → aktualizacja planów Fazy 3 + sync `docs/2`/`docs/4`

### Phase 3: Lip-Sync i FaceController
**Goal**: Usta awatara mówią w synchronizacji z głosem — rdzeń produktu.
**Depends on**: Phase 2
**Requirements**: LIPS-01, LIPS-02, LIPS-03
**Docs refs**: `docs/3-lip-sync-i-koartykulacja.md` (tabela mapowań EN z dwuznakami i lookahead, koartykulacja, easing, damping, reguła fundamentu), `docs/4-audio-i-obsluga-przerwan.md` (FaceController state machine, epoch, jedyny właściciel morphów), `docs/1` (interfejs FaceDriver, synchronizacja sub-meshy)
**Success Criteria** (what must be TRUE):
  1. `FaceController` (state machine IDLE→SPEAKING→RELAXING) jest jedynym modułem piszącym do `morphTargetInfluences`
  2. Wizemy planowane z `audio_event.alignment` na tej samej osi czasu co audio — brak wyraźnego dryfu w wypowiedzi 30 s (LIPS-01)
  3. M/B/P domyka wargi w momencie dźwięku (`mouthClose: 1.0` z priorytetem) — test kontrolny (LIPS-02)
  4. Przejścia płynne: blend-in/out, additive blending z clampem, damping FPS-niezależny, wygaszanie do zera — zero skoków pozycji ust (LIPS-03)
  5. Awatar mruga proceduralnie podczas mowy (2,5-6 s, zamknięcie 80 ms / otwarcie 200 ms) — sygnał "żywości"
**Plans**: 5 plans

Plans:
- [ ] 03-01: FaceController — state machine, epoch, jedyny właściciel morphów; interfejs `FaceDriver` (applyTargets/relaxToNeutral) implementowany na Three.js z synchronizacją sub-meshy mowy (docs/4, docs/1)
- [ ] 03-02: Tabela mapowań EN → ARKit (znaki, dwuznaki z lookahead SH/CH/TH/PH/QU/WH/NG, heurystyka C, interpunkcja → mikropauza z domknięciem) — znormalizowany moduł danych (docs/3)
- [ ] 03-03: Scheduler wizemów — kolejka z alignmentu, easing blend-in/hold/blend-out, additive blending z limitem, priorytet `mouthClose`, damping `1-exp(-λ·dt)`, reguła fundamentu (klucze bez wkładu → 0) (docs/3)
- [ ] 03-04: Proceduralne mruganie + neutral idle między wypowiedziami (blinki podczas SPEAKING nie wyłączone) (docs/3 anty-robotyczność, docs/6)
- [ ] 03-05: **Retrospekcja i korekta Fazy 4** — jakość wizemów na realnych głosach (co się nie zgadza w tabeli), tuning λ/dampingu, artefakty sub-meshy → aktualizacja planów Fazy 4 + sync `docs/3`

### Phase 4: Barge-in i szlif PoC
**Goal**: PoC kompletny: naturalne przerwania, twardość, metryki — spełnione wszystkie kryteria akceptacji PoC z docs/0.
**Depends on**: Phase 3
**Requirements**: CONV-02, CONV-03, CONV-04, CONV-05, AVAT-02, ROB-02
**Docs refs**: `docs/4-audio-i-obsluga-przerwan.md` (sekwencja przerwania, epoch++, hardStop, RELAXING 150-300 ms, race conditions), `docs/0-roadmap-poc-mvp.md` (kryteria akceptacji PoC + rejestr ryzyk), `docs/2` (`agent_response_correction`, vad_score w UI)
**Success Criteria** (what must be TRUE):
  1. Przerwanie użytkownika w dowolnym momencie wypowiedzi: audio stop < 50 ms, twarz neutral < 300 ms, zero zamrożeń miny — 10/10 losowych przerwań (CONV-03, CONV-04)
  2. Opóźnione eventy audio po `interruption` (race WS) ignorowane przez epoch — zero "uwięzionych" chunków
  3. TTFB < 1,5 s od końca wypowiedzi użytkownika (telemetria: `user_transcript` → pierwszy `audio`; CONV-02)
  4. Rozmowa 10 min: 60 FPS w mowie (AVAT-02), brak wycieków audio nodes (CONV-05), reconnect działa (ROB-01 z F2)
  5. HUD telemetrii dev: TTFB, drift log, FPS, `vad_score`, transkrypcja z `agent_response_correction` po przerwaniu (ROB-02)
**Plans**: 4 plans

Plans:
- [ ] 04-01: Obsługa `interruption` end-to-end — epoch++ w AudioEngine i FaceController, `hardStop()` węzłów, RELAXING twarzy, `agent_response_correction` w transkrypcji HUD (docs/4)
- [ ] 04-02: Telemetria + obsługa błędów — TTFB/drift/FPS w HUD, `vad_score` wskaźnik, reconnect backoff, graceful degrade (brak mic/WebGL) (docs/0, docs/2)
- [ ] 04-03: Przebiegka akceptacyjna PoC — checklist z docs/0 (latencja, dryf 30 s, 10× barge-in, 10 min leak-free, FPS, rozmiar modelu) — wyniki zapisane w VERIFICATION.md fazy
- [ ] 04-04: **Retrospekcja PoC i korekta Fazy 5** — decyzja go/no-go MVP na danych (nie na vibes): realne wąskie gardła (GPU vs sieć vs mowa), co z listy MVP wypadło/doszło → aktualizacja zakresu i planów Fazy 5 + sync `docs/0`/`docs/4`; ekstract learnings (decyzje → PROJECT.md)

### Phase 5: Realizm i ożywienie
**Goal**: Awatar MVP cz. 1: skóra "prześwituje" (SSS), mówi po polsku, żyje między zdaniami.
**Depends on**: Phase 4
**Requirements**: AVAT-05, AVAT-06, LIPS-04
**Docs refs**: `docs/5-shadery-i-realizm.md` (etap 2: pre-integrated SSS przez `onBeforeCompile` — wrap diffuse, translucency term, maska grubości, `customProgramCacheKey`; presety jakości GPU; realizm detali: oczy/włosy/zęby), `docs/3` (moduł PL: dwuznaki sz/cz/rz/ch, dź/dż, nosówki ą/ę), `docs/6` (sakkady, mikroruchy głowy szumem Perlina, idle sway, kolejność ROI ożywienia)
**Success Criteria** (what must be TRUE):
  1. SSS widoczny na uszach/nosie/wargach pod kontr-światłem (A/B zrzuty przed/po — LIPS… AVAT-05) z presetem wyłączanym na słabych GPU (60 FPS utrzymane)
  2. Pełny flow PL: pytanie po polsku → odpowiedź z poprawnym lips-synciem dwuznaków i nosówek (LIPS-04, kontrola wzrokowa `szczypczyzna`)
  3. Oczy patrzą "żywo": sakkady + shared attention (na użytkownika gdy mówi agent, w bok gdy "myśli") (AVAT-06)
  4. Mikroruchy głowy (1-2°, 0,2-0,5 Hz) i idle sway — amplituda redukowana podczas mowy (AVAT-06)
**Plans**: 5 plans

Plans:
- [ ] 05-01: Pre-integrated SSS — `onBeforeCompile` (wrap diffuse + translucency term + maska grubości z albedo), uniformy tuningu, `customProgramCacheKey`, preset GPU quality-gate, A/B zrzuty referencyjne (docs/5)
- [ ] 05-02: Moduł mapowań PL — dwuznaki (sz, cz, rz, ch, dź, dż), nosówki ą/ę, ł/ś/ć/ń/ź/ż; test wzrokowy na zdaniach kontrolnych PL (docs/3)
- [ ] 05-03: Sakkady + shared attention — `eyeLook*` proceduralnie, cele co 1-4 s, koordynacja ze stanem agenta (docs/6)
- [ ] 05-04: Mikroruchy głowy (Perlin na kościach Neck/Head, redukcja w mowie) + idle sway oddechu (docs/6)
- [ ] 05-05: **Retrospekcja i korekta Fazy 6** — koszt FPS SSS na realnym sprzęcie, jakość PL, czy ożywienie nie koliduje z mową → aktualizacja planów Fazy 6 + sync `docs/5`/`docs/6`

### Phase 6: Produktyzacja MVP
**Goal**: MVP kompletny: emocje sterowane agentem, bezpieczeństwo (signed URL), agent as code, UI produktowe, kryteria akceptacji MVP z docs/0.
**Depends on**: Phase 5
**Requirements**: ROB-03, ROB-04, ROB-05, ROB-06
**Docs refs**: `docs/6-analiza-opensource-i-rozwoj.md` (wariant 1 emocji: client tool `set_emotion` + prompt instrukcje; baza emocjonalna pod wizemy, wolniejszy damping), `docs/2` (signed URL z backendu, konfiguracja CLI as code, client_events), `docs/0` (kryteria akceptacji MVP)
**Success Criteria** (what must be TRUE):
  1. Awatar wyraża emocje: agent wywołuje `set_emotion` → mimika bazowa pod wizemami mowy (bez przeskoków), test na scenariuszu emocjonalnym (ROB-05)
  2. Klucz API niewidoczny w DevTools/Network; rozmowa idzie przez signed URL z backendu; agent prywatny (ROB-03)
  3. Prompt/głos/model agenta wersjonowane w repo przez ElevenLabs CLI (ROB-04)
  4. UI: mute, wybór urządzeń we/wy, wskaźnik stanu (listening/speaking/thinking), transkrypcja (ROB-06)
  5. Checklist akceptacyjny MVP z docs/0 w całości zielony (cold load, barge-in 10/10, PL, prywatność, SSS A/B)
**Plans**: 5 plans

Plans:
- [ ] 06-01: Emocje — client tool `set_emotion` (rejestracja w konfiguracji agenta, instrukcje w prompcie) → FaceController emotionBase pod wizemami, damping λ~3-6, `client_tool_result` zwrotny (docs/6)
- [ ] 06-02: Agent as code + prywatność — konfiguracja przez ElevenLabs CLI w repo; backend endpoint `/signed-url` (xi-api-key server-side) → klient (docs/2)
- [ ] 06-03: UI produktowe — mute mikrofonu (`setMicMuted`), wybór urządzeń, wskaźniki stanu, transkrypcja live z korekcjami (docs/2, docs/6)
- [ ] 06-04: Przebiegka akceptacyjna MVP — pełny checklist z docs/0 + testy 10× barge-in, 10 min rozmowy, zapis wyników w VERIFICATION.md fazy
- [ ] 06-05: **Zamknięcie milestone'u MVP i plan Fazy 2** — retrospekcja całości (PoC→MVP): outcome'y decyzji w PROJECT.md (✓ Good / ⚠️ Revisit), wymogi → Validated, sync całości docs/, decyzje zakresowe dla Fazy 2 (Tryb B? gesty? MetaHuman?) → sekcja v2/EXP w REQUIREMENTS.md

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fundament 3D | 0/4 | Not started | - |
| 2. Kanał głosowy ElevenAgents | 0/5 | Not started | - |
| 3. Lip-Sync i FaceController | 0/5 | Not started | - |
| 4. Barge-in i szlif PoC | 0/4 | Not started | - |
| 5. Realizm i ożywienie | 0/5 | Not started | - |
| 6. Produktyzacja MVP | 0/5 | Not started | - |

---
*Roadmap konwencja: każda faza kończy się planem "Retrospekcja i korekta następnej fazy" — implementacja zawsze zmienia rzeczywistość; ten plan przenosi learnings do ROADMAP.md i docs/ zanim startuje kolejny epik.*
