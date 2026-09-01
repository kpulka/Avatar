# 2. Integracja ElevenLabs: ElevenAgents (Tryb A) i TTS WebSocket (Tryb B)

ElevenLabs oferuje dwa sposoby zasilania awatara mową. Oba dostarczają **alignment znaków** potrzebny do lip-syncu.

| | Tryb A — ElevenAgents | Tryb B — własny pipeline (TTS WSS) |
| :--- | :--- | :--- |
| Co robi serwer | STT + LLM + TTS + turn-taking + **detekcja barge-in** + VAD | tylko TTS (tekst → audio + alignment) |
| Co piszemy my | render, audio playback, lip-sync, UI | wszystko z Trybu A **plus** STT, VAD, LLM, logika przerwań |
| Kiedy | **PoC i MVP** | Faza 2 (pełna kontrola: własny LLM, narzędzia, koszty) |

---

## 🅰️ Tryb A — ElevenAgents

### Co robi agent za nas

Agent to kompletna pętla konwersacji po stronie ElevenLabs: rozpoznaje mowę użytkownika (ASR), generuje odpowiedź (LLM w konfiguracji), syntetyzuje głos (TTS), decyduje kiedy mówić (**turn-taking**), i **sam wykrywa, że użytkownik wszedł w słowo** — przerywa generację i wysyła event `interruption`. Klient nie implementuje żadnego AI.

### Konfiguracja (dashboard / CLI)

W dashboardzie ElevenLabs (sekcja Agents) konfigurujemy:
* **Prompt systemowy** (osobowość, styl, język),
* **Głos** (5k+ głosów; dla PL — głos wielojęzyczny),
* **Model LLM** (wbudowane modele lub custom LLM endpoint),
* **Advanced → client_events**: włączyć eventy używane przez klienta (m.in. `agent_response_metadata` jeśli chcemy emocje — [docs/6](6-analiza-opensource-i-rozwoj.md)).

W MVP: konfiguracja agenta jako kod (ElevenLabs CLI) wersjonowana w repo — prompt zmienia się przez PR, nie przez klikanie.

### Endpoint i autoryzacja

```
wss://api.elevenlabs.io/v1/convai/conversation?agent_id={agent_id}
```

* **Agent publiczny (PoC)**: wystarczy `agent_id` w URL — zero sekretów w przeglądarce.
* **Agent prywatny (MVP)**: klient pobiera z **naszego backendu** signed URL:
  ```
  GET https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id={agent_id}
  Header: xi-api-key: <klucz — tylko na serwerze>
  → { "signed_url": "wss://...&token=..." }
  ```
  Klucz API **nigdy** nie trafia do przeglądarki. Backend może w tym samym miejscu dodać własną autoryzację użytkownika.

### SDK vs surowy WSS — ważna decyzja

| | SDK (`@elevenlabs/client`) | Surowy WebSocket |
| :--- | :--- | :--- |
| Mic, ping/pong, reconnect | za darmo | piszemy (~50 linii) |
| Odtwarzanie audio | **SDK gra sam** (WebRTC domyślnie) | **my planujemy** na `AudioContext.currentTime` |
| Lip-sync | callback `onAudioAlignment` (zegar ścienny — możliwy dryf) | alignment + audio z **tego samego eventu** na jednej osi czasu — **idealna synchronizacja** |

**Decyzja dla awatara: surowy WSS.** Synchronizacja ust z dźwiękiem jest core feature — audio i wizemy muszą dzielić oś czasu. SDK używamy do testowania agenta i jako punkt odniesienia.

### Protokół — klient → serwer

```jsonc
// 1. Start rozmowy (dowolny moment po otwarciu WSS)
{ "type": "conversation_initiation_client_data",
  "custom_config": { /* np. dynamic_variables z kontekstu usera */ },
  "contextual_update": { "text": "User opened the avatar demo page" } }

// 2. Ciągłe strumienie mikrofonu (base64 PCM 16 kHz mono)
{ "user_audio_chunk": "<base64>" }

// 3. Odpowiedź na ping (utrzymanie połączenia)
{ "type": "pong", "event_id": 123 }

// 4. Kontekst bez przerwania agenta (opcjonalny)
{ "type": "contextual_update", "text": "User switched to pricing tab" }

// 5. Wynik client tool (patrz docs/6 — emocje)
{ "type": "client_tool_result", "tool_call_id": "...", "result": "ok", "is_error": false }
```

### Protokół — serwer → klient (eventy, które nas interesują)

| Event | Payload | Zastosowanie u nas |
| :--- | :--- | :--- |
| `conversation_initiation_metadata` | m.in. `agent_output_audio_format: "pcm_44100"`, `user_input_audio_format: "pcm_16000"` | ustalamy formaty audio przy starcie (nie hardkodować!) |
| `audio` | `audio_base_64` (PCM 44.1 kHz) + **`alignment`**: `chars[]`, `char_start_times_ms[]`, `char_durations_ms[]` | **rdzeń**: odtwarzanie + scheduler wizemów |
| `interruption` | `reason` | stop audio, relaks twarzy, cancel kolejki ([docs/4](4-audio-i-obsluga-przerwan.md)) |
| `agent_response_correction` | skrócony tekst po przerwaniu | aktualizacja transkrypcji w UI |
| `user_transcript` / `agent_response` | transkrypcje | UI/subtitles, telemetria TTFB |
| `vad_score` | 0–1 | wskaźnik "user mówi" w UI |
| `client_tool_call` | `tool_name`, `parameters` | emocje/procedury ([docs/6](6-analiza-opensource-i-rozwoj.md)) |
| `ping` | `ping_ms` | odpowiadać `pong` (utrzymanie WSS) |

```jsonc
// Przykład event audio (skrócony)
{ "type": "audio",
  "audio_event": {
    "audio_base_64": "SUQz//...",
    "event_id": 12345,
    "alignment": {
      "chars": ["H", "e", "l", "l", "o"],
      "char_start_times_ms": [0, 50, 80, 120, 160],
      "char_durations_ms": [50, 30, 40, 40, 60]
    } } }
```

**Uwaga:** alignment odnosi się do **znormalizowanego tekstu** (liczby → słowa, skróty rozwinięte). `chars` może nie pokrywać się 1:1 z promptem agenta — mapowanie robimy wyłącznie na znakach z alignmentu, nigdy na oryginalnym tekście.

### Klient: minimalny szkielet obsługi

```javascript
const ws = new WebSocket(signedUrl); // lub ?agent_id=... dla agenta publicznego
let epoch = 0; // unieważnia zaplanowane audio/wizemy po przerwaniu — patrz docs/4

ws.onopen = () => ws.send(JSON.stringify({ type: 'conversation_initiation_client_data' }));
// + start AudioWorklet: mic → 16 kHz → base64 → { user_audio_chunk }

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  switch (msg.type) {
    case 'audio':
      const { audio_base_64, alignment } = msg.audio_event;
      audioEngine.playChunk(base64ToPcm(audio_base_64), epoch);   // docs/4
      faceController.schedule(alignment, audioEngine.chunkStart(epoch), epoch); // docs/3+4
      break;
    case 'interruption':
      epoch++; audioEngine.hardStop(); faceController.beginRelax(); // docs/4
      break;
    case 'ping':
      setTimeout(() => ws.send(JSON.stringify({ type: 'pong', event_id: msg.ping_event.event_id })),
                 msg.ping_event.ping_ms ?? 0);
      break;
    // user_transcript, agent_response, vad_score → UI
  }
};
```

---

## 🅱️ Tryb B — TTS WebSocket `stream-input` (Faza 2)

Endpoint do samodzielnego TTS w czasie rzeczywistym (np. gdy mózgrem jest własny LLM):

```
wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input?model_id=eleven_flash_v2_5
```

* **Model**: `eleven_flash_v2_5` (zalecany dla niskiego TTFB) lub `eleven_multilingual_v2` (jakość). **Uwaga:** ten endpoint **nie wspiera `eleven_v3`** — dla v3 istnieje osobny Text-to-Dialogue WSS.
* **Auth**: `xi-api-key` w nagłówku lub w pierwszej wiadomości (BOS). W przeglądarce = wystawienie klucza → **tylko przez własny proxy** na produkcji.

### Wiadomości

```jsonc
// BOS — parametry generowania
{ "text": " ",
  "voice_settings": { "stability": 0.5, "similarity_boost": 0.8 },
  "generation_config": { "chunk_length_schedule": [120, 160, 250, 290] } }

// Fragmenty tekstu (np. streaming z LLM)
{ "text": "Hello world, how can I help you today? " }
{ "text": "Last sentence.", "flush": true }   // flush=true wymusza generację reszty bufora

// EOS — zamknięcie strumienia
{ "text": "" }
```

* `chunk_length_schedule`: liczby znaków bufurowanych przed generacją kolejnej paczki. Małe pierwsze wartości = szybszy TTFB, duże późniejsze = lepsza prozodia. Domyślne `[120,160,250,290]` jest sensowne; przy końcu tury **zawsze `flush: true`**.
* **Keep-alive**: bezczynność 20 s zamyka połączenie; wysyłanie `" "` (pojedyncza spacja) utrzymuje je. `""` zamyka.
* **Odpowiedź**: JSON-y z `audio` (base64; domyślnie mp3 — dla gapless ustaw `output_format=pcm_44100` w URL), `isFinal` i `normalizedAlignment` (`char_start_times_ms`, `chars_durations_ms`, `chars`) — ten sam kształt danych co w Trybie A, więc scheduler wizemów jest wspólny.

### Tryb B oznacza też (poza zakresem tego dokumentu)

Własne: przechwytywanie i resampling mikrofonu, STT (np. ElevenLabs Scribe realtime), VAD (np. Silero WASM), LLM z tool-callingiem, detekcja i obsługa przerwań. Frameworki pomocnicze: **Speech Engine (ElevenLabs)**, Multi-Context WSS, Pipecat, LiveKit Agents. To jest świadoma rezerwa na Fazę 2 — Tryb A dostarcza te wszystkie elementy gotowe.

---

## 🔗 Pipeliny po stronie klienta (wspólne dla trybów)

```
        WSS message (audio + alignment)
                     │
       ┌─────────────┴─────────────┐
       ▼                           ▼
[ PCM → AudioBuffer ]     [ alignment → Viseme Scheduler ]
 AudioEngine               (mapowanie znaków → ARKit, docs/3)
 (kolejka na ctx.time)                │
       │                              ▼
       └──────────► FaceController ◄───────┘
              (jedyny właściciel morph targetów, docs/4)
```

Oba potoki **muszą** planować na tej samej osi czasu (`AudioContext.currentTime`) i honorować ten sam `epoch` — inaczej przerwania rozsynchronizują dźwięk i mimikę (szczegóły i pułapki: [docs/4](4-audio-i-obsluga-przerwan.md)).