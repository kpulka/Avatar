# Refactoring — analiza i plan (do rewizji)

> **Status:** wersja robocza, data 2026-11-19. Dokument ma być przejęty przez innego agenta, który **zweryfikuje, zrewiduje i uzupełni** plan wg własnego uznania.
> Nic w kodzie nie zostało zmienione. Testy i `tsc` nie były uruchamiane przy analizie.
>
> **⚠ Zrewidowano 2026-11-19 — sekcja „Rewizja” na końcu ZASTĘPUJE sekcje 2, 3, 7 i 9.** Sekcje 1, 4–6, 8 pozostają aktualne z poprawkami wymienionymi w R5.

## 0. Instrukcja dla agenta przejmującego

1. Traktuj każde twierdzenie z sekcji 2–5 jako **hipotezę z pliku:linii** — zweryfikuj w kodzie, zanim zaczniesz na nim budować (numery linii mogły się przesunąć).
2. Zacznij od `.planning/ROADMAP.md`, `.planning/STATE.md` i `.planning/phases/12..18` (CONTEXT/PLAN) — plan poniżej zakłada ich kolejność i zakres.
3. Oceń sekcję 6 (decyzje) i 7 (kolejność) krytycznie: czy "nie robić osobnego sprintu" jest nadal słuszne? Co się gryzie z fazami?
4. Sekcja 9 to lista **otwartych pytań** — rozstrzygnij je albo oznacz jako decyzję dla użytkownika.
5. Nie edytuj kodu produkcyjnego bez zgody użytkownika; wynik rewizji zapisz jako sekcję "Rewizja" na końcu tego pliku (z datą i autorem).
6. Używaj `git ls-files`, nie skanuj `a2f/` ani `dist/` (ogromne).

## 1. Mapa projektu (skrót)

**Stos:** TypeScript, Vite (dev port 5310, strictPort), three.js 0.174, `@elevenlabs/client`, `cmu-pronouncing-dictionary`, vitest + jsdom. ~12k linii w `src/` (79 plików), 41 plików testów w `tests/`. `.planning/` = 184 z 330 śledzonych plików.

| Warstwa | Katalog | Rola |
|---|---|---|
| Kompozycja | `src/app/` | `container.ts` (`createApp`, ręczne DI, 345 l.), `events.ts` (TypedEventBus: stan kontrolery→UI), `app-types.ts` (`AppServices`: komendy UI→kontrolery), `ui-mode.ts`, `store/` (SettingsStore, schema, migrate, legacy-bridge) |
| Kontrolery | `src/features/` | animation, conversation, scene, scene-preset, compare, telemetry, last-turn-buffer |
| Audio | `src/audio/` | `speech-backend` (WSS ElevenLabs + mikrofon + odtwarzanie), `raw-wss-client`, `audio-engine` (gapless, epoch), `mic-capture`, `a2f-backend`, resampling, alignment-rescale, energy-fallback |
| Lip-sync | `src/lipsync/` | `face-controller` (723 l.), `viseme-scheduler`, `viseme-mappings`, `viseme-overrides`, `a2f-parser`, `animation-router/sources`, `calibration`, `procedural-blink`, `demo-frames`, `g2p/` |
| Render/scena | `src/core/`, `src/scene/`, `src/avatar/` | renderer, kamera, scena, materiały, skin-shader, loader awatara, test-avatar-generator, model-cache |
| Realizm | `src/realism/` | gaze-saccades, emotion-layer, head-micro-movements |
| Prod | `src/prod/` | embed-bridge (postMessage), telemetry |
| UI | `src/ui/` | `studio/` (panel-registry + 6 paneli + shell), `user/` (5 komponentów), `shared/` |
| Typy | `src/types/` | `audio.ts`, `avatar.ts` (kontrakty: SpeechBackend, FaceDriver, FramesClip) |

**Przepływ audio→avatar:** `speech-backend` (dekodowanie, alignment ElevenLabs lub energy-fallback) → event `audio:chunk` (`conversation-controller`) → `animation-controller` → `face-controller` (kolejka wizemów / G2P) → `render` (zegar `AudioContext.currentTime`) → `morphTargetInfluences`. Epoch odcina stare chunki. **Brak cykli importów.**

**Roadmap v1.1 "Portfolio Polish" (fazy 12–18), co już adresuje refaktor:**
- 12: tłumaczenie komentarzy/dokumentów na EN (dotyka wszystkich plików!)
- 13: README / dokumentacja
- 14: strictness (zero `any`), layering gate, test lifecycle/dispose, usunięcie `eleven-client-smoke.ts` i `model-cache.ts`, wycofanie `legacy-bridge`
- 15: tokeny CSS, light theme, `copy.ts`, Esc vs dialog, podpięcie `onAgentCorrection`, błąd mikrofonu
- 16: FSM w `face-controller`, single writer, config magic numbers, `clamp01`/limity, dokumentacja routera
- 17: wydzielenie `alignment-normalize.ts` ze `speech-backend` (+ testy 17-06), tabele znak→kształt (17-02), pruning CMU
- 18: demo na GitHub Pages (18-05: demo speech + pole BYO `agent_id`), secrets scan

## 2. Werdykt (do rewizji)

**Częściowo.** Osobny sprint refaktoringowy przed fazami 12–18 **nie** jest potrzebny — fazy 14–17 są w dużej mierze refaktorem, a refaktor przed fazą 12 oznacza podwójną pracę i konflikty (12 dotyka wszystkich plików, 16 przebudowuje `face-controller`). Zalecany jest **mały pakiet bugfixów + testów zabezpieczających** przed fazami (sekcja 7), bo plany go nie pokrywają, a dwa bugi uderzą w demo (18-05).

## 3. Potwierdzone bugi (niezależne od refaktoru)

| P | Wysiłek | Problem | Gdzie |
|---|---|---|---|
| P0 | S | Demo audio generowane przy 44100 Hz, a `audio:chunk` raportuje `getOutputSampleRate()` (domyślnie 16000) → czas tury w LastTurnBuffer/porównywarce A/B ~2,75× za długi, powtórka ze złą częstotliwością | `audio/speech-backend.ts:308`, `features/conversation-controller.ts:60` |
| P0 | S | **agentId split-brain:** `setActiveAgentId` pisze tylko do localStorage + zmiennej modułowej (`memoryAgentId`), omija store; `legacy-bridge` przy następnej zmianie ustawień nadpisuje klucz wartością `studio.agentId` → agent z embed/pola BYO cofa się | `conversation-controller.ts:145-147`, `audio/agent-config.ts:37,61-65`, `app/store/legacy-bridge.ts:19` |
| P1 | S | `avatar:loaded` emitowany przed ustawieniem `avatarInfo` → synchroniczny słuchacz dostaje `null` | `features/scene-controller.ts:98-109` |
| P1 | S | `clearAvatar` tylko `remove`, bez dispose geometrii/materiałów/tekstur → wyciek przy zmianie awatara | `core/scene.ts:84-89` |
| P1 | M | Emocje A2E gubione: parser ustawia `carriesEmotion`, `face-controller` wyciszą EmotionLayer, `clip.emotions` nie jest nigdzie aplikowane (dziś potencjalne — F9 jeszcze nie dostarcza A2E) | `lipsync/a2f-parser.ts:139`, `lipsync/face-controller.ts:522` |
| P2 | S | `ensureA2f` zwraca null → `run()` zwraca `true` (anulowanie tokenem `true` jest OK, porażka nie) | `features/compare-controller.ts:116,120` |

## 4. Co ruszać w ramach faz (nie osobno)

- `face-controller.ts` (723 l., ~6 odpowiedzialności) → **16-01/16-02**. Nie ciąć wcześniej.
- `speech-backend.ts` (354 l.: normalizacja 56-99, diagnostyka 233-298, demo 303-353) → **17-06**; wcześniej dopisać test kontraktu (brak `tests/speech-backend.test.ts`).
- `style.css` (1229 l., 0 custom properties, 141 hex, 11 `!important`, uszkodzone kodowanie `:898`) → **15-01**.
- Martwy kod: `eleven-client-smoke.ts`, `model-cache.ts` (tylko test), `calibration` load/save, `viseme-overrides` save/clear, nieużywane metody `FaceDriver`/`AudioEngine`/`FaceController`, pola `agent-config`, `compare:disposed`, `voice:error` bez słuchacza → **14**.
- Duplikacje: `Unsub` ×3 (`events.ts:9`, `settings-store.ts:21`, `ui/shared/dom.ts:5`), `isEditableTarget` ×2 + dwa handlery keydown (`ui-mode.ts:41,81`, `container.ts:263-267`), 4 tabele znak→kształt (17-02), `clamp01` ×3 i limit mouthClose 0.20 ×3 (16), wzorzec suwaka w 3 panelach, mocki testowe `MockFaceDriver` ×5 / `MockAudioContext` ×6.
- Typowanie: `getEffective<T=unknown>(path:string)` bez mapy klucz→typ (`settings-store.ts:85,113`), `string` zamiast unii (`settings-schema.ts:31,33`), `as any` w `speech-backend.ts:66`, `audio-engine.ts:50`, `meta-person-loader.ts:53` → **14-01**.
- `tsconfig` `include:["src"]` — testy nietypowane; `panel-registry.test.ts:26` używa nieimportowanego typu → **14**.

## 5. Czego NIE ruszać (YAGNI / już zaplanowane)

- Rozbijanie `container.ts` — 345 l. composition root to normalny rozmiar; wynieść tylko tryb prezentacji i pętlę FPS przy okazji 15 (A10).
- Typowana mapa `getEffective` osobno — dotyka wszystkich paneli tuż przed 15; robić w 14-01.
- Interfejs `SpeechBackend` — **już istnieje** (`types/avatar`); problem to tylko zależność containera od konkretnej klasy.
- `animation-router` — **nie jest martwy** (wołany per chunk, `animation-controller.ts:79`); nieużywane są tylko gałęzie poza `liveTurn:true` (punkt rozszerzeń F9/F10, dokumentuje 16-06).
- `headTarget` = root dotyczy tylko fallbacku bez kości — wybór projektowy.

## 6. Raporty, które okazały się przesadzone / błędne

- "animation-router martwy" — przesadzone (patrz wyżej).
- "SpeechBackend to klasa" — błędne.
- "Dispose niekompletny" — częściowo: brakuje dispose `conversationController`/`speechBackend` (WSS, mikrofon) i renderera; kontenerowe `Unsub` są odpinane. Zakres 14-03.
- "Korekty agenta niepodpięte" (`raw-wss-client.ts:152`) — prawda, już zaplanowane (15, S4).

## 7. Proponowana kolejność

**Przed fazami (≈ pół dnia, wszystko S):**
1. *Test-first (czerwone):* `tests/speech-backend.test.ts` (chunk dema niesie realny sampleRate; aliasy alignmentu → ten sam `CharAlignment`), `tests/agent-id.test.ts` (`setAgent` → `getEffective('agentId')` → wartość przeżywa kolejną zmianę store), test kolejności `avatar:loaded`/`avatarInfo`.
2. `fix(audio)`: sampleRate przekazywany razem z chunkiem w `onAudioChunk`.
3. `fix(settings)`: `setAgent` przez `store.setStudio('agentId')`, `getActiveAgentId` czyta ze store (URL nadal ma priorytet); `agent-config` dostaje wstrzykniętą funkcję.
4. `fix(scene)`: kolejność `avatarInfo` + dispose w `clearAvatar` (z testem).

**Dalej wg ROADMAP:** 18-01 → 12 → 13 → 15 → 16 → 17 → 14 → 18.

**Dopiski do planów faz:**
- 16-02: aplikacja `clip.emotions` (blend A2E) + test parytetu
- 14-04: jedno `Unsub`, jedno `isEditableTarget`
- 16-01: wspólne mocki w `tests/helpers/`
- 18-05: kryterium "zmiana agent_id przeżywa zmianę ustawień"
- 14-03: dispose conversation/speechBackend/renderer/AudioContext

## 8. Higiena repo i dokumentacji (niskie ryzyko, szybkie)

- `README.md:86-87` "Etap: dokumentacja (brak kodu w repo)" — nieprawda; brak instrukcji uruchomienia (port 5310 z `vite.config.ts:6`, wymagany `public/models/avatar.glb` ignorowany w `.gitignore`). Faza 13 ma `13-DRAFT-README.md`.
- Sprzeczność ścieżek TensorRT: `TODO_humanInTheLoop.md:64` (D:) vs `:84` i `a2f/README.md:29` (C:); `setup-tensorrt-from-pip.ps1:8` (D:), `build-sdk.ps1:14` (hardkod `D:\Projects\Avatar\a2f\sdk`). `TODO:95-96`/`a2f/README.md:12-17` wymieniają pliki, których nie ma w repo (`extract_rig.py`, `start.ps1`, `fixtures/`, `wrapper`).
- `inspector-panel.ts:2` "51 blendshape'ów" vs `README.md:20` "52 ARKit" (inspektor pomija `tongueOut`).
- `vite.config.ts:15` "~154 kB" vs `:24` "~750 kB".
- `.gitignore`: duplikat `a2f/.venv/` (:7, :43), `.playwright-report/` i `playwright-report/`.
- 6 plików DRAFT w `.planning/phases`, `.planning/prompts/review-a2f-unification.md`.
- Hardkodowany `agent_id` w `agent-config.ts:20` (zgodne z decyzją PoC; faza 18 planuje secrets scan).
- Nieaktualne komentarze "1:1 z hud.ts" (hud.ts nie istnieje) w 3 panelach; martwa kontrolka `micSelect` + tekst "dostępny po 11-06" (`session-panel.ts:45-47,143`).

## 9. Otwarte pytania dla rewizora

1. Czy pakiet z sekcji 7 (pre-faza) nie koliduje z fazą 12 (tłumaczenie komentarzy)? Rozważ wykonanie go **po** 12, jeśli konflikty merge okażą się kosztowne — kosztem ryzyka P0 przy demo (18-05 jest po 12, więc to prawdopodobnie bezpieczne).
2. Czy agentId powinien żyć w `studio` czy `user` scope w store? (Wpływa na locki i precedencję.)
3. Emocje A2E: czy F9 w ogóle zacznie je dostarczać? Jeśli nie — P1→P2 lub usunąć `carriesEmotion`/`clip.emotions`.
4. Wspólne mocki testowe: wpiąć w 16-01 czy zrobić od razu przy testach z kroku 1 (bo tam też potrzebne)?
5. Dlaczego `animation-controller.ts:79-81` woła `setAnimationMode` bez `deferToTurnEnd` (mid-turn przejście do IDLE wbrew `face-controller.ts:110-114`)? Zgłoszone przez agenta audio/lipsync, **nie zweryfikowane** przez Opusa — sprawdź.
6. Zgłoszone, a niezweryfikowane: `embed-bridge.ts:45-57,110,118-119` (referrer w allowlist, same-origin odrzucany przy niepustej liście, `?allow_any_origin=1` → `'*'`); `viseme-mappings.ts:282-296` (dwuznak zwracany dla obu liter → możliwa podwójna artykulacja); `g2p-en.ts:93-97` (reguła `-ed` gubi samogłoskę); `phoneme-merge.ts:77` (suma fonemów > czas słowa); `alignment-rescale.ts:15` vs `:32` (komentarz vs kod); `scene-preset-controller.ts:108-112` (nieosiągalna gałąź gradientu); `animation-controller.ts:241,263` (demo audio pobierane/dekodowane 2×). Oceń wagę każdego — w szczególności **embed-bridge** pod kątem bezpieczeństwa przed publikacją demo (faza 18).
7. Czy dodać `tests/` do `tsconfig` (osobny `tsconfig.test.json`) od razu, czy dopiero w 14-01?

## 10. Metodologia i ograniczenia

- 3 agenci (Haiku 5.5) mapowali: (a) audio+lipsync+types, (b) app/features/core/avatar/scene/realism/prod + konfiguracja, (c) UI/testy/docs/tooling. Agent Opus 5.5 zsyntetyzował ich raporty, zweryfikował kluczowe pozycje w kodzie (`face-controller`, `container`, `settings-store`/`legacy-bridge`/`agent-config`, `speech-backend`, plus grep po `.planning/phases/12..18`) i skorygował sekcję 6.
- Nie uruchamiano `tsc`, `vitest` ani aplikacji. Pokrycie testowe to heurystyka po nazwach plików.
- Bez zweryfikowania pozostają pozycje z sekcji 9 pkt 5–6.

---

## Rewizja

**Data:** 2026-11-19 · **Autor:** Claude Opus 5.5 (orkiestracja) + 7 subagentów (Haiku 5.5 i Opus) do weryfikacji w kodzie · **Kod:** bez zmian.

### R0. Baseline (uruchomione, nie heurystyka)

- `tsc --noEmit` (include `src`): **0 błędów**. `vitest run`: **41/41 plików, 209/209 testów zielonych**.
- `tsc` na `tests/` (flagi CLI, poza `tsconfig`): **12 błędów**: 9× TS6133 (nieużywane), 2× TS2349 (`compare-controller.test.ts:207,238`), 1× TS2304 (`panel-registry.test.ts:26`). To realny dług, który 14-01 (`tsconfig.test.json`) odsłoni. Lepiej znać go teraz.
- Brak `.github/workflows`: nic nie uruchamia `tsc` ani testów automatycznie. Brak `SECURITY.md` i konfiguracji gitleaks (zaplanowane w 18-01).

### R1. Zmiana werdyktu

Teza z §2 („osobny sprint niepotrzebny, mały pakiet przed fazami”) **się utrzymuje**, ale pakiet trzeba **rozszerzyć o bezpieczeństwo embed-bridge**. To blokuje publikację demo, a żaden plan faz tego nie pokrywa: 18-01 tylko „weryfikuje dokumentację” allowlisty. Obawa z §9.1 o konflikty z fazą 12 jest **nieistotna**: praca idzie sekwencyjnie na jednej gałęzi, więc 12 po prostu przetłumaczy już poprawiony kod. Jedyne ryzyko to R-8 z 12-CONTEXT (14-01 vs 12-06 na `speech-backend.ts`), a ono nie dotyczy pakietu.

**Nowe ryzyko krytyczne (wcześniej niewidoczne):** `public/models/avatar.glb` **nie jest w repo**. `.gitignore:49` ignoruje `public/models/*.glb`, a commit d05a18b celowo usunął „obcy model” przed push. Mimo to 13-02 („GLB in repo”), 15-CONTEXT:106 („committed”), 18-05 i 18-06 (~11,9 MB) zakładają, że model jest w repo. Świeży klon i GitHub Pages pokażą tylko fallback, czyli awatara demo (`scene-controller.ts:59-65`). **Decyzja dla użytkownika (D1)**.

### R2. Zweryfikowana lista bugów (zastępuje §3)

| ID | P | W | Problem (zweryfikowany) | Gdzie | Uwagi do §3 |
|---|---|---|---|---|---|
| S1 | **P0** | S | `document.referrer` dodawany do allowlisty → strona, która osadzi widget lub otworzy go przez `window.open`, jest zaufana i może wysłać `avatar:connect` (WSS + mikrofon bez kliknięcia, jeśli uprawnienie przyznane), `say`, `set_agent` | `prod/embed-bridge.ts:48-57` | nowe (z §9.6). Zweryfikowane osobiście |
| S2 | **P0** | S | `avatar:set_agent` z postMessage bez walidacji → trwała podmiana agenta (localStorage), do którego trafia głos użytkownika | `embed-bridge.ts:147-149` → `conversation-controller.ts:145` → `agent-config.ts:61-66` | nowe |
| S3 | P1 | S | `?allow_any_origin=1` działa w buildzie produkcyjnym: wejście bez kontroli, wyjście `'*'` (transkrypcje, odpowiedzi agenta) | `embed-bridge.ts:44-45,117` | nowe |
| S4 | P2 | S | `targetOrigin()` bierze pierwszy element Setu, a nie origin rodzica → zdarzenia mogą trafić pod zły origin (bez wycieku, rodzic ich nie dostaje). Do tego `isOriginTrusted` ufa pustemu `origin` (`:112`) | `embed-bridge.ts:108-120` | nowe |
| B1 | P0 | S | sampleRate dema: generowane i odtwarzane przy 44100, raportowane jako 16000. **Zasięg szerszy niż w §3:** oprócz LastTurnBuffer (×2,76) także `compare-controller.ts:106` (zły czas oczekiwania ~6,8 s), `:193,:231` (powtórka ×2,76 wolniej i ~1,5 oktawy niżej), `:203` (nagłówek WAV 16 kHz wysyłany do A2F `/predict` → A2F dostaje złe audio). Tor live nie jest dotknięty | `audio/speech-backend.ts:303-353`, `conversation-controller.ts:55-61` | potwierdzone, rozszerzone |
| B2 | P0→**P1** | S | agentId split-brain. **Korekta:** cofa się agent ustawiony przez **embed** (`set_agent`), a **nie** BYO: `session-panel.ts:31-32` pisze do store i do klucza tą samą wartością. Embed jest nadpisywany przy każdym zapisie store (nawet zmiana głośności) i przy przeładowaniu (bridge synchronizuje przed `start()`). Po S2 (usunięciu `set_agent`) bug nie ma wyzwalacza, ale zostaje dwuźródłowa architektura | `agent-config.ts:42-66`, `legacy-bridge.ts:19,29` | potwierdzone, przeszacowane |
| B3 | P1 | M | Pas LIVE w porównaniu A/B przy trybie A2F jest nieruchomy: wizemy trafiają do kolejki, ale `render` idzie gałęzią frames i je pomija | `compare-controller.ts:195`, `face-controller.ts:558-561` | nowe |
| B4 | P1 | S | `clearAvatar` bez dispose → wyciek GPU przy każdej zmianie awatara. Zasoby nie są współdzielone, więc dispose jest bezpieczny | `core/scene.ts:84-89` | potwierdzone |
| B5 | P2 | S | `setAnimationMode` bez odroczenia: przełączenie na A2F w przerwie audio w trakcie tury LIVE (stan RELAXING) zeruje usta, a kolejny chunk resetuje je drugi raz | `animation-controller.ts:81,302`, `face-controller.ts:120,686` | §9.5 rozstrzygnięte: realne, ale wąskie |
| B6 | P2 | S | `ensureA2f` null: przy błędzie zwraca `true`. Przy pustym PCM brak stanu `'error'`, a status „przetwarzanie…” zostaje na ekranie | `compare-controller.ts:116,120,201,211` | potwierdzone, doprecyzowane |
| B7 | P2 | S | `phoneme-merge`: dolny limit 35 ms na fonem → suma przekracza czas słowa (5 fonemów w 100 ms daje ~175 ms) i rozjeżdża się z audio. Nagłówek `:7` twierdzi, że suma = słowo | `lipsync/**/phoneme-merge.ts:24,76-77` | nowe |
| B8 | P2 | S | Dwuznak (`th`, `sh`) mapowany na 1. literze, a 2. litera dostaje własny kształt (np. impuls H). Dotyczy tylko silnika `char` i fallbacku przy ładowaniu G2P | `viseme-mappings.ts:286-291`, `face-controller.ts:338-363` | §9.6: częściowe |
| B9 | P2 | S | `-ed` w G2P pomija `e` **i** `d` (gubi IH + D/T). Tylko dla słów spoza CMU (wanted/played/jumped są w słowniku) | `g2p/g2p-en.ts:93-97` | §9.6: częściowe, mniejszy zasięg |
| B10 | P3 | S | `alignment-rescale`: komentarz `:15` przeczy kodowi `:32` (clamp [0.5, 2.0]). Nagłówek mówi o proporcjach do 2,5×, więc przy MAX 2.0 zostaje dryf | `audio/alignment-rescale.ts:7-15,32` | potwierdzone |
| B11 | P3 | S | `avatar:loaded` przed `avatarInfo`: dziś bez skutku, bo słuchacze używają payloadu | `scene-controller.ts:98,105` | P1→**P3** |
| B12 | P3 | S | Demo audio dekodowane 2× (tylko w fallbacku, gdy A2F zawiedzie) | `animation-controller.ts:241-244,263-272` | potwierdzone |
| — | — | — | Emocje A2E: `clip.emotions` nie ma producenta (`a2f-backend` tylko parsuje, demo ustawia `carriesEmotion:false`, kodu serwera brak w repo) | `a2f-parser.ts:148`, `face-controller.ts:183-187,522` | P1→**martwy kod**; patrz D3 |

### R3. Zrewidowany pakiet „przed fazami” (zastępuje §7, ok. 1 dzień)

Kolejność: najpierw testy (czerwone), potem poprawka, jeden commit na każdy punkt.

1. **`fix(embed)` — S1+S2+S3+S4** (blokuje publikację):
   - usunąć `fromReferrer`. Ufać tylko `options.allowedOrigins` i `?parent_origin=`, a do tego sprawdzać `event.source === window.parent` (lub `window.opener`, jeśli to celowe).
   - usunąć `avatar:set_agent` z mostu (callback `onSetAgent` i ścieżka w `conversation-controller`). **Nie** ruszać pola BYO, bo jego wartość wpisuje sam użytkownik (patrz D2).
   - `allow_any_origin` tylko pod `import.meta.env.DEV`.
   - odpowiadać na `event.origin` ostatniej zaufanej wiadomości. Nie ufać pustemu origin, gdy działa jako iframe.
   - limit długości `say` (np. 1000 znaków). Usunąć martwe `model_url`, `autostart`, `theme` (`:92-94`), zanim ktoś podłączy `model_url`.
   - testy: `tests/embed-bridge.test.ts` (referrer ignorowany, `set_agent` ignorowany, `allow_any_origin` w PROD bez efektu, `targetOrigin`).
2. **`fix(settings)` — B2:** store jako jedyne źródło. `getActiveAgentId` = URL `?agent_id` > `store.getEffective('agentId')` > domyślny. `setActiveAgentId` i zapis do localStorage do usunięcia. `legacy-bridge` traci mirror klucza. Test: wartość BYO przeżywa zapis innego ustawienia i reload. **Uwaga:** samo usunięcie zapisu do localStorage bez przełączenia odczytu na store zgubi BYO po reloadzie.
3. **`fix(audio)` — B1:** demo generowane przy `this.getOutputSampleRate()` (lub sampleRate jako część chunka). Test w nowym `tests/speech-backend.test.ts` (patrz D5 o 17-03).
4. **`fix(scene)` — B4 (+B11 przy okazji):** dispose geometrii, materiałów i tekstur w `clearAvatar`. Test z licznikiem `dispose` na mockowanych zasobach.
5. **`fix(compare)` — B3+B6:** early-return w `onAudioChunk`, gdy `animationMode==='frames'`, albo wymuszony tryb viseme na czas pasa LIVE. `run()` zwraca `false` przy błędzie, a gałąź `!pcm` ustawia `'error'`.

B5, B7–B10, B12 **nie** idą do pakietu. Dopisać je do faz (R4).

### R4. Dopiski do planów faz (zastępują listę z §7)

| Plan | Dopisek |
|---|---|
| **ROADMAP** | Wstawić pakiet R3 przed 18-01 jako fazę decimal (np. `11.5`) lub `/gsd-quick`, żeby miał swoje miejsce w trackingu. Dziś nigdzie go nie ma |
| **13-02, 15-CONTEXT:106, 18-05, 18-06** | Poprawić założenie „GLB w repo” zgodnie z D1 |
| **13-DRAFT-README:35, 18-05, UIX-08 (15)** | Spójny opis BYO: pole w ustawieniach zapisywane w store, `?agent_id=` ma priorytet. Nie wspominać `set_agent` ani `allow_any_origin` jako funkcji |
| **18-01** | Rozszerzyć z „verify documented” do testów z R3.1 (regresja) + sekcja „Embedding” w `SECURITY.md`. Dodać: dozwolone domeny i limity dla agenta w panelu ElevenLabs (publiczny `agent_id` w bundlu) |
| **14-01** | Uruchomić baseline `tsc` na testach **teraz** (R0: 12 błędów), nie po 15/16/17. Plan każe zrobić baseline „przed zmianą”, ale 14 jest wykonywana po 15–17 |
| **14-03** | Asercje dispose: `speechBackend`, `conversationController`, renderer, `AudioContext` (dziś tylko bus) |
| **14-04** | Jedno `Unsub` (3 definicje). `isEditableTarget` jest jednym helperem plus jednym wpisanym w kod sprawdzeniem w `container.ts:266`, więc ujednolicić. Usunąć `voice:error` (emitowany bez słuchacza) i `compare:disposed` (tylko deklaracja) |
| **14-05** | Dodać `depends_on: 16, 17` w frontmatterze. Dziś ta zależność istnieje tylko w ROADMAP:285 |
| **16 / ROADMAP** | Rozstrzygnąć konflikt: 16-CONTEXT:378-381 zaleca 16 przed 12, a ROADMAP ma 12 przed 16. Rekomendacja: zostawić 12 przed 16 i przed 16 zrobić re-anchor numerów linii (plany i tak cytują linie, które przesunie pakiet R3) |
| **16-01/02** | B5 (odroczenie przełączenia trybu, gdy stan ≠ `IDLE`). Usunąć `clip.emotions`/`carriesEmotion` (D3). Wspólne mocki w `tests/helpers/` (`MockFaceDriver` ×5, `MockAudioContext` ×6). Nazwana stała dla limitu mouthClose 0.20 (`face-controller.ts:653,670,679`) + `FRAME_CLOSE_CAP`/`CLOSE_SAFETY_CAP` |
| **17-03 / 17-06** | **Duplikat zakresu:** obie wyciągają normalizację alignmentu. Usunąć Task 1 z 17-06 |
| **17** | B7 (normalizacja sum w `phoneme-merge`), B8 (pomijanie 2. litery dwuznaku), B9 (`-ed` → IH + D/T), B10 (komentarz + rozważyć MAX 2.5). Testy dla każdego, bo dziś żaden z nich nie jest pokryty |
| **18 (nowe)** | Minimalne CI (`.github/workflows`: `tsc`, typecheck testów, `vitest`, gitleaks). Dziś nic tego nie pilnuje |

### R5. Poprawki do sekcji 1, 4–6, 8

- §4 „Martwy kod”: `compare:disposed` jest tylko zadeklarowany (`app-types.ts:67`), nie emitowany. `isEditableTarget` ×2 → 1 funkcja + 1 sprawdzenie wpisane w kod. Do usunięcia dochodzi `DEFAULT_AGENT_CONFIG.outputAudioFormat` (`agent-config.ts:12,23`), bo nigdy nie jest wysyłany w URL WSS. Formaty audio spoza 16k/24k/44,1k/48k (`ulaw_8000`, `pcm_22050`) są po cichu ignorowane (`speech-backend.ts:46-52`).
- §4 „Duplikacje”: `clamp01` ×3 potwierdzone (`a2f-parser.ts:154`, `demo-frames.ts:29`, `face-controller.ts:23`). `as any`: 4 wystąpienia w 3 plikach.
- §8: `vite.config.ts:15` vs `:24` to nie sprzeczność, tylko złe nazewnictwo (750 kB = three 596 + aplikacja 154). Brak GLB jest złagodzony przez fallback demo (R1). `style.css:898` to jedyne miejsce ze zniszczonym kodowaniem.

### R6. Odpowiedzi na §9

1. Kolizja z fazą 12: **nie** (praca sekwencyjna, R1). Pakiet wykonać **przed** 18-01/12.
2. agentId: scope **`studio`** zostaje (pole BYO już tam pisze). Klucz decyzji: jedno źródło (R3.2), a nie zmiana scope. Ostatecznie: D2.
3. Emocje A2E: brak producenta → usunąć (D3).
4. Wspólne mocki: w 16-01. Pakiet R3 wymaga tylko prostych mocków `three` i `AudioContext`, więc nie warto tego przyspieszać.
5. `setAnimationMode`: realne, wąskie → B5, faza 16.
6. Wszystkie pozycje sprawdzone (R2). embed-bridge **blokuje publikację**.
7. `tsconfig.test.json`: w 14-01, zgodnie z planem, ale baseline błędów już jest (R0).

### R7. Decyzje dla użytkownika (→ rozstrzygnięte w R9)

- **D1 — awatar w demo:** (a) własny lub licencjonowany GLB zacommitowany (np. ~12 MB, Git LFS?); (b) demo na proceduralnym awatarze z `test-avatar-generator`, z instrukcją „wrzuć własny GLB” w README; (c) GLB tylko jako asset release/CDN, ładowany przez URL z allowlisty. Rekomendacja: (b) na v1.1, bo bez ryzyka licencyjnego, a później (a).
- **D2 — agentId:** BYO pole w ustawieniach (store, trwałe) + `?agent_id=` w URL + **brak** zmiany przez postMessage. Rekomendacja: tak. Alternatywa „tylko URL” kłóci się z 15/UIX-08 i 18-05.
- **D3 — emocje A2E:** usunąć `clip.emotions`/`carriesEmotion` do czasu, aż F9 je dostarczy (rekomendacja), czy wpiąć blend w 16-02 na zapas?
- **D4 — pakiet R3:** jako decimal phase w GSD (śledzone, pełny cykl) czy jako `/gsd-quick` ×5 (szybciej)? Rekomendacja: `/gsd-quick-batch`.
- **D5 — test speech-backend:** nowy `tests/speech-backend.test.ts` w pakiecie, który 17-03 potem rozszerzy, czy dopisać przypadek sampleRate od razu do planu 17-03? Rekomendacja: nowy plik teraz, bo B1 jest w pakiecie.

### R8. Metodologia rewizji

Równolegle 4 agenci Haiku 5.5 (P0, lipsync/G2P, plany faz 12–18, martwy kod i higiena) + 3 wcześniejsi agenci (bezpieczeństwo embed-bridge, P1/P2, baseline + pokrycie planów). Orkiestrator osobiście sprawdził: `embed-bridge.ts:40-159`, stan `public/models` w git, wynik `tsc`/`vitest`. Rozbieżności między raportami (np. `isEditableTarget`, kierunek reverta agentId) rozstrzygnięto na korzyść raportu z dokładniejszym śladem w kodzie. Nie uruchamiano aplikacji w przeglądarce. Mikrofon w iframe i ścieżka A2F `/predict` nie były testowane na żywo.

---

## Rewizja 2 — cel „zrobić wrażenie” (2026-11-19)

**Wytyczne właściciela:** decyzje D1–D5 rozstrzyga agent. Na razie nie wymieniamy awatarów. Aplikacja ma **robić wrażenie na oglądających**. Do tego trzy nowe analizy (Haiku 5.5): pierwsze 30 s widza, dokładność lip-sync, jakość renderingu. Najmocniejsze tezy orkiestrator sprawdził w kodzie (oznaczone ✔).

**Nowy fakt:** repo `kpulka/Avatar` jest **publiczne** (`gh repo view`). Pakiet bezpieczeństwa R3.1 dotyczy więc kodu, który już jest opublikowany, a nie tylko przyszłego demo.

### R9. Decyzje (zastępują R7)

- **D1 — awatar: jeden model MetaPerson, tylko lokalnie. Wizytówką jest wideo, nie Pages z manekinem.**
  - GLB nigdy nie trafił do historii git (`git log --all -- public/models/avatar.glb` jest pusty). d05a18b go wykluczył, nie usunął.
  - Prawo do redystrybucji modelu z MetaPerson Creator jest niejasne: publiczne strony Avatar SDK nie mają regulaminu redystrybucji, a opisy planów są sprzeczne. Publiczne repo nie może więc go zawierać.
  - Fallback to manekin (kula + walec, `test-avatar-generator.ts:104-283`), który **szkodzi** wrażeniu. Dlatego:
    1. wizytówką jest **hero wideo/GIF w README**, nagrane lokalnie na prawdziwym awatarze *po* pakiecie Showcase (R10). Nagranie renderu to nie redystrybucja siatki;
    2. 18-05 (Pages): **nie publikować dema z manekinem**. Pages tylko wtedy, gdy właściciel potwierdzi licencję Avatar SDK. To jedyny fakt, którego agent nie rozstrzygnie. Wtedy GLB jako asset (nie w git) + kompresja meshopt/Draco (11,4 MB bez kompresji, brak postępu ładowania);
    3. bez wymiany awatarów: B4 (dispose przy zmianie) **P1 → P3**. Przyciski ładowania pliku/dema zostają tylko w Studio;
    4. poprawić założenia w 13-CONTEXT:37,49, 13-DRAFT-README:33, 15-CONTEXT:106 („GLB committed” to nieprawda).
- **D2 — agentId:** store jako jedyne źródło. Priorytet: `?agent_id=` (URL) > pole BYO (store, scope `studio`) > domyślny. **Brak zmiany przez postMessage.** Bez zmian względem R3.1/R3.2.
- **D3 — emocje A2E:** usunąć `clip.emotions`/`carriesEmotion` (brak producenta, A2F niedostępne poza lokalnym RTX). Na wrażenie działa **EmotionLayer**, ale dziś to leksykon słów kluczowych tylko dla tekstu agenta (`emotion-layer.ts:42-94`), który wraca do neutralnej przy braku trafienia. Pomysł do backlogu: tagi emocji w odpowiedzi agenta ElevenLabs.
- **D4 — forma:** R3 (bezpieczeństwo + bugi) jako `/gsd-quick-batch`. Pakiet Showcase (R10) jako **osobna faza decimal** (np. `11.5`) przez `/gsd-phase`, bo wymaga wizualnego UAT i zrzutów przed/po.
- **D5 — testy:** nowy `tests/speech-backend.test.ts` teraz. B1 naprawiony ogólnie (sampleRate niesiony w chunku), nie tylko dla dema. 17-03 potem go rozszerzy.

**Korekta priorytetu B1:** „demo speech” (`speech-backend.ts:303-343`) to **ton 140/280/420 Hz** z równym czasem dla każdej litery, a nie mowa. Widz go nie zobaczy, a W1 i tak go zastępuje. B1 **P0 → P2**, ale zostaje w R3, bo psuje porównywarkę A/B i nagłówek WAV wysyłany do A2F.

### R10. Pakiet „Showcase” (nowy, po R3, przed fazą 12)

Ranking: wrażenie / wysiłek. Każdy punkt wymaga zrzutu przed/po (skill `run` lub Playwright), bo jakość wizualna nie ma testu jednostkowego.

| ID | Wrażenie | W | Problem | Gdzie | Zmiana |
|---|---|---|---|---|---|
| W1 | **Krytyczne** | M | Widz w trybie user **nie może sprawić, by awatar mówił** bez agenta i mikrofonu. Dock ma tylko Start/Mute/Interrupt. `demoSpeech()` nie ma wywołań. `?autostart` nikt nie czyta | `conversation-dock.ts:18-40`, `animation-controller.ts:113`, `embed-bridge.ts:93` | Przycisk „Posłuchaj” / autoplay po geście: nagrane zdanie TTS (ElevenLabs *with timestamps*) + **prawdziwy alignment** jako JSON w `public/demo/`, napisy, ten sam tor co live. Zastępuje ton (B1 przestaje dotyczyć dema) |
| W2 | **Krytyczne** | S | Ciche porażki: odmowa mikrofonu daje i tak pastylkę „Słucham…”. Zły agent lub błąd WSS → retry bez końca, bez `onError`. Spinner może wisieć wiecznie. Przycisk „Audio 2D” w fallbacku WebGL zostawia pustą stronę | `speech-backend.ts:167-172`, `raw-wss-client.ts:89-96`, `scene-controller.ts:68-69`, `container.ts:105`, `main.ts:10` | Toast + stan `error` dla mikrofonu i WSS (limit prób), loader znika także przy błędzie, fallback WebGL z treścią. Zbieżne z 15-05: przenieść ten fragment wcześniej |
| W3 | Wysokie | S | ✔ **SSS nie działa na twarzy:** shader czyta `directLight` po pętli świateł, czyli ostatnie światło kierunkowe = rim zza głowy. Na przodzie twarzy NdotL ≈ −0,7 → wkład ≈ 0. `wrapDiffuse` liczony, nieużywany. ROADMAP:137/05-01 obiecywał preset jakości SSS, którego w kodzie nie ma | `skin-shader.ts:41-56`, `lighting.ts:40` | Kierunek i kolor key light jako uniformy. Użyć `wrapDiffuse` (lub usunąć). Tint albedo |
| W4 | Wysokie | S | ✔ Cień key light: frustum ±1 m wokół (0,0,0), cel domyślny (0,0,0), a twarz jest na ~88% wysokości modelu (`scene-controller.ts:92`) → górna część głowy **prawdopodobnie** poza mapą cieni (do potwierdzenia `CameraHelper`). `castShadow` tylko na meshach z morphami. `shadow.radius` nie działa pod PCFSoft | `lighting.ts:18-34`, `meta-person-loader.ts:46` | `keyLight.target` = głowa, frustum ~±0,35 m (lepsza rozdzielczość cienia za darmo), cień na wszystkich meshach awatara |
| W5 | Wysokie | S | ✔ Brak kompensacji opóźnienia wyjścia: zero `outputLatency`/`getOutputTimestamp` w `src/`. Zamiast tego stały `syncOffsetMs` +100 ms (`calibration.ts:56`) dobrany w UAT na jednym sprzęcie, więc na innym (Bluetooth!) usta rozjadą się z dźwiękiem | `face-controller.ts:288,318,354,540` | Zegar wizemów = czas słyszalny (`ctx.getOutputTimestamp()` / `outputLatency`), `syncOffsetMs` → mała reszta ≈ 0. Nie ma tego w 16-03 |
| W6 | Wysokie | M | ✔ Spółgłoski wargowe P/B/M nigdy się nie domykają: efektywne `mouthClose` ≈ 0,48 (0,8 × closeScale 0,60). **Celowo**, bo wysoki `mouthClose` w MetaPerson ciągnie wargę na nos (`calibration.ts:38`). Samo podniesienie nie zadziała | `phoneme-visemes.ts:99-102`, `calibration.ts:38-60`, `viseme-scheduler.ts:115,150` | Poza z kilku kształtów: jaw → ~0, `mouthPress` + `mouthRollUpper/Lower` zamiast samego `mouthClose`. Strojenie na żywo w Studio. **Sprzeczność do naprawy w 17-02:** akceptacja „closure ≥ 0,51” (i błędnie wyliczone 0,8 × 0,6 = 0,48) vs LIP-04 „≥ 0,85” |
| W7 | Średnie | S | Oczy/rzęsy/włosy: gałka traci normal/roughness maps z GLB. Rogówka ma opacity 0 (martwa). Rzęsy bez `alphaToCoverage` (MSAA jest włączone). Włosy bez obsługi alfy | `materials.ts:71-111` | Zachować mapy, naprawić lub usunąć rogówkę, `alphaToCoverage` dla rzęs i włosów |
| W8 | Średnie | S–M | `RoomEnvironment` daje płaskie odbicia. Brak grade/winiety. Kamera bez ruchu | `environment.ts:22` | Własne środowisko „softbox” do PMREM (jednorazowo, 0 kosztu w klatce) dla wyraźnych catchlightów. Ewentualnie jednoprzebiegowy grade/winieta. Bez EffectComposer bez MSAA |
| W9 | Średnie | M | Rescale alignmentu mapuje 0 → 0 i koniec znaków → koniec chunka: cisza na końcu rozciąga całą mowę. Diagnostyka loguje proporcję *po* rescale, więc zawsze ≈ 1 (sprawdzian 17-05 ±10% nie może się nie udać) | `alignment-rescale.ts:31-37`, `speech-backend.ts:105-116` | Zakotwiczyć w onset/offset mowy z PCM (okna RMS z `energy-fallback.ts`). Logować proporcję przed rescale. Dopisać do 17-03 |
| W10 | Średnie | S | `uiMode=studio` zapisuje się na stałe po `?studio=1`, więc powracający widz ląduje w narzędziach. Mieszany PL/EN i żargon („Porównaj A/B”, „Tryb blind”, „TY:/AGENT:”) | `ui-mode.ts:50-53`, `captions.ts:21,25`, `algorithm-switcher.ts:47-62` | Studio tylko na sesję. Copy to faza 12/15, ale `uiMode` naprawić teraz |
| W11 | Niskie | S | Wydajność bez zabezpieczeń: brak poziomów jakości i dynamicznego pixelRatio (target 60 FPS, AVAT-02) | `renderer.ts:28` | Dynamiczny pixelRatio przy spadku FPS. Warunek przed W8 |

Pomysły na później (nie w pakiecie): szczęka modulowana obwiednią głośności z `AnalyserNode` (dziś jaw 0,2–0,4 niezależnie od głośności); look-ahead koartykulacji (dziś każdy fonem to osobny impuls, nakładanie przez `max`).

### R11. Zrewidowana kolejność całości

**R3.1 (bezpieczeństwo, repo publiczne) → reszta R3 → R10 Showcase → 16 → 17 → 12 → 13 → 15 → 14 → 18.**

- **Funkcja i obraz przed tłumaczeniem:** 12 tłumaczy komentarze w `face-controller`/`speech-backend`, które 16/17 potem przepisują. Odwrócenie oszczędza podwójną pracę i jest zgodne z rekomendacją 16-CONTEXT:378-381.
- **13 (README) po Showcase i 16/17**, bo hero wideo ma pokazać finalną jakość.
- **Do sprawdzenia przed przestawieniem:** `depends_on` w planach 12/13/15. ROADMAP wiąże 13-03 z 15, a 12-05 tłumaczy literały UI, które 15-02 przenosi do `copy.ts`. Rozważyć 15-02 przed 12-05.
- 18-01 (skan sekretów) można zrobić **od razu**, równolegle, bo repo jest publiczne.
- Dopisać do 17-02: W6 + poprawna akceptacja domknięcia. Do 17-03: W9. Do 16-03: W5 (jeśli nie zrobiony w R10).

### R12. Korekta R11 (2026-11-19)

- **Kolejność 12 przed 16/17 jest celowa** (12-CONTEXT §6.2, ROADMAP §Progress; zakłada ją 44 planów, m.in. 15-02 i 13-04 z markerem `PHASE-12-DOCS-WAVES-LANDED`). Przestawienie z R11 **wycofane**. Obowiązuje: **18-01 → 11.1 → 11.2 → 12 → 13 → 15 → 16 → 17 → 14 → 18 (reszta)**.
- Nowe fazy: **11.1** (Hardening & bugfix pack = R3) i **11.2** (Showcase = R10) idą po 18-01, a przed 12. Nowy kod i nowe teksty w tych fazach są od razu po angielsku, więc faza 12 ma mniej do tłumaczenia.
- **Licencja:** właściciel bierze odpowiedzialność na siebie, więc GLB zostanie zacommitowany w 11.2 (**SHOW-09**), a demo na Pages pokaże prawdziwego awatara. Decyzja D1 z R9 (tylko lokalnie + wideo) jest nieaktualna w części o Pages. Hero wideo zostaje (SHOW-10).
- **Gdzie trafiły pozycje R10:** W1 → SHOW-01, W2 + W10 → SHOW-02, W3 → SHOW-03, W4 → SHOW-04, W5 → SHOW-05, W6 → SHOW-06, W7 → SHOW-07, W8 + W11 → SHOW-08, W9 → 17-03 (zadanie 3a).
- **B7** (nadmiar MIN_SPAN w phoneme-merge) był już w 17-02, zadanie 1. Mój dopisek z R4 był zbędny.
- Pozostałe dopiski z R4 i R2 naniesione na plany:
  - 14-01 (baseline 12 błędów `tsc` w testach), 14-03 (dispose zasobów), 14-04 (Unsub, martwe zdarzenia), 14-05 (markery 16/17);
  - 16-01 (B5), 16-02 (usunięcie emocji A2E, D3), 16-03 (zegar słyszalny z SHOW-05);
  - 17-01 (`-ed`, dwuznaki), 17-02 (kryterium „perceived closure”), 17-03 (W9), 17-06 (bez duplikatu ekstrakcji);
  - 18-01 (SECURITY.md „Embedding” + CSP), 18-05 (Listen, BYO w store, prawdziwy awatar);
  - 13/15/18-CONTEXT (GLB „committed in 11.2”).
