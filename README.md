# Interaktywny Awatar 3D — Dokumentacja Projektu

## 📌 O Projekcie

Projekt **Avatar** to interaktywny, realistyczny awatar 3D działający w czasie rzeczywistym w przeglądarce (WebGL).

Cel: postać, która **rozmawia** — słyszy użytkownika, odpowiada głosem z ElevenLabs i animuje twarz (lip-sync, emocje) w synchronizacji z mową, z obsługą naturalnego przerywania wypowiedzi (*barge-in*).

Ścieżka realizacji jest podzielona na weryfikowalne etapy: **PoC → MVP → Faza 2** (patrz: [`docs/0-roadmap-poc-mvp.md`](docs/0-roadmap-poc-mvp.md)).

---

## 🛠️ Stack technologiczny

| Warstwa | Wybór (PoC/MVP) | Uzasadnienie |
| :--- | :--- | :--- |
| **Mózg konwersacji** | **ElevenAgents** (ElevenLabs) | Agent serwerowy: STT + LLM + TTS + model turn-taking + detekcja przerwań w jednym. Zero kodu AI po stronie klienta. Konfiguracja w dashboardzie ElevenLabs lub as code (CLI). |
| **Transport** | WebSocket ElevenAgents (`/v1/convai/conversation`) | Eventy `audio` zawierają **wbudowany alignment znaków** (`chars`, `char_start_times_ms`, `char_durations_ms`) — gotowe dane do lip-syncu. |
| **Głos (TTS)** | ElevenLabs (głos agenta; `eleven_flash_v2_5` dla niskich opóźnień) | Natywna część ElevenAgents; dla własnego pipeline'u (Faza 2) dostępny TTS WSS `stream-input`. |
| **Awatar 3D** | **MetaPerson (Avatar SDK) → `.glb`** z 52 blendshape'ami ARKit + szkieletem Mixamo | Realistyczny wygląd bez riggowania od zera; działa w WebGL. Elastyczność: patrz macierz decyzji w [`docs/1-architektura-i-modele-3d.md`](docs/1-architektura-i-modele-3d.md). |
| **Renderer** | **Three.js** (WebGL) | Dojrzały, WebGL-first, największy ekosystem przykładów SSS/materiałów. Renderer jest za adapterem — wymiana (Babylon.js, Pixel Streaming) nie dotyka logiki lips-syncu. |
| **Audio (klient)** | Web Audio API | Precyzyjne kolejkowanie PCM na osi `AudioContext.currentTime` i natychmiastowy stop przy przerwaniu. |

> **Zasada elastyczności**: logika lips-syncu, przerwań i mimiki jest zdefiniowana jako interfejsy niezależne od renderera i backendu mowy (patrz: [docs/1](docs/1-architektura-i-modele-3d.md)). Three.js i ElevenAgents są decyzjami domyślnymi, nie twardymi zależnościami architektury.

---

## ⚖️ Kluczowe Decyzje Architektoniczne

| Zagadnienie | Wybór | Odrzucona alternatywa | Uzasadnienie |
| :--- | :--- | :--- | :--- |
| **Pętla konwersacji** | ElevenAgents (tryb A) | Własny pipeline STT+VAD+LLM+TTS (tryb B) | PoC w dni zamiast tygodni. Tryb B pozostaje dostępny na Fazę 2 (Speech Engine / Multi-Context WS / Pipecat / LiveKit). Patrz [docs/2](docs/2-integracja-elevenlabs-wss.md). |
| **Lip-Sync** | Alignment znaków z ElevenLabs → wizemy ARKit | Analiza akustyczna (Rhubarb/MFCC WASM) | Zero narzutu CPU, znaczniki przychodzą razem z audio. Mapowanie działa dla EN i PL (patrz [docs/3](docs/3-lip-sync-i-koartykulacja.md)). Akustyka = fallback dla języków bez fonetycznego zapisu. |
| **Geometria & Rig** | MetaPerson GLB + ARKit 52 + Mixamo | Ready Player Me (zamknięte), MetaHuman (wymaga Unreal/Pixel Streaming) | Gotowy, realistyczny, zoptymalizowany model webowy. Alternatywy (MetaHuman, HeyGen LiveAvatar) opisane w macierzy decyzji [docs/1](docs/1-architektura-i-modele-3d.md). |
| **Realizm skóry** | PBR + sheen/clearcoat (PoC) → pre-integrated SSS przez `onBeforeCompile` (MVP) | NVIDIA DLSS 5 / neural rendering | DLSS wymaga natywnego dostępu sprzętowego — niemożliwe w piaskownicy WebGL/WebGPU. Patrz [docs/5](docs/5-shadery-i-realizm.md). |
| **Przerwania (barge-in)** | Detekcja serwerowa (agent) + klient: stop audio + wygaszenie mimiki | Twardy reset / freeze twarzy | Agent sam wykrywa głos użytkownika i przerywa generację; klient obsługuje event `interruption` i płynnie relaksuje twarz (state machine `FaceController`). Patrz [docs/4](docs/4-audio-i-obsluga-przerwan.md). |
| **Bezpieczeństwo** | Publiczny `agent_id` (PoC) / **signed URL z backendu** (MVP) | Klucz API w przeglądarce | `xi-api-key` **nigdy** nie może trafić do kodu klienta. |

---

## 🏗️ Architektura (widok wysokiego poziomu)

```
┌─────────────┐   mic (PCM 16 kHz, base64)    ┌──────────────────────────────┐
│   Klient    │ ────────────────────────────► │      ElevenAgents (serwer)   │
│  (browser)  │                               │  ASR ─► LLM ─► TTS ─► turn-  │
│             │ ◄──────────────────────────── │  taking + barge-in + VAD     │
│ ┌─────────┐ │  WSS events:                  └──────────────────────────────┘
│ │ Three.js│ │   • audio (PCM + alignment)        ▲
│ │  scena  │ │   • interruption                    │ konfiguracja: dashboard /
│ └────▲────┘ │   • user_transcript / agent_response│ prompt, głos, model, client_events
│      │      │   • vad_score, client_tool_call     │
│ ┌────┴────┐ │   • agent_response_correction       │
│ │  Face   │ │                                      │
│ │Controller│ │                                      │
│ └─────────┘ │                                      │
│ ┌─────────┐ │                                      │
│ │ Audio   │ │   Web Audio API: PCM → AudioBuffer → │
│ │ Engine  │ │   harmonogram na ctx.currentTime     │
│ └─────────┘ │                                      │
└─────────────┘
```

Jedyny właściciel morph targetów twarzy to `FaceController` (state machine: `IDLE → SPEAKING → RELAXING → IDLE`). Audio i wizemy są planowane **na tej samej osi czasu** (`AudioContext.currentTime`) — to gwarantuje synchronizację ust z dźwiękiem.

---

## 📂 Struktura Dokumentacji (`docs/`)

| Plik | Zawartość |
| :--- | :--- |
| [0-roadmap-poc-mvp.md](docs/0-roadmap-poc-mvp.md) | **Start tutaj.** Plan PoC/MVP krok po kroku, kryteria akceptacji, ryzyka. |
| [1-architektura-i-modele-3d.md](docs/1-architektura-i-modele-3d.md) | Macierz decyzji 3D (MetaPerson vs alternatywy), warstwy abstrakcji, ładowanie GLB, ARKit 52. |
| [2-integracja-elevenlabs-wss.md](docs/2-integracja-elevenlabs-wss.md) | Tryb A: ElevenAgents WSS + SDK. Tryb B: surowy TTS WSS (Faza 2). Auth, eventy, formaty. |
| [3-lip-sync-i-koartykulacja.md](docs/3-lip-sync-i-koartykulacja.md) | Pełna tabela znaki → ARKit (EN+PL, dwuznaki), koartykulacja, wygładzanie. |
| [4-audio-i-obsluga-przerwan.md](docs/4-audio-i-obsluga-przerwan.md) | Odtwarzanie PCM, barge-in, state machine twarzy, rozwiązywane race conditions. |
| [5-shadery-i-realizm.md](docs/5-shadery-i-realizm.md) | Materiały skóry (PBR → SSS), oświetlenie, tone mapping, optymalizacje. |
| [6-analiza-opensource-i-rozwoj.md](docs/6-analiza-opensource-i-rozwoj.md) | Open-source warte podglądu, emocje sterowane agentem, wielojęzyczność, Faza 2. |

---

## 📋 Status projektu

* **Etap: dokumentacja** (brak kodu w repo). Następny krok: realizacja PoC wg [docs/0](docs/0-roadmap-poc-mvp.md).
* Wymagania wstępne: konto ElevenLabs (API key, dostęp do ElevenAgents), eksport modelu MetaPerson `.glb`, Node.js 20+.