# Roadmap: Avatar

## Overview

Podróż od zera do działającego MVP awatara konwersacyjnego, podzielona na 6 epików-faz. Epiki 1-4 realizują **PoC** (wertykalny slice: render → głos → usta → przerwania, wg `docs/0-roadmap-poc-mvp.md`), epiki 5-6 podnoszą go do **MVP** (realizm, PL, emocje, produktyzacja). Każda faza kończy się działającym, demoowalnym produktem. **Kontrakt na koniec każdej fazy**: ostatni plan to retrospekcja i obowiązkowa korekta następnej fazy — rzeczywistość implementacyjna zawsze zdryfuje wobec planu, więc roadmapa żyje i poprawia się po każdym epiku. Kanon techniczny: `docs/1-6` (każdy plan nawiązuje do konkretnych sekcji).

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Fundament 3D** - Scena Three.js + MetaPerson GLB + oświetlenie studiem (PoC) (completed 2026-09-01)
- [x] **Phase 2: Kanał głosowy ElevenAgents** - Surowy WSS + mikrofon + odtwarzanie PCM gapless (PoC) (completed 2026-09-01)
- [x] **Phase 3: Lip-Sync i FaceController** - Alignment → wizemy ARKit + koartykulacja + mruganie (PoC) (completed 2026-09-01)
- [x] **Phase 4: Barge-in i szlif PoC** - Przerwania, twardość, metryki, kryteria akceptacji PoC (PoC) (completed 2026-09-01)
- [x] **Phase 5: Realizm i ożywienie** - SSS pre-integrated + PL lip-sync + proceduralne ożywienie (MVP) (completed 2026-09-01)
- [x] **Phase 6: Produktyzacja MVP** - Emocje, agent as code, signed URL, UI, kryteria MVP (MVP) (completed 2026-09-01)
- [ ] **Phase 7: Fonemowy lip-sync EN — naprawa płaskości** ⏸ (PAUZA — UAT 07-04 odroczony; resume po Fazie 10) - G2P + amplitudy + diagnostyka alignmentu (fix MVP EN)
- [ ] **Phase 8: Zunifikowany tor animacji + barge-in** - dwa źródła animacji (wizemy / ramki A2F), wspólna epoka barge-in (rdzeń, bez GPU)
- [ ] **Phase 9: Lokalny PoC NVIDIA Audio2Face (RTX 3090)** - Audio2Face-3D SDK (MIT, TensorRT) + rig z avatar.glb + REST wrapper + E2E offline + przełącznik A/B + go/no-go
- [ ] **Phase 10: A2F w chmurze — Cloud Run MVP (L4)** - po lokalnym go/no-go: deploy serverless GPU scale-to-zero (płacimy tylko za przetwarzanie), cold start, koszty, UAT
- [ ] **Phase 11: UI dual-persona i modularny frontend** - user/studio, porównywarka algorytmów, scene presets, refaktor modułowy (równolegle z Fazą 9)

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

- [x] 01-01: Szkielet aplikacji Vite + TypeScript + Three.js (pętla render, kamera, resize, HUD statusu, obsługa braku WebGL)
- [x] 01-02: Loader MetaPerson GLB — GLTFLoader/DRACO/KTX2, walidacja fail-fast REQUIRED_SHAPES, normalizacja nazw, synchronizacja sub-meshy mowy, `frustumCulled=false` (docs/1)
- [x] 01-03: Oświetlenie studiem PoC — 3-point + RoomEnvironment/HDRI + ACES + sheen/clearcoat skóry + anizotropia tekstur (docs/5, etap 1)
- [x] 01-04: **Retrospekcja i korekta Fazy 2** — learnings z loadera/rigu (realne nazwy blendshape'ów, rozmiar, tekstury) → aktualizacja szczegółów i planów Fazy 2 w ROADMAP.md + sync `docs/1`/`docs/5` z rzeczywistością

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

- [x] 02-01: Konfiguracja agenta ElevenAgents w dashboardzie (prompt systemowy, głos EN, model, client_events) + test dymny przez SDK `@elevenlabs/client` (docs/2, docs/6)
- [x] 02-02: Client surowego WSS — połączenie (public `agent_id`), `conversation_initiation_client_data`, parsowanie eventów (`audio`, `user_transcript`, `agent_response`, `ping`, `interruption`), reconnect z backoffem (docs/2)
- [x] 02-03: Przechwytywanie mikrofonu — AudioWorklet → resampling 16 kHz → base64 → `user_audio_chunk`; przycisk Talk odblokowujący AudioContext (docs/2, docs/4)
- [x] 02-04: AudioEngine — PCM → AudioBuffer (`createBuffer`+`copyToChannel`), harmonogram gapless na `ctx.currentTime`, prebuffer 2-3 chunki, sprzątanie `onended`, HUD transkrypcji z `user_transcript`/`agent_response` (docs/4)
- [x] 02-05: **Retrospekcja i korekta Fazy 3** — rzeczywisty kształt alignmentu (znaki znormalizowane, realne `char_durations_ms`), jitter sieci vs prebuffer, TTFB → aktualizacja planów Fazy 3 + sync `docs/2`/`docs/4`

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

- [x] 03-01: FaceController — state machine, epoch, jedyny właściciel morphów; interfejs `FaceDriver` (applyTargets/relaxToNeutral) implementowany na Three.js z synchronizacją sub-meshy mowy (docs/4, docs/1)
- [x] 03-02: Tabela mapowań EN → ARKit (znaki, dwuznaki z lookahead SH/CH/TH/PH/QU/WH/NG, heurystyka C, interpunkcja → mikropauza z domknięciem) — znormalizowany moduł danych (docs/3)
- [x] 03-03: Scheduler wizemów — kolejka z alignmentu, easing blend-in/hold/blend-out, additive blending z limitem, priorytet `mouthClose`, damping `1-exp(-λ·dt)`, reguła fundamentu (klucze bez wkładu → 0) (docs/3)
- [x] 03-04: Proceduralne mruganie + neutral idle między wypowiedziami (blinki podczas SPEAKING nie wyłączone) (docs/3 anty-robotyczność, docs/6)
- [x] 03-05: **Retrospekcja i korekta Fazy 4** — jakość wizemów na realnych głosach (co się nie zgadza w tabeli), tuning λ/dampingu, artefakty sub-meshy → aktualizacja planów Fazy 4 + sync `docs/3`

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

- [x] 04-01: Obsługa `interruption` end-to-end — epoch++ w AudioEngine i FaceController, `hardStop()` węzłów, RELAXING twarzy, `agent_response_correction` w transkrypcji HUD (docs/4)
- [x] 04-02: Telemetria + obsługa błędów — TTFB/drift/FPS w HUD, `vad_score` wskaźnik, reconnect backoff, graceful degrade (brak mic/WebGL) (docs/0, docs/2)
- [x] 04-03: Przebiegka akceptacyjna PoC — checklist z docs/0 (latencja, dryf 30 s, 10× barge-in, 10 min leak-free, FPS, rozmiar modelu) — wyniki zapisane w VERIFICATION.md fazy
- [x] 04-04: **Retrospekcja PoC i korekta Fazy 5** — decyzja go/no-go MVP na danych (nie na vibes): realne wąskie gardła (GPU vs sieć vs mowa), co z listy MVP wypadło/doszło → aktualizacja zakresu i planów Fazy 5 + sync `docs/0`/`docs/4`; ekstract learnings (decyzje → PROJECT.md)

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

- [x] 05-01: Pre-integrated SSS — `onBeforeCompile` (wrap diffuse + translucency term + maska grubości z albedo), uniformy tuningu, `customProgramCacheKey`, preset GPU quality-gate, A/B zrzuty referencyjne (docs/5)
- [x] 05-02: Moduł mapowań PL — dwuznaki (sz, cz, rz, ch, dź, dż), nosówki ą/ę, ł/ś/ć/ń/ź/ż; test wzrokowy na zdaniach kontrolnych PL (docs/3)
- [x] 05-03: Sakkady + shared attention — `eyeLook*` proceduralnie, cele co 1-4 s, koordynacja ze stanem agenta (docs/6)
- [x] 05-04: Mikroruchy głowy (Perlin na kościach Neck/Head, redukcja w mowie) + idle sway oddechu (docs/6)
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

- [x] 06-01: Emocje — client tool `set_emotion` (rejestracja w konfiguracji agenta, instrukcje w prompcie) → FaceController emotionBase pod wizemami, damping λ~3-6, `client_tool_result` zwrotny (docs/6)
- [x] 06-02: Agent as code + prywatność — konfiguracja przez ElevenLabs CLI w repo; backend endpoint `/signed-url` (xi-api-key server-side) → klient (docs/2)
- [x] 06-03: UI produktowe — mute mikrofonu (`setMicMuted`), wybór urządzeń, wskaźniki stanu, transkrypcja live z korekcjami (docs/2, docs/6)
- [x] 06-04: Przebiegka akceptacyjna MVP — pełny checklist z docs/0 + testy 10× barge-in, 10 min rozmowy, zapis wyników w VERIFICATION.md fazy
- [ ] 06-05: **Zamknięcie milestone'u MVP i plan Fazy 2** — retrospekcja całości (PoC→MVP): outcome'y decyzji w PROJECT.md (✓ Good / ⚠️ Revisit), wymogi → Validated, sync całości docs/, decyzje zakresowe dla Fazy 2 (Tryb B? gesty? MetaHuman?) → sekcja v2/EXP w REQUIREMENTS.md

### Phase 7: Fonemowy lip-sync EN — naprawa płaskości ⏸ (WSTRZYMANA)

> **Status (2026-09-02):** prace nad A2F (Fazy 8–10) mają priorytet. Plany 07-01..07-03 wykonane;
> **07-04 (manualny UAT) odroczony — resume po Fazie 10**. Kod fazy 7 pozostaje aktywny domyślnie
> (LIVE wizemy), nic nie jest cofane.

**Goal**: Mowa EN ma widoczną charakterystykę fonemów — domknięcia M/B/P, odróżnialne F/V, S/Z, O/U, A — bez fantomowych ruchów na literach niemych, z timingiem nadal zakotwiczonym w alignmentcie ElevenLabs.
**Depends on**: Phase 6
**Requirements**: LIPS-05, LIPS-06, LIPS-07 (+ re-walidacja LIPS-01, LIPS-02)
**Docs refs**: `docs/3-lip-sync-i-koartykulacja.md` (tabela mapowań, koartykulacja — zaktualizowana w 07-04), `.planning/phases/07-fonemowy-lip-sync-en/07-CONTEXT.md` (diagnoza: podwójna attenuacja amplitud + za wolna lambda + char→viseme bez G2P)
**Success Criteria** (what must be TRUE):

  1. Badge HUD dev pokazuje źródło alignmentu per sesję; ALIGN: EL potwierdzone (fallback wykrywalny, nie cichy) (LIPS-07)
  2. M/B/P: efektywny mouthClose ≥ 0.85 — widoczne pełne domknięcie warg w mowie (LIPS-06, re-walidacja LIPS-02)
  3. Litery nieme ("know", "though", "listen") nie generują ruchów ust bez dźwięku; "question" = 2 wizemy dla /ʃən/, nie 4 (LIPS-05)
  4. Wartości tabeli wizem są efektywne (jedno mnożenie × scale profilu, default 1.0); lambda per grupa mięśni (domknięcie ~1.7×, żuchwa ~1.55×, okrągłe ~1.0×, smile ~0.45×) (LIPS-06)
  5. Fallback bez alignmentu = tylko jawOpen ∝ energia RMS, bez fałszywych samogłosek (LIPS-07)
  6. Timing bez regresji: 30 s wypowiedzi bez dryfu (oś `AudioContext`), barge-in < 300 ms do neutralu, 60 FPS (re-walidacja LIPS-01, CONV-04, AVAT-02)
  7. G2P leniwie ładowane (osobny chunk, nie blokuje startu); degradacja do ścieżki char gdy niedostępne — awatar zawsze mówi

**Plans**: 4 plans

Plans:

- [x] 07-01: Diagnostyka źródła alignmentu — telemetria + badge HUD (EL vs fallback) + fallback akustyczny jaw-only bez fałszywych samogłosek (LIPS-07)
- [x] 07-02: Amplitudy — usunięcie podwójnej attenuacji w schedulerze (wartości tabeli = efektywne), pełne domknięcie M/B/P (closeScale ~1.0, usunięcie capa 0.28+0.5×jaw), lambda per grupa mięśni, presety = mnożniki 0.85/1.0/1.15 (LIPS-06)
- [x] 07-03: Warstwa fonemowa EN — CMUdict (`cmu-pronouncing-dictionary`, leniwy import) + reguły OOV, merge czasu (timing słów z EL, litery nieme wchłaniane), tabela ARPAbet→wizemy, integracja w FaceController z degradacją do char-path (LIPS-05)
- [ ] 07-04: Weryfikacja — przełącznik A/B phoneme/char w HUD, manualny UAT na agencie EN (fonemy, domknięcia, dryf, barge-in, FPS, badge ALIGN), zapis 07-VERIFICATION.md + sync docs/3

### Phase 8: Zunifikowany tor animacji + barge-in (rdzeń, bez GPU)

**Goal**: Jeden mechanizm napędzania twarzy dla dwóch źródeł animacji — (a) LIVE wizemy (obecne) i (b) absolutny strumień ramek (A2F/neuronowe) — ze wspólnym barge-in (epoka), jednym właścicielem morphów i state machine. Całość czysto kliencka, testowalna bez GPU (ramki syntetyczne).
**Depends on**: Phase 6 (Faza 7 wstrzymana) — **start po review-unifikacji A2F↔wizemy** (wynik przeglądu może zmienić zakres)
**Requirements**: UNA-01, A2F-01
**Docs refs**: `docs/7-audio2face-cloudrun.md` (architektura docelowa), `docs/4-audio-i-obsluga-przerwan.md` (epoka/barge-in), `.planning/phases/08-unified-animation-core/08-CONTEXT.md`
**Success Criteria** (what must be TRUE):

  1. FaceController ma dwa tryby animacji: `viseme` (scheduler + koartykulacja) i `frames` (wartości bezwzględne z ramek, bez wygładzania) — przełączalne w runtime
  2. Barge-in działa IDENTYCZNIE w obu: `epoch++` → drop ramek/queue + relaks twarzy <300 ms; brak pisarzy poza FaceController
  3. W trybie `frames` proceduralne mruganie jest wyłączalne (A2F niesie własne oczy) — domyślnie OFF w tym trybie
  4. Parser/normalizer wyjścia A2F (ARKit PascalCase, 52 shape'y) → nasz słownik morphów; nieznane shape'y pomijane bez błędu; JSON → tablica ramek `{timeSec, weights}`
  5. Playback ramek na osi `AudioContext.currentTime` (gapless z audio) — test z syntetycznym audio+ramkami: twarz trafia w ramki z dokładnością < 1 klatki
  6. Pełne pokrycie testami (`npm test`): nowe moduły + regresja faz 1–7

**Plans**: 4 plans

Plans:

- [x] 08-01: Absolutny tor ramek w FaceController — tryb `frames` (`feedFrames`/ramki wg `ctx.currentTime`), przełącznik trybu, barge-in (epoka) dla ramek, wyłączanie proceduralnego mrugania, state machine RELAXING po końcu ramek (testy)
- [x] 08-02: Parser/normalizer A2F — JSON `{fps, frames[{frame_time, blendshapes}]}` → `PoseFrame[]`, mapowanie ARKit PascalCase → nasz słownik (`shape-normalizer`), pomijanie nieznanych, walidacja (testy)
- [x] 08-03: Playback E2E (bez GPU) — nagranie ramek z pliku + audio → odtwarzanie gapless przez AudioEngine i FaceController(frames); tryb demo "frames" w HUD z syntetycznymi danymi (testy integracyjne)
- [ ] 08-04: Weryfikacja rdzenia (⏳ UAT przez Studio → Animacja po F11; 08-VERIFICATION.md przy domknięciu) — checklist: oba tryby, barge-in <300 ms, brak dryfu 30 s (syntetyczne), 60 FPS, regresja `npm test`; zapis 08-VERIFICATION.md

### Phase 9: Lokalny PoC NVIDIA Audio2Face (RTX 3090)

**Goal**: Działający lokalnie, bezgłowy Audio2Face (kontener NVIDIA/Docker) wystawiony przez REST wrapper — E2E offline: wav → ramki → playback w aplikacji, przełącznik A/B (LIVE wizemy vs A2F), porównanie jakości i barge-in. Zero kosztów chmury.
**Depends on**: Phase 8
**Requirements**: A2F-02, A2F-03, A2F-04
**Docs refs**: `docs/7-audio2face-cloudrun.md` (§4C lokalnie, §5 format), `docs/EN-visemes.md` (§6 zdania kontrolne)
**User setup**: RTX 3090 (24 GB) + CUDA 12.8+/TensorRT 10.13+ (Windows, bez kontenerow lokalnie; obraz produkcyjny Fazy 10 buduje Podman Desktop), konto Hugging Face (click-through licencji A2E; wagi NVIDIA Open Model License — darmowe), narzędzia `gcloud` niepotrzebne (później w Fazie 10)
**Success Criteria** (what must be TRUE):

  1. Audio2Face-3D SDK (MIT) działa lokalnie na RTX 3090 (TRT engines prebuild); realne wyjście zdumpowane do fixture; rig ARKit-52 wyekstrahowany z `avatar.glb` dla solvera
  2. Wrapper REST (FastAPI) `/predict`: wejście `.wav` (mono 16–44.1 kHz) → wyjście JSON ramek (52 ARKit wg solvera na naszym rigu, PascalCase, gzip, bez capu długości) wg formatu z docs/7 §5; RTF < 1× długość audio na RTX 3090
  3. Aplikacja odtwarza offline: audio + ramki zsynchronizowane (playback gapless); przełącznik HUD `LIVE visemes` / `A2F (lokalny)` działa bez przeładowania
  4. Barge-in w trybie A2F: stop audio <50 ms, twarz neutral <300 ms (drop reszty ramek przez epokę)
  5. Porównanie jakości na zdaniach kontrolnych (docs/EN-visemes.md §6) — raport 09-VERIFICATION.md + go/no-go do chmury
  6. Testy: pytest (wrapper: walidacja wejścia/wyjścia na syntetycznym audio), regresja `npm test` (klient)

**Plans**: 5 plans

Plans:

- [ ] 09-01: Środowisko lokalne A2F — klon SDK (MIT) + modele HF (v3.0 primary) + TRT engines prebuild, rig ARKit-52 z avatar.glb (extract_rig.py), dump realnego wyjścia do fixture; notatka setupu w docs (A2F-LOCAL.md)
- [ ] 09-02: Wrapper REST `/predict` (FastAPI) — akceptacja wav (resample mono 16 kHz), A2F v3.0 + IBlendshapeSolver na naszym rigu, konwersja na JSON ramek (gzip, carriesEyes, emotions[]); pytest na fixture z 09-01
- [ ] 09-03: Integracja offline w aplikacji — konfiguracja URL lokalnego serwisu, generowanie demo wav (ElevenLabs lub gotowy plik), POST → zapis ramek, playback trybem `frames` z Fazy 8
- [ ] 09-04: Przełącznik A/B + UX — HUD `LIVE / A2F`, te same zdania kontrolne, metryki czasu przetwarzania; barge-in w trybie A2F (test 10×)
- [ ] 09-05: Ocena jakości i go/no-go — nagrania obu rozwiązań, checklist naturalności/rozróżnialności wizemów, zapis 09-VERIFICATION.md, decyzja o Fazie 10

### Phase 10: A2F w chmurze — Cloud Run MVP (po lokalnym go/no-go)

**Goal**: Przeniesienie sprawdzonego wrappera A2F do Google Cloud Run z GPU L4 — **wyłącznie scale-to-zero (płacimy tylko za przetwarzanie; min-instances=0 bez wyjątków)** — z obsługą cold startu, autoryzacją i kontrolą kosztów; przełącznik `A2F (cloud)` w aplikacji. **Start wyłącznie po pozytywnym go/no-go z Fazy 9.**
**Depends on**: Phase 9 (go/no-go)
**Requirements**: A2F-05
**Docs refs**: `docs/7-audio2face-cloudrun.md` (§1–4, §6), `.planning/phases/10-a2f-cloud-mvp/10-CONTEXT.md`
**User setup**: konto GCP + quota L4 w regionie, `gcloud` (deploy przez agenta AI z CLI/MCP), budżet/alarm
**Success Criteria** (what must be TRUE):

  1. Kontener z wrapperem (SDK MIT, TRT prebuild) zdeployowany na Cloud Run (L4, scale-to-zero, no-zonal-redundancy, concurrency=1); `/status` i `/predict` odpowiadają po cold starcie
  2. Strategia cold startu: asynchroniczny front + pomiar czasu do 1. ramki (5×, budżet 0,5–1,5 min) — **bez prewarm/min-instances**; jeśli cold start nieakceptowalny → NO-GO chmury (polityka kosztowa)
  3. Autoryzacja: endpoint niepubliczny (IAM/klucz przez proxy) + CORS tylko dla naszej domeny; brak sekretów w kliencie
  4. Kontrola kosztów: metryki requestów/czasu do 1. ramki + alarm budżetowy; koszt per request ≈ $0,02–0,1 (min 1 min billable)
  5. E2E w aplikacji przez przełącznik (audio → cloud /predict → playback), barge-in <300 ms; `npm test` zielone; 10-VERIFICATION.md

**Plans**: 4 plans

Plans:

- [ ] 10-01: Deployment kontenera na Cloud Run (L4) — Dockerfile prod, `gcloud run deploy --gpu`, healthcheck, `/status`; pomiar cold startu
- [ ] 10-02: Bezpieczeństwo i topologia — niepubliczny endpoint + klucz/IAP, CORS, konfiguracja URL w aplikacji (`settings`), tryb "cloud"
- [ ] 10-03: UX cold startu + koszty — asynchroniczny front (bez prewarm/min-instances — polityka pay-per-processing), komunikaty oczekiwania w UI, telemetria requestów+czasu do 1. ramki, alarm budżetowy
- [ ] 10-04: UAT chmury — E2E, porównanie z lokalnym (jakość/latencja/koszt), barge-in, zapis 10-VERIFICATION.md

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6, następnie **8 → 9 → 10** (A2F), a **Faza 7 ⏸ (UAT) wznawia się po Fazie 10**.
**Phase 11 (UI) startuje po UAT 08-04 i biegnie równolegle z Fazą 9** (która czeka na instalacje sprzętowe po stronie człowieka); Faza 10 dokłada źródło „A2F (cloud)" do rejestru źródeł animacji z F11.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fundament 3D | 4/4 | Complete    | 2026-09-01 |
| 2. Kanał głosowy ElevenAgents | 5/5 | Complete    | 2026-09-01 |
| 3. Lip-Sync i FaceController | 5/5 | Complete    | 2026-09-01 |
| 4. Barge-in i szlif PoC | 4/4 | Complete    | 2026-09-01 |
| 5. Realizm i ożywienie | 4/4 | Complete    | 2026-09-01 |
| 6. Produktyzacja MVP | 4/4 | Complete    | 2026-09-01 |
| 7. Fonemowy lip-sync EN | 3/4 | Paused (UAT deferred → po Faze 10) | - |
| 8. Zunifikowany tor animacji | 3/4 | Kod 08-01..03 done ✅; 08-04 UAT ⏳ przez Studio (razem z UAT F11) | - |
| 9. Lokalny PoC Audio2Face | 0/5 | Not Started (czeka na środowisko) | - |
| 10. A2F Cloud Run MVP | 0/4 | Not Started (po go/no-go z Fazy 9) | - |
| 11. UI dual-persona | 6/7 | Executed — kod 7/7, automated PASS; UAT manualny pending (11-VERIFICATION §3) | - |

### Phase 11: UI dual-persona i modularny frontend — user/studio, scene presets, porównywarka algorytmów

**Goal**: Przebudowany frontend z dwiema warstwami — czysty, ładny widok *user* (rozmowa + widoczne porównanie algorytmów LIVE/A2F na tej samej wypowiedzi) i schowane *studio* dla tweakera (`?studio=1`/skrót) z kalibracją, wizemami, inspektorem, A2F i telemetrią; pod spodem modularny frontend (SettingsStore z profilami i blokadami, panel registry, cienki `main.ts`), a scena dostaje presety tła/oświetlenia. Start po UAT 08-04, równolegle z Fazą 9.
**Depends on**: Phase 8 (klient frames/A2F gotowy + UAT 08-04 zamknięty); równolegle z Phase 9; Phase 10 dokłada źródło `A2F (cloud)` do rejestru źródeł (bez zmian shella).
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05
**Docs refs**: `.planning/phases/11-ui-dual-persona-i-modularny-frontend-user-studio-scene-prese/11-CONTEXT.md` (decyzje), `docs/1` (warstwy abstrakcji), `docs/5` (oświetlenie/presety), `docs/6` (demo/prezentacja), `docs/0` (kryteria MVP), `TODO_humanInTheLoop.md`
**Success Criteria** (what must be TRUE):

  1. Domyślnie startuje tryb `user`: scena + dock rozmowy (Rozmowa/Stop, Wycisz, Przerwij) + segment algorytmu + captions; zero narzędzi dev na wierzchu. `?studio=1` lub skrót (Ctrl+Shift+D) odsłania studio; wybór persystuje (UI-01)
  2. „Porównaj" odtwarza **tę samą** wypowiedź w obu torach (to samo audio + alignment; A2F zasilony tym samym PCM) z chipsami A/B i opcjonalnym trybem blind „który lepszy?"; przełączenie algorytmu mid-turn nie tnie twarzy (deferToTurnEnd) (UI-02)
  3. Scena ma min. 3 presety (studio-dark / studio-soft / cinema + sync z motywem jasnym) przełączalne w runtime i wybieralne przez usera; domyślny preset trzyma 60 FPS @ 1080p (UI-03)
  4. Modularność: `main.ts` ≤ ~100 linii (composition root w `app/container.ts`); `hud.ts` rozbity na panele wg `panel registry` (`{id, title, mount, visibleIn: 'user'|'studio'}`); przeniesienie funkcji między personami = zmiana jednego pola; markup paneli w modułach, `index.html` tylko shell (UI-04)
  5. Jeden `SettingsStore`: wszystkie klucze localStorage w jednym schemacie, precedencja defaults → profil tweakera → user; profil export/import JSON; zablokowane ustawienia niewidoczne/disabled dla usera; `micSensitivity` podpięte albo usunięte (UI-05)
  6. `npm test` zielone (nowe: store precedencja/locki, ui-mode, panel registry, compare controller) + `npm run build` przechodzi; UAT F11 zapisany w 11-VERIFICATION.md

**Plans**: 7 plans

Plans:
**Wave 1**

- [x] 11-01: Fundament modułowy — `SettingsStore` (schemat v1 + `scenePresetManual`, precedencja defaults→studio→user, locki, write-through migracja legacy bez utraty kalibracji/wizemów), `UiMode` (`?studio=1`, Ctrl+Shift+D, persisted, `body[data-mode]`), `TypedEventBus` + shared UI primitives; bootstrap bez zmian wizualnych (UI-04, UI-05, UI-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 11-02: Composition root + kontrolery — `src/features/*` (conversation, animation, telemetry, scene), `AppEvents`/`AppServices`, `audio:chunk` z `sampleRate` (+ `getOutputSampleRate` w speech-backend), `src/app/container.ts`; `main.ts` ≤ ~100 linii (UI-04)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 11-03: Shared UI + PanelRegistry + StudioShell — `dom/toast/loader/modal`, kontrakt `{id,title,icon,mount,visibleIn}`, lazy taby, per-panel error boundary, testy (UI-01)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 11-04: Panele studia — Animacja/Wizemy/Inspektor/A2F/Sesja/Scena (1:1 z `hud.ts`) + nowe powierzchnie: ładowanie modelu (demo/.glb), locki ustawień, export/import profilu; usunięcie `hud.ts`, `settings-modal.ts`, markupa z `index.html` (UI-01, UI-05)
- [x] 11-05: Rdzeń porównywarki — `encodeWav`, `LastTurnBuffer` (jedno źródło PCM + sampleRate), `AnimationSourceRegistry` (F10 = wpis danych), `CompareController` (sekwencja A/B, blind, cancel, partial) + testy (UI-02)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 11-06: Warstwa user — dock rozmowy, status, captions, segment + Porównaj A/B, ustawienia z respektowaniem locków, mikrofon end-to-end (`deviceId`), a11y i stan błędu połączenia (UI-01, UI-02, UI-05)

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 11-07: Scene presets + szlif + UAT (kod gotowy; ⏳ UAT manualny pending — 11-VERIFICATION.md §3) — `SCENE_PRESETS` (studio-dark/soft/cinema/light) z tweenem 280 ms, tło/gradient z dispose, reduced-motion, picker usera, winieta CSS; docs + 11-VERIFICATION.md (60 FPS backstop, RMS < 1%) + retro F9/F10 (UI-03 + weryfikacja UI-01..UI-05)

---
*Roadmap konwencja: każda faza kończy się planem "Retrospekcja i korekta następnej fazy" — implementacja zawsze zmienia rzeczywistość; ten plan przenosi learnings do ROADMAP.md i docs/ zanim startuje kolejny epik.*
