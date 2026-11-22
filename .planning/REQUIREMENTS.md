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
- [ ] **A2F-02**: Lokalny Audio2Face-3D SDK (MIT; wagi HF NVIDIA Open Model License) na RTX 3090 + solver blendshape na rigu ARKit-52 z naszego `avatar.glb` + REST wrapper `/predict` (wav → JSON ramek, gzip, bez capu) — docs/a2f-local-setup.md
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

## v1.1 Requirements — Hardening & Showcase (Fazy 11.1–11.2, INSERTED 2026-11-19)

Źródło: `refactoring.md` (Rewizja, Rewizja 2), `11.1-CONTEXT.md`, `11.2-CONTEXT.md`.

### Hardening (Faza 11.1)

- [x] **HARD-01**: Embed bridge przyjmuje wiadomości wyłącznie od `window.parent` osadzonego widgetu z originu z allowlisty (lub same-origin); `document.referrer` nie wpływa na zaufanie; pusty origin nigdy nie jest zaufany; odpowiedzi idą na origin ostatniej zaufanej wiadomości
- [x] **HARD-02**: Brak zdalnej zmiany agenta (`avatar:set_agent` usunięte); `avatar:say` przycinane do 500 znaków; martwe `theme/autostart/model_url` usunięte
- [x] **HARD-03**: `?allow_any_origin` działa tylko w trybie dev (`import.meta.env.DEV`); poza dev targetOrigin nigdy nie jest `'*'`
- [x] **HARD-04**: agentId ma jedno źródło: URL `?agent_id=` > SettingsStore (`studio.agentId`) > domyślny; nic nie zapisuje `elevenlabs_agent_id`
- [x] **HARD-05**: Każdy `audio:chunk` niesie rzeczywisty sampleRate PCM (demo/say 44100, live wynegocjowany); obsługa `pcm_<rate>`, ostrzeżenie dla `ulaw_*`
- [x] **HARD-06**: Wymiana awatara zwalnia geometrie/materiały/tekstury/szkielety (bez envMap); `avatarInfo` ustawione przed `avatar:loaded`
- [x] **HARD-07**: Porównanie A/B: tor LIVE w trybie viseme, tor A2F w trybie frames, tryb przywracany; `run()` zwraca false przy porażce; pusta tura → błąd z toastem

### Showcase (Faza 11.2)

- [ ] **SHOW-01**: Widz bez agenta i mikrofonu uruchamia mowę awatara przyciskiem „Listen” (nagrany klip TTS + prawdziwy alignment + napisy, ten sam tor lip-sync co live)
- [x] **SHOW-02**: Widoczne, uczciwe stany błędów: odmowa mikrofonu, błąd/wyczerpanie prób WSS, błąd ładowania awatara (loader nie wisi), brak WebGL; `?studio=1` nie utrwala trybu studio
- [ ] **SHOW-03**: SSS skóry liczony od key light (uniformy kierunku/koloru w przestrzeni widoku), działa na przodzie twarzy
- [ ] **SHOW-04**: Cień key light wycentrowany na głowie (target + frustum ±0,35 m), cienie na wszystkich meshach awatara
- [ ] **SHOW-05**: Zegar lip-sync oparty na czasie słyszalnym (kompensacja `outputLatency`/`getOutputTimestamp`); `syncOffsetMs` zredukowany do reszty
- [ ] **SHOW-06**: Spółgłoski P/B/M czytelnie domykają usta (jaw≈0 + press + roll, `mouthClose` nisko — ochrona MetaPerson)
- [ ] **SHOW-07**: Oczy zachowują mapy normal/roughness z GLB; rogówka bez martwego override; rzęsy/włosy z alphaToCoverage
- [ ] **SHOW-08**: Środowisko softbox (PMREM) zamiast RoomEnvironment + adaptacyjny pixelRatio przy spadku FPS
- [x] **SHOW-09**: `public/models/avatar.glb` w repo (licencja po stronie właściciela); postęp ładowania; świeży klon pokazuje prawdziwego awatara
- [ ] **SHOW-10**: Nagranie hero (10–15 s) awatara mówiącego klip demo, gotowe dla README (faza 13)

## v1.1 Requirements — Portfolio Polish (Fazy 12–18)

Milestone v1.1 (2026-11): publiczne repo jako produkt rekruterski — język angielski, README pokazujący projekt z najlepszej strony, architektura udokumentowana i pilnowana testami, dopracowany UI, refaktor mechaniki animacji i lip-syncu na fonemach, oraz CI/licencja/deploy/higiena. Artefakty 12+ po angielsku (decyzja D2 w 12-CONTEXT); archiwa 01–11 zostają po polsku jako zapis historyczny. Każda faza ma własny CONTEXT z dowodami pomiarowymi.

### English-ization (I18N, Faza 12)

- [ ] **I18N-01**: Kanoniczne angielskie nazwy plików docs/ — 8 rename'ów przez `git mv` (rename-only commit, historia zachowana, `git log --follow` sięga sprzed rename)
- [ ] **I18N-02**: 10/10 plików docs/ przetłumaczone na EN (proza, nagłówki, tabele, komentarze w blokach kodu; struktura i numeracja sekcji zachowana; terminologia wg 12-DRAFT-glossary; polskie dane fonetyczne zostają z glossami)
- [ ] **I18N-03**: Integralność linków — każde odwołanie do ścieżki docs w egzekwowanym zakresie resolnowało; archiwa 01–11 wyłączone polityką, resolwowane przez rename-map w `.planning/README.md`
- [ ] **I18N-04**: Stringi UI po angielsku — wszystkie etykiety, przyciski, captions, status pill, aria-labels, toasty, loader/modale, panele, `lang="en"` w index.html; mapa dokładnych zastąpień w 12-05-PLAN
- [ ] **I18N-05**: Stringi deweloperskie po angielsku — console/Error/validate; tokeny techniczne nietknięte (testy zielone)
- [ ] **I18N-06**: Komentarze kodu EN w src/, style.css, vite.config.ts, index.html, nie-vendored a2f/; dane funkcjonalne (wizemy PL, keywords, test phrase) nietknięte
- [ ] **I18N-07**: Suite testowy EN — wszystkie describe/it i komentarze; fixture'e fonetyczne PL zachowane; 204+ testów zielonych
- [ ] **I18N-08**: Gate językowy `tests/language.test.ts` (diakrytyki z allowlistą + linki) w `npm test`; angielskie `.planning/README.md` (proces GSD, mapa faz, polityka językowa, rename-map); TODO_humanInTheLoop przetłumaczone in-place

### README showcase (READ, Faza 13)

- [ ] **READ-01**: Angielski README w repo root — struktura rekruterska: hero + wizual, zweryfikowany quickstart (≤ 4 komendy), highlights, tabela decyzji (wybór + odrzucona alternatywa + dlaczego), architektura ≤ 10 linii + link, indeks docs, status, proces (GSD), licencja; ≤ ~150 linii body
- [ ] **READ-02**: Truthfulness — zero nieaktualnych twierdzeń (usuń "etap dokumentacji / brak kodu" i "wymagany eksport modelu"); każde twierdzenie weryfikowalne w dniu pisania; wiersze statusu z datą "Verified"; praca eksperymentalna (A2F) oznaczona designed-not-running
- [ ] **READ-03**: Quickstart reprodukowalny — komendy wykonane na zimnym klonie i zapisane (13-02); troubleshooting pokrywa 3 realne frictions (agent_id, mic, port 5310)
- [ ] **READ-04**: Indeks docs — 10 kanonicznych nazw + 2 deep-dive'e (`docs/animation-runtime.md`, `docs/lipsync-deep-dive.md` z markerem do 16-07/17-06)
- [ ] **READ-05**: Zasoby wizualne (po Fazie 15) — hero ≤ 300 kB (dark), GIF talk+barge-in ≤ 3 MB/≤ 6 s, shot light-theme, social preview 1200×630; alt-teksty; budżety rozmiarów dotrzymane
- [ ] **READ-06**: Sloty wiarygodności — badge CI (18-03), licencja (18-02), demo (18-05) z dokładnymi URL w komentarzach placeholderów; linki wzajemne README ↔ ARCHITECTURE.md ↔ .planning/README.md

### Architecture guards (ARCH, Faza 14)

- [ ] **ARCH-01**: Kontrakt warstw — zmierzony stack (14-CONTEXT §1.1) udokumentowany i pilnowany przez `tests/layering.test.ts` (reguły modułowe jako dane w `layering-rules.ts`; wyjątki: para audio↔lipsync, features→app-contracts, app/store→domena); naruszenie = red `npm test`
- [ ] **ARCH-02**: Typecheck całego projektu — `tsconfig.test.json` (src+tests) + `npm run typecheck`; `noUncheckedIndexedAccess` ON; zero `any`/`@ts-ignore` w src (3 casty wyprowadzone); decyzja `exactOptionalPropertyTypes` zapisana (OFF, revisit v1.2)
- [ ] **ARCH-03**: Gwarancja lifecycle — po `container.dispose()` bus ma zero handlerów (regresja w container.test.ts przez test-only `handlerCount()`); wzorzec `disposables()`/Unsub udokumentowany jako obowiązkowy
- [ ] **ARCH-04**: Katalog eventów — 16 eventów AppEvents z payload/producer/consumer w ARCHITECTURE.md (wygenerowany z grepów `emit(`, nie z pamięci); konwencja nazw `domain:action`; invariants busa udokumentowane + testowane
- [ ] **ARCH-05**: Dead code usunięty — `eleven-client-smoke.ts`, `model-cache.ts` (+test) skasowane; `legacy-bridge.ts` z kryteriami usunięcia; one-shot sweep nieużywanych exportów z dyspozycjami (owned-by-16 przekazane)
- [ ] **ARCH-06**: Dyscyplina composition root — container.ts jedynym miejscem wiringu; zakaz module-level side-effect imports poza app/ui (reguła w gate'cie); main.ts ≤ ~100 linii
- [ ] **ARCH-07**: Seamy rozszerzeń udokumentowane — 5 przepisów "how to add" (panel, źródło animacji, preset sceny, event, speech backend) z listami plików
- [ ] **ARCH-08**: ARCHITECTURE.md w repo root (EN) — każde twierdzenie z dowodem file:line na moment pisania; linkowane z README i .planning/README.md; sekcje z datą "verified"

### Web UI refactor (UIX, Faza 15)

- [ ] **UIX-01**: Design tokens & theming — style.css sterowany custom properties (15-DRAFT-ui-spec); light theme działa end-to-end
- [ ] **UIX-02**: Typografia & targets — brak tekstu < 12 px; role typograficzne wg spec; targets ≥ 44 px
- [ ] **UIX-03**: Kontrakt shared primitives — toast `role=status` (błędy `role=alert`), loader, modal wg spec
- [ ] **UIX-04**: Accessibility — aria-live (polite) na captions/status/algo status; focus management w modale; contrast WCAG AA
- [ ] **UIX-05**: Stany & recovery — błąd połączenia = inline banner z retry (nie toast); każda powierzchnia ma zdefiniowany stan pusty/ładowanie/błąd
- [ ] **UIX-06**: Higiena feedbacku & compare UX — rutynowe zmiany stanu nie toastują; przebieg porównania A/B czytelny (który tor, kiedy, cancel widoczny)
- [ ] **UIX-07**: Integralność responsive — min viewport 1152×648 deklarowany; brak nakładania/ucięcia przy 125%/150% zoom
- [ ] **UIX-08**: Discoverability & first-run — ustawienia eksponują lock-respecting agent_id; studio wykrywalne ale nie nachalne
- [ ] **UIX-09**: Sloty microcopy — każdy string user-visible przez `src/app/copy.ts`
- [ ] **UIX-10**: System ikon (user layer) — dock/gear/close/presentation/status jako inline SVG (sprajt), bez zależności
- [ ] **UIX-11**: Higiena CSS — martwe reguły usunięte; glass/button zdeduplikowane; brak raw hex poza tokenami (gate)

### Animation mechanics refactor (ANIM, Faza 16)

- [ ] **ANIM-01**: Poprawność state machine — każda komórka macierzy 23 przejść zdefiniowana i testowana; żadna ścieżka nie tnie/twarzy twarzy na sztywno; interruption idempotentne; dev tools nie przecinają żywej tury
- [ ] **ANIM-02**: Single writer — FaceController jedynym modułem piszącym morphTargetInfluences; gaze przez provider seam; carriesEyes gate'uje każdego procedural eye writera; martwa pętla rAF relax usunięta
- [ ] **ANIM-03**: Kontrakt timebase — jedna udokumentowana polityka zegarów (audio dla mowy/ramek/blink; wall dla relax; rAF dla gaze); zegary iniektywalne; damping niezależny od FPS (testy)
- [ ] **ANIM-04**: Kompozycja warstw — jawna kolejność zapisu per-frame (udokumentowana w kodzie); scheduler dostaje subset kształtów mowy (foundation rule nie zeruje okolic oczu/brwi); jedna polityka emotion-mix w obu torach (0.3 — świadoma zmiana w frames, test parzystości); mouthClose priority raz
- [ ] **ANIM-05**: Ekstrakcja configu — wszystkie stałe tuningu w jednym typowanym module defaults; zero gołych magic numbers w logice runtime; CalibrationProfile bez zmiany schematu
- [ ] **ANIM-06**: Wydajność hot-path — zero alokacji per-frame w ścieżce SPEAKING (oba tory); scratch structures, in-place pruning; debug counters w testach
- [ ] **ANIM-07**: Ekstensybilność — trzecie źródło animacji rejestruje się i działa bez edycji FaceController; brak zamkniętych unionów w source specs; seam regionowy AvatarDirector udokumentowany
- [ ] **ANIM-08**: Dead code & naming — purgeStaleEpochs, relaxToNeutral, rodzina adaptive-prebuffer, epoch mirror, martwy fallback λ, unreachable emotion loop usunięte; zduplikowane stałe scalone; API queue-length spójnie nazwane
- [ ] **ANIM-09**: Pokrycie testami — pełna macierz przejść łącznie ze wszystkimi wyścigami (podwójne interruption, chunk/frames w RELAXING, mode-switch races, pendingMode drop); deterministyczne zegary zamiast fake-timer coupling
- [ ] **ANIM-10**: Sync docs — docs/4 sekwencja przerwania + docs/3 tabela wygładzania zaktualizowane do implementacji; deep-dive runtime gotowy do promocji; 16-VERIFICATION wykonany

### Lip-sync phonemes refactor (LIP, Faza 17)

- [ ] **LIP-01**: Pruned EN lexicon — leksykon G2P jako artefakt build-time (~10k słów) zamiast pełnego słownika (961 kB gzip); skrypt pruningu w repo; gate hit-rate ≥ 95% w testach
- [ ] **LIP-02**: Pokrycie reguł OOV — słowa z word-internal silent letters (island, listen…) przechodzą przez reguły poprawnie; testy na korpusie edge-case'ów
- [ ] **LIP-03**: Poprawność merge timingu — fony nie wychodzą poza okno czasowe słowa; reguły wchłaniania liter niemych testowane na alignmentach
- [ ] **LIP-04**: Rekoncyliacja tabela-dokument — phoneme-visemes.ts jako udokumentowane source of truth (tabela w docs zgadza się z kodem, drift wykrywalny)
- [ ] **LIP-05**: Ścieżka fonemowa PL — rule-based G2P (dwuznaki, softness-i, final devoicing, nosówki) bez słownika; degradacja do ścieżki char jawnie wykrywana
- [ ] **LIP-06**: Fallback honesty — jaw-only fallback bez fałszywych samogłosek; user mode pokazuje stan fallbacku (badge), nie udaje pełnego toru
- [ ] **LIP-07**: Quality harness — powtarzalny pomiar jakości w repo: fixture corpus + metryki (automatyczne) + protokół UAT (manualny) na zdaniach kontrolnych docs/en-visemes §6

### CI, security, license, deploy, hygiene (QUAL, Faza 18)

- [ ] **QUAL-01**: Sekrety & security — skan pełnej historii git (gitleak lub równoważne wzorce) → zero findings; `.env` w .gitignore; SECURITY.md (kanał disclosure, polityka public-agent-id); `xi-api-key` wyłącznie w kontekście polityki negatywnej
- [ ] **QUAL-02**: CI — `.github/workflows/ci.yml`: npm ci → typecheck → test → build na push/PR (ubuntu, Node 22, cache); zielony na main; badge w README; ≤ ~3 min
- [ ] **QUAL-03**: Licencja — LICENSE (wszystkie prawa zastrzeżone, decyzja właściciela) + THIRD-PARTY-NOTICES (audyt 2026-11-18: wszystkie permissive, zero copyleft) + sekcja licencyjna README
- [ ] **QUAL-04**: CONTRIBUTING — setup (Node 20+, 4 komendy), bramki (testy/language/layering/typecheck), proces GSD, zasady PR
- [ ] **QUAL-05**: Lint/format — ESLint (flat, typescript-eslint) z regułą layering z `layering-rules.ts` (single source z 14-02); Prettier; `lint`/`format:check` zielone; dwa osobne commity (fix violations / one-shot format); CI je uruchamia
- [ ] **QUAL-06**: Pages demo — build demo (`?demo=1`, base-path override) deployowany na push do main; demo = avatar + demo speech + synthetic A2F + bring-your-own agent_id (bez live conversation, chyba że owner zaakceptował koszt kwoty — D4); link w README
- [ ] **QUAL-07**: Higiena & metadane — dyspozycje `.bak`/config.json wykonane (decyzje ownera); `.gitignore` audytowany (dist, .env, a2f/sdk, a2f/.venv — `git ls-files` czysty); description/topics/social preview ustawione; TODO header przyjazny visitorowi
- [ ] **QUAL-08**: Anyone-can-verify — `npm run verify` (typecheck+test+build+lint+format) w package.json i README §Verification; zimny klon z samym Node.js przechodzi wszystkie bramki

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
| HARD-01..07 | Phase 11.1 | Verified by automated tests and drift reviews; manual UAT pending |
| SHOW-01..10 | Phase 11.2 | In progress; SHOW-02 and SHOW-09 passed wave 1 |
| I18N-01..08 | Phase 12 | Not Started (planned; CONTEXT+plany gotowe) |
| READ-01..06 | Phase 13 | Not Started (planned; DRAFT-README gotowy) |
| ARCH-01..08 | Phase 14 | Not Started (planned; DRAFT-ARCHITECTURE gotowy) |
| UIX-01..11 | Phase 15 | Not Started (planned; DRAFT-ui-spec gotowy) |
| ANIM-01..10 | Phase 16 | Not Started (planned; DRAFT-animation-runtime gotowy) |
| LIP-01..07 | Phase 17 | Not Started (planned; DRAFT-lipsync-deep-dive gotowy) |
| QUAL-01..08 | Phase 18 | Not Started (planned) |

**Coverage:**

- v1 requirements: 21 total
- v1.1 requirements (fix EN): 3 total
- v2.1 requirements (unified anim + A2F): 6 total
- v1.2 requirements (UI dual-persona): 5 total
- v1.1.x requirements (Portfolio Polish, Fazy 12–18): 58 total (I18N 8, READ 6, ARCH 8, UIX 11, ANIM 10, LIP 7, QUAL 8)
- Mapped to phases: 93
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-01*
*Last updated: 2026-11-18 — dodano v1.1 Portfolio Polish (Fazy 12–18: I18N/READ/ARCH/UIX/ANIM/LIP/QUAL, 58 wymagań)*

