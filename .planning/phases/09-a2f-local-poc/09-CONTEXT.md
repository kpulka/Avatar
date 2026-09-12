---
phase: "09"
name: "Lokalny PoC NVIDIA Audio2Face (RTX 3090)"
created: "2026-09-02"
updated: "2026-09-02 (po review-unifikacji: ścieżka SDK MIT zamiast NGC/NIM jako główna)"
---

# Phase 9: Lokalny PoC NVIDIA Audio2Face (RTX 3090) — Context

## Cel

Podłączyć **realny NVIDIA Audio2Face-3D** działający lokalnie na GPU (RTX 3090, 24 GB),
wystawić go jako REST wrapper i zintegrować z aplikacją przez tryb `frames` (Faza 8). Zakończyć
**go/no-go** na podstawie porównania jakości z LIVE wizemami — dopiero wtedy rozważamy chmurę
(Faza 10). **Zero kosztów chmury w tej fazie.**

## Warstwa techniczna (zweryfikowane 2026-09-02 — decyzja: ścieżka DARMOWA)

**Ścieżka GŁÓWNA (decyzja: tańsze/darmowe): Audio2Face-3D SDK — github.com/NVIDIA/Audio2Face-3D-SDK**
- **Licencja MIT** (SDK, kod C++/Python) + **wagi na Hugging Face pod NVIDIA Open Model License**
  (bezstopniowe, komercyjne użycie OK; Audio2Emotion v2.2 gated — click-through licencji na HF
  + `hf auth login`). Zero opłat licencyjnych.
- Wymagania: CUDA ≥12.8, TensorRT ≥10.13, GPU VRAM 4 GB+ (RTX 3090 = duży zapas), Windows/Linux —
  **lokalnie działa bez kontenerów** (Podman Desktop = zamiast Dockera, tylko obraz produkcyjny F10).
- Tryby: batch **i streaming** (audio accumulator; my używamy batch na cały wav).
- Modele: **`Audio2Face-3D-v3.0` (diffusion — DECYZJA: primary, najbardziej realistyczny;
  30 fps używalnych, inferencje co 0,5 s, stateful)** oraz v2.3 regression (Mark/Claire/James,
  60 fps, random-access) jako porównawczy punkt odniesienia szybkości.
- Natywne wyjście: skin/tongue geometry deltas + jaw transform + **eyes rotation z sakkadami**
  (rotacja oczu potwierdzona; **blink — DO POTWIERDZENIA dumpem w 09-01**). Blendshape'y tylko
  przez `IBlendshapeSolver` na PODANYM rigu.
- A2E (wbudowane emocje): 6 klas (angry/disgust/fear/happy/neutral/sad), 16 kHz audio.
- Trening na audio **EN** — dlatego A2F działa dla tur EN; PL wróci równolegle w obu torach później.

**Ścieżka ALTERNATYWNA (tylko porównawcza, opcjonalnie): NIM** (build.nvidia.com / NGC; gRPC,
protobuf, DeepStream 7.1, licencja NVIDIA AI Enterprise EULA — płatna do produkcji). NIE używamy
w PoC, chyba że SDK zawiedzie; nazwa obrazu/tag/port — wtedy zweryfikować na miejscu.

## Rig solvera (decyzja: NASZ awatar)

A2F produkuje ruch geometrii twarzy; żeby zamienić go na nasze 52 blendshape'y, solver potrzebuje
rigu = neutral + delty 52 kształtów. **Wykorzystujemy rig z naszego `avatar.glb` (MetaPerson)** —
ekstraktor (`a2f/tools/extract_rig.py`) wyciąga neutral i delty morphów raz, offline; solver
zwraca wagi zgodne z naszym modelem 1:1 (bez remapów z template'ów NVIDIA).

> **⚠️ KOREKTA po inspekcji SDK (2026-09-11, do potwierdzenia dumpem 09-01):** solver
> (`BlendshapeSolverDataOwner::Init`) ładuje rig z pliku **`.npz`** o strukturze:
> `poseNames[0] == "neutral"`, tablica `neutral` (V·3 float32) + po jednej tablicy-delcie na każdy
> kolejny shape (`numVertexPositions·sizeof(float) == pose.num_bytes()`), opcjonalnie `frontalMask`.
> Baza solvera MUSI mieć topologię wyjścia A2F (szablon NVIDIA), a nie naszego `avatar.glb`
> (10 meshów, morphy rozbite: 51 + 29 + 4; inny vertex count). Praktyczna ścieżka:
> **solver na rigu ARKit szablonu z paczki modeli (`.../audio2face-3d-v2.3-mark/bs_skin.npz`)
> → wagi ARKit przenoszone po nazwie na nasz awatar** (MetaPerson ma te same nazwy ARKit; brak
> `tongueOut` → no-op). `extract_rig.py` z `avatar.glb` odłożony do czasu potwierdzenia, że
> potrzebny (nie generować artefaktu o złej topologii).

## Interfejs kontraktu (klient ↔ serwer) — wrapper jest WŁAŚCICIELEM formatu

- `POST /predict` — body: plik `.wav` (multipart) lub base64 (mono, 16–44,1 kHz; resample do
  16 kHz po stronie wrappera); odpowiedź (gzip!):
  ```json
  { "fps": 30, "frames": [ { "frame_time": 0.033, "blendshapes": { "JawOpen": 0.12 } } ],
    "carriesEyes": true, "emotions": [ { "timeSec": 0.5, "weights": { "happy": 0.8 } } ] }
  ```
  - `frame_time` per ramka (krok niestały), PascalCase ARKit, **bez capu na długość** wejścia;
  - `carriesEyes` z wyjścia solvera (obecność eyeBlink*/eyeLook*);
  - `emotions[]` (A2E) opcjonalnie env-flagiem — klient może zasilić EmotionLayer na IDLE.
- `GET /status` — `{ "status": "ready", "gpu": "RTX 3090", "uptime_s": 123 }`.
- Klient: `parseA2fPayload` (08-02) → `FaceController.feedFrames` (08-01). Playback offline.
- Future-proof (poza zakresem): SDK jest streaming-native (okna ~0,5 s) — wrapper może kiedyś
  streamować ramki (NDJSON) zamiast całego JSON; `feedFrames` + FramesClip są na to gotowe
  (ramki relatywne, bufor kliencki).

## Zasady fazy

- Najpierw środowisko (SDK + modele + rig) → potem wrapper → potem integracja → na końcu ocena.
- **EN-only** w ocenie jakości (zdania kontrolne z docs/EN-visemes.md §6); PL dojdzie później
  równolegle w obu torach.
- Wszystkie kroki wrappera mają testy pytest (walidacja na fixture — realny dump z 09-01;
  realna inferencja `@pytest.mark.gpu`, pomijana bez GPU).
- Klient pozostaje w pełni zielony (`npm test`) na każdym etapie.
- Jeśli SDK/HF nie zadziała w środowisku — NOTATKA w 09-VERIFICATION jako blocker z dokładnym
  komunikatem; nie omijamy cicho.

## Pliki/środowisko docelowe tej fazy

- `a2f/` (nowy katalog): `a2f/sdk/` (klon NVIDIA/Audio2Face-3D-SDK + build), `a2f/tools/`
  (extract_rig.py), `a2f/wrapper/` (FastAPI + tests), `a2f/fixtures/` (realne odpowiedzi
  do replay-testów), `a2f/docker/` (obraz produkcyjny — paritet z Fazą 10), `a2f/scripts/`,
  `a2f/README.md` + `docs/A2F-LOCAL.md` (instrukcja setupu).
- Testy Pythona: `a2f/wrapper/tests/`.
- Integracja klienta: tryb `frames` + przełącznik `LIVE/A2F` (z 08), demo wav (ElevenLabs TTS
  — pełny plik z wyprzedzeniem, patrz 09-03) + ramki z lokalnego serwisu.
