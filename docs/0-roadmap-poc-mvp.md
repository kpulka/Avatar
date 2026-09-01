# 0. Roadmapa: PoC → MVP → Faza 2

Zasada nadrzędna: **wąski pion (thin vertical slice)** — każdy etap kończy się działającym, demoowalnym produktem, a nie kolekcją modułów. Dokumenty 1–6 są referencją techniczną; ten plik jest planem wykonawczym.

---

## 🎯 Etap 0 — PoC (cel: 3–5 dni roboczych)

**Cel biznesowy:** "Mówię do przeglądarki, realistyczna postać odpowiada głosem, usta są zsynchronizowane, mogę jej przerwać w pół zdania."

**Zakres IN:**
1. Agent ElevenAgents skonfigurowany w dashboardzie (prompt, głos, model LLM, język EN).
2. Klient web (Vite + TypeScript + Three.js), połączenie przez **surowy WebSocket** `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=...` (dlaczego nie SDK — patrz [docs/2, sekcja "SDK vs surowy WSS"](2-integracja-elevenlabs-wss.md)).
3. Model MetaPerson `.glb` (bust/head — nie pełne ciało) z blendshape'ami ARKit.
4. Lip-sync z `audio_event.alignment` (mapowanie EN z [docs/3](3-lip-sync-i-koartykulacja.md)).
5. Odtwarzanie PCM przez Web Audio + harmonogram wizemów na tej samej osi czasu.
6. Obsługa eventów `interruption` → stop audio + relaks twarzy (`FaceController` z [docs/4](4-audio-i-obsluga-przerwan.md)).
7. Proceduralne mruganie (idle) — najtańszy sposób ożywienia postaci.

**Zakres OUT (świadomie):** emocje, język PL, pełne ciało/gestyka, custom SSS (stock PBR wystarczy), UI produktowe, autoryzacja (publiczny agent), testy automatyczne.

**Kroki:**
| Dzień | Zadanie | Definition of Done |
| :--- | :--- | :--- |
| 1 | Agent w dashboardzie + pusty klient 3D (scena, światło, kamera) + ładowanie GLB | Awatar renderuje się statycznie; `Conversation` odpowiada głosem przez chwilę testową (SDK do testu agenta). |
| 2 | Surowy WSS: mic capture (AudioWorklet → PCM 16 kHz → base64), eventy `audio` → odtwarzanie PCM | Płynna rozmowa głosowa (bez ust) — gapless, bez trzasków. |
| 3 | `FaceController` + scheduler wizemów z alignmentu | Usta wizualnie zgadzają się z mową (test kontrolny: M/B/P domyka wargi). |
| 4 | `interruption` → stop audio + relaks twarzy; reconnect/obsługa błędów WSS | Przerwanie w dowolnym momencie nie zostawia "zamrożonej" miny. |
| 5 | Bufforowanie, szlif latencji, pomiar metryk | Spełnione kryteria akceptacji poniżej. |

**Kryteria akceptacji PoC (mierzalne):**
- [ ] Start odpowiedzi audio < 1,5 s od zakończenia wypowiedzi użytkownika (mierzane: `user_transcript` → pierwszy `audio`).
- [ ] Lip-sync: brak wyraźnego dryfu usta/dźwięk w wypowiedzi 30 s (kontrola wzrokowa + log różnic czasów).
- [ ] Barge-in: audio zamiera < 50 ms od event `interruption`; twarz w stanie neutralnym < 300 ms.
- [ ] 60 FPS @ 1080p na GPU klasy GTX 1060 / Apple M1; model < 25 MB; pierwszy render < 5 s na łączy 20 Mbps.
- [ ] Rozmowa 10 min bez wycieku pamięci (audio nodes sprzątane w `onended`).

---

## 🚀 Etap 1 — MVP (cel: 2–4 tygodnie)

**Cel biznesowy:** produkt możliwy do pokazania klientowi/stakeholderom z branded UI i polskim językiem.

Zakres (każdy punkt ma swój rozdział w docs):
1. **Agent "as code"** — konfiguracja przez ElevenLabs CLI (wersjonowanie promptów w repo), agent prywatny, **signed URL z backendu** zamiast publicznego `agent_id` ([docs/2](2-integracja-elevenlabs-wss.md)).
2. **Lip-sync PL** — tabela EN+PL z dwuznakami (`sz`, `cz`, `rz`, `ch`, `ą`, `ę`...) ([docs/3](3-lip-sync-i-koartykulacja.md)).
3. **Realizm skóry** — pre-integrated SSS przez `onBeforeCompile` + oświetlenie studiem + ACES tone mapping ([docs/5](5-shadery-i-realizm.md)).
4. **Ożywienie** — proceduralne mikro-ruchy głowy, sakkady oczu, idle sway; tekstura mowy ciała z [docs/6](6-analiza-opensource-i-rozwoj.md).
5. **Emocje** — agent wywołuje client tool `set_emotion` → `FaceController` ustawia bazy emocjonalne blendshape'ów ([docs/6](6-analiza-opensource-i-rozwoj.md)).
6. **UI/UX** — mute, wybór wejścia/wyjścia audio, wskaźnik stanu (`listening/speaking`), transkrypcja.
7. **Twardość** — reconnect z backoffem, telemetria (TTFB, drift, FPS), obsługa braku WebGL/mikrofonu.

**Kryteria akceptacji MVP:**
- [ ] Pełny flow PL: pytanie → odpowiedź z poprawnym lips-synciem dwuznaków.
- [ ] Barge-in działa przy każdym z 10 losowych momentów przerwania (0 zamrożeń twarzy).
- [ ] Awatar prywatny (signed URL); klucz API niewidoczny w sieci przeglądarki.
- [ ] SSS widoczny na uszach/nosie/wargach w porównaniu przed/po (zrzuty referencyjne).
- [ ] Lighthouse/metryki: cold load < 5 s, brak stutter > 5 ms/frame w mowie.

---

## 🔭 Etap 2 — Rozwój (kierunki, nie zobowiązania)

- **Własny mózg (tryb B)**: Speech Engine / Multi-Context WSS + własny LLM (pełna kontrola nad promptami, narzędziami, kosztami) — patrz [docs/2](2-integracja-elevenlabs-wss.md).
- **Mowa ciała**: szkielet Mixamo, gestykulacja, crossfade animacji `AnimationMixer`.
- **Lip-sync akustyczny** (Rhubarb WASM) jako fallback dla języków bez fonetycznego zapisu.
- **Alternatywny renderer**: MetaHuman przez Unreal Pixel Streaming (maksymalny realizm, koszt GPU na stream) — macierz decyzji w [docs/1](1-architektura-i-modele-3d.md).

---

## ⚠️ Rejestr ryzyk

| Ryzyko | Prawdopodob. | Wpływ | Mitygacja |
| :--- | :--- | :--- | :--- |
| Dryf lip-syncu przy odtwarzaniu przez SDK (WebRTC) | wysokie | średni | PoC używa surowego WSS: audio + alignment na jednej osi `AudioContext` ([docs/2](2-integracja-elevenlabs-wss.md), [docs/4](4-audio-i-obsluga-przerwan.md)). |
| Autoplay policy przeglądarki (AudioContext zablokowany) | pewne | bloker PoC | Start rozmowy wyłącznie po geście użytkownika (klik "Talk"); `ctx.resume()` w handlerze. |
| Nazwy blendshape'ów inne niż ARKit camelCase w eksporcie | średnie | wysoki | Walidacja przy ładowaniu: brakujące klucze → lista błędów w konsoli + normalizacja nazw (`jaw_open` → `jawOpen`) ([docs/1](1-architektura-i-modele-3d.md)). |
| Szczeliny/trzaski między chunkami audio | średnie | średni | Format PCM (nie mp3) — `createBuffer` + `copyToChannel`, brak kosztu dekodera; bufor startu 2–3 chunki ([docs/4](4-audio-i-obsluga-przerwan.md)). |
| Licencje MetaPerson (koszt komercyjny) | średnie | wysoki | Sprawdzić cennik Avatar SDK przed fazą produktową; alternatywy w [docs/1](1-architektura-i-modele-3d.md). |
| Koszt agentów ElevenLabs (minuty rozmowy, burst) | niskie | średni | Budżet w dashboardzie; agent shared-layer/flash TTS; monitoring zużycia. |
| Retencja danych (nagrania rozmów) — RODO | średnie | wysoki | Konfiguracja privacy/retention agenta; tryb Zero Retention jeśli wymagane ([docs/6](6-analiza-opensource-i-rozwoj.md)). |
| Wydajność SSS na słabych GPU | średnie | średni | Presety jakości (PoC: brak SSS; auto-detekcja GPU na MVP). |

---

## 🧭 Zasady inżyniersne

1. **Interfejsy przed implementacjami** — `SpeechBackend`, `FaceDriver`, `AvatarLoader` ([docs/1](1-architektura-i-modele-3d.md)): jedyny sposób na utrzymanie elastyczności technologicznej.
2. **Jeden właściciel morph targetów** (`FaceController`) — zakaz pisania do `morphTargetInfluences` z innych modułów.
3. **Jedna oś czasu** — audio i wizemy planowane wyłącznie na `AudioContext.currentTime`.
4. **Fail-fast na ładowaniu** — model/agent bez wymaganych kluczy/parametrów = czytelny błąd, nie cicha degradacja.
5. **Każda faza kończy się demem** — jeśli czegoś nie da się pokazać, nie jest gotowe.