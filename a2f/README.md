# a2f/ — lokalny PoC NVIDIA Audio2Face-3D (Faza 9)

Ścieżka **główna**: Audio2Face-3D SDK (MIT) + wagi na HuggingFace (NVIDIA Open Model License).
Ścieżka NIM/NGC — tylko porównawczo (EULA NVAIE), patrz `docs/A2F-LOCAL.md` i `.planning/phases/09-a2f-local-poc/09-CONTEXT.md`.

## Struktura docelowa

```
a2f/
  README.md            ← ten plik (toolchain + kroki)
  sdk/                 ← klon https://github.com/NVIDIA/Audio2Face-3D-SDK (nie commitujemy binarek)
  rig/                 ← ekstrakt ARKit-52 z public/models/avatar.glb (extract_rig.py, 09-01)
  fixtures/            ← realny dump odpowiedzi solvera (predict.sample.json) — kontrakt dla 09-02
  wrapper/             ← FastAPI /predict + /status + pytest (09-02)
  tools/extract_rig.py ← rig neutral+deltas z avatar.glb (09-01)
  scripts/
    start.ps1|sh       ← start wrappera (09-02)
    stop.ps1|sh        ← stop wrappera
    preflight.ps1      ← sprawdzenie gotowości toolchainu (JUŻ JEST)
  docker/              ← obraz produkcyjny OCI (Faza 10; buduje Podman Desktop)
```

## Wymagania środowiska (stan 2026-09-02, zweryfikowane u użytkownika)

| Składnik | Wymagane przez SDK | Obecny stan | Akcja |
|---|---|---|---|
| GPU + driver | NVIDIA, CUDA-capable, VRAM ≥ 4 GB | RTX 3090 24 GB, driver 595.79 | ✓ |
| CUDA Toolkit | **12.8–12.9** (`>=12.8, <13.0`; rekomendowane 12.9) | ✅ **12.9.1 zainstalowana obok 13.2** (`C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.9`; CUDA_PATH user = v12.9) | ustaw `CUDA_PATH` na v12.9 w sesji builda |
| TensorRT | **>=10.13, <11.0** | ❌ brak | zaloguj się na developer.nvidia.com → TensorRT 10.13.x **Windows x86_64 ZIP** → rozpakuj do `C:\TensorRT-10.13` |
| Python (tooling SDK) | **>=3.8, <=3.10.x** | ✅ **3.10.20 (uv) + `a2f/.venv`** | gotowe |
| Visual Studio | MSBuild VS2022+ (C++) | ❓ | VS2022 + „Desktop development with C++" |
| git + git-lfs | klon SDK / dane | — | sprawdź `preflight` |
| HF konto | click-through A2E (gated) + token | — | `hf auth login` (Read gated) |
| Kontenery | Podman Desktop (zamiast Docker) — tylko obraz Fazy 10 | Podman Desktop | OK; Docker niepotrzebny |

> Kluczowy blocker: **CUDA 13.2 vs wymóg `<13.0`**. SDK README buduje się na CUDA 12.x.
> Ścieżka: zainstaluj CUDA Toolkit **12.9** (instalator pozwala mieć wiele wersji obok siebie),
> TensorRT **10.13** (kompatybilny z 12.9), a przy budowie ustaw `CUDA_PATH`/`-DCUDA_PATH` na 12.9
> i `TENSORRT_ROOT_DIR` na 10.x. Zweryfikuj, czy wersja SDK z main wspiera CUDA 13 —
> jeśli tak, ten blocker znika (sprawdzić README po `git clone`).

## Kroki (09-01)

> **Status 2026-09-11:** klon SDK ✅, `git lfs pull` ✅, zależności Pythona ✅, `fetch_deps` ✅.
> Brakuje: TensorRT (pkt 2.2 TODO) → `build.bat`, HF login (pkt 3) → `download_models`/`gen_testdata`.
> Pełna instrukcja: [`docs/A2F-LOCAL.md`](../docs/A2F-LOCAL.md).

1. `powershell -ExecutionPolicy Bypass -File a2f/scripts/preflight.ps1` — raport gotowości.
2. Zainstaluj braki z tabeli wyżej (CUDA 12.9, TensorRT 10.13, VS2022 C++, `uv python install 3.10`).
3. `git clone https://github.com/NVIDIA/Audio2Face-3D-SDK a2f/sdk` + `git lfs pull`.
4. W venv Python 3.10: `fetch_deps`, `hf auth login`, `download_models` (v3.0 diffusion primary;
   v2.3-Mark porównawczo; A2E v2.2 gated), `gen_testdata` (**TRT engines prebuild** — bez tego
   pierwszy run buduje silnik = minuty).
5. `run_sample` na próbce EN → **dump realnego wyjścia** do `a2f/fixtures/predict.sample.json`
   (09-02 replay-test) + odnotuj: nazwy/units blendshape'ów, **czy jest eyeBlink L/R** (carriesEyes), fps/step.
6. `a2f/tools/extract_rig.py` — rig ARKit-52 z `public/models/avatar.glb` (wejście `IBlendshapeSolver`).
7. Wrapper (09-02): FastAPI `/predict` + `/status` + pytest (replay na fixture).

## Licencje

- SDK: **MIT** (kod C++/Python) — komercyjnie OK.
- Modele A2F-3D (HF): **NVIDIA Open Model License** — darmowe.
- Audio2Emotion: gated (click-through) — darmowe po akceptacji.
- NIM/NGC: NVIDIA AI Enterprise EULA — **NIE używamy** w PoC (płatne do produkcji).

## Notatka GPU/Windows

SDK buduje się natywnie na Windows (CUDA/TRT/MSVC). Kontenery nie są potrzebne do PoC.
Obraz OCI (SDK+modele+rig) buduje **Podman Desktop** dopiero dla Fazy 10 (scale-to-zero na Cloud Run L4).
