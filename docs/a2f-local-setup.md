# A2F-LOCAL — lokalny PoC NVIDIA Audio2Face-3D (Faza 9)

> Instrukcja setupu i weryfikacji lokalnego A2F (SDK MIT + wagi HF) na RTX 3090, Windows, bez kontenerów.
> Aktualizacja: 2026-09-11. Kontrakt serwera (wrapper `/predict`) → `docs/7-audio2face-cloudrun.md` §5.

## 1. Stan środowiska (2026-09-11)

| Składnik | Wymóg | Stan |
|---|---|---|
| GPU + driver | NVIDIA, VRAM ≥ 4 GB | ✅ RTX 3090 24 GB, driver 595.79 |
| CUDA Toolkit | ≥12.8, <13.0 (12.9 zalecane) | ✅ **12.9.1** (`...\CUDA\v12.9`; `CUDA_PATH` user = v12.9; obok 13.2) |
| TensorRT | ≥10.13, <11.0 | ❌ **brak** — patrz §2.2 |
| Python | 3.8–3.10.x | ✅ 3.10.20 (uv) + venv `a2f/.venv` |
| zależności Pythona | `deps/requirements.txt` | ✅ (torch 2.7.1+cu128, onnx, huggingface-hub) |
| narzędzia builda | CMake/Ninja | ✅ `fetch_deps.bat` → `_deps/build-deps` |
| Visual Studio C++ | VS2022+ | ✅ VS 18 Enterprise |
| git + git-lfs | — | ✅ 2.53 / 3.7.1 |
| HF konto + zgoda A2E | gated `nvidia/Audio2Emotion-v2.2` | ⏳ do zrobienia (token Read) |
| SDK | `NVIDIA/Audio2Face-3D-SDK` | ✅ sklonowany do `a2f/sdk` |
| Kontenery | — | nie potrzeba lokalnie; obraz F10 buduje **Podman Desktop** |

Reprodukcja: `powershell -ExecutionPolicy Bypass -File a2f/scripts/preflight.ps1`.

## 2. Brakujące kroki (blokery)

### 2.1 Konto Hugging Face + licencja A2E
1. Konto na `https://huggingface.co` (darmowe).
2. Zaakceptuj licencję `https://huggingface.co/nvidia/Audio2Emotion-v2.2` („Agree and access repository").
3. Token Read (gated): `https://huggingface.co/settings/tokens`.
4. W venv: `a2f\.venv\Scripts\activate` → `hf auth login` (wklej token; **nigdy** do repo/czatu).

### 2.2 TensorRT 10.13+ (wymaga konta NVIDIA)
1. `https://developer.nvidia.com/tensorrt` → zaloguj się.
2. Pobierz **TensorRT 10.13.x — Windows x86_64 ZIP** (zgodny z CUDA 12.9).
3. Rozpakuj do `C:\TensorRT-10.13` (nie musi być w PATH; przy buildzie ustawiamy `TENSORRT_ROOT_DIR`).

## 3. Build + modele + testdata

W PowerShell (venv aktywny lub `uv pip` — deps już zainstalowane):

```powershell
cd D:\Projects\Avatar\a2f\sdk
$env:PM_PACKAGES_ROOT = "D:\packman-repo"      # ustalone na stałe w env user
$env:CUDA_PATH        = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.9"
$env:TENSORRT_ROOT_DIR= "C:\TensorRT-10.13"
git lfs pull
.\build.bat all release                        # wymaga TENSORRT_ROOT_DIR

# modele (po hf auth login)
a2f\.venv\Scripts\activate
python -m ... # download_models.bat uruchamiamy w venv:
..\..\a2f\.venv\Scripts\python.exe --version
.\download_models.bat                           # A2F v3.0 + v2.3-Mark (+ A2E gated)
.\gen_testdata.bat                              # ONNX -> TensorRT (PREBUILD; wymaga TRT)

# weryfikacja
.\run_sample.bat .\_build\release\audio2face-sdk\bin\audio2face-unit-tests.exe
.\run_sample.bat .\_build\release\audio2face-sdk\bin\sample-a2f-executor.exe
```

> Uwaga `uv pip install` z `--extra-index-url` (torch) wymaga `--index-strategy unsafe-best-match`.

## 4. Ścieżka bez logowania NVIDIA (zrealizowana 2026-09-11)

Środowisko użytkownika: **VS 2026 (MSVC 195x)** — CUDA 12.9 go nie wspiera (`cudafe++` crash), więc
zbudowano na **CUDA 13.2** (indeks NVIDIA pip + publiczne wheels), bez instalacji VS2022:

1. **TensorRT 10.13.3.9 bez logowania**: wheels `tensorrt-cu13-libs`/`-bindings` z `https://pypi.nvidia.com`;
   nagłówki z GitHub `NVIDIA/TensorRT@release/10.13`; **import-libs wygenerowane z DLL** (`dumpbin`+`lib`).
   Skrypt: `a2f/scripts/setup-tensorrt-from-pip.ps1` → tworzy `D:\TensorRT-10.13` i ustawia `TENSORRT_ROOT_DIR`.
2. **Python TRT** do venv: `tensorrt-cu13-bindings` + `-libs` (indeks nvidia) + moduł `tensorrt`
   z sdist (metapakiet jest sdist-only) → `import tensorrt` = 10.13.3.9.
3. **Build SDK**: `a2f/scripts/build-sdk.ps1` — CUDA 13.2 + `NVCC_PREPEND_FLAGS="-Xcompiler /Zc:preprocessor"`
   (CCCL wymaga standardowego preprocesora) → **`sample-a2f-executor.exe` + `audio2x.dll` zbudowane**.
   Lokalne patche SDK: 2× `thrust::pair<...>`→`auto` (`animator_cuda.cu`, `multitrack_animator_cuda.cu`,
   CUDA 13 usunęło `thrust::pair`).
4. **`trtexec` bez zipa NVIDIA**: pip nie zawiera binarki, więc `a2f/tools/trtexec_shim.py` implementuje
   używany podzbiór CLI na API Pythona TRT; `audio2x/trt.py` ma hook `TRTEXEC_SHIM` (env) → shim.
5. **Modele A2F z HF bez tokenu** (A2F nie są gated): v3.0, v2.3-Mark, v2.3.1-Claire, v2.3.1-James
   do `a2f/sdk/_data/audio2face-models/` (`hf download nvidia/Audio2Face-3D-*`). Tylko **A2E jest gated** (token).

### ⏳ Aktualny blocker (2026-09-11): OOM przy budowie engines
`gen_sample_data.py` → shim → TRT `buildSerializedNetwork` rzuca `OutOfMemory` (832 MB) na
`virtualMemoryBuffer` — **brak pamięci/commit w systemie** (wolne ~4,4 GB commitu, ~7,7 GB RAM przy
wielu procesach), nie błąd konfiguracji. Fix: zamknąć ciężkie aplikacje / restart, potem:

```powershell
$env:TRTEXEC_SHIM="D:\Projects\Avatar\a2f\tools\trtexec_shim.py"
$env:TENSORRT_ROOT_DIR="D:\TensorRT-10.13"
$env:PYTHONPATH="D:\Projects\Avatar\a2f\sdk\audio2x-common\scripts"
$env:PATH="C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v13.2\bin;D:\TensorRT-10.13\bin;D:\TensorRT-10.13\lib;$env:PATH"
cd D:\Projects\Avatar\a2f\sdk
& D:\Projects\Avatar\a2f\.venv\Scripts\python.exe audio2face-sdk\scripts\gen_sample_data.py
```
Sukces = wpisy `[trtexec-shim] wrote ...network.trt`. Potem `run_sample.bat` + dump do `a2f/fixtures/predict.sample.json`.

## 5. Findings z inspekcji SDK (2026-09-11)

1. **Rig solvera to NPZ** (`BlendshapeSolverDataOwner::Init`): `poseNames[0] == "neutral"`,
   tablica `neutral` (V·3 float32) + jedna tablica-delta na każdy kolejny shape; opcjonalnie
   `frontalMask` (int). SDK nie dostarcza rigu dla naszego awatara — baza musi mieć topologię
   **wyjścia A2F (szablon NVIDIA)**, nie `avatar.glb` (10 meshów, morphy 51+29+4).
   → **decyzja robocza:** solver na rigu ARKit szablonu z paczki modeli
   (`_data/audio2face-models/audio2face-3d-v2.3-mark/bs_skin.npz`) i przenoszenie wag ARKit
   po nazwie na MetaPerson (brak `tongueOut` → no-op). `extract_rig.py` z `avatar.glb` odłożony.
2. **Brak bindingów Pythona w SDK** — API to C++ (`audio2x.dll` + nagłówki). Wrapper 09-02
   musi być cienkim CLI C++ (albo `ctypes` do DLL), a FastAPI go opakuje. Do decyzji w 09-02.
3. Sample low-level (`sample-a2f-low-level-api-fullface`) pokazuje pełny pipeline:
   `AudioAccumulator` → `InferenceEngine` (TRT) → animatory (PCA skin/tongue/teeth/eyes) →
   geometria + jaw transform + eye rotation; testy solvera używają `bs_skin.npz`/`bs_tongue.npz`.

## 5. Licencje

- SDK: MIT; modele A2F-3D: NVIDIA Open Model License (darmowe); A2E: gated click-through;
  NIM/NGC: EULA NVAIE — **nie używamy** w PoC.

## 6. Troubleshooting

| Objaw | Przyczyna | Fix |
|---|---|---|
| `fetch_deps` → `CreateDirectoryIOError G:\packman-repo` | `PM_PACKAGES_ROOT` wskazywał na niedostępny `G:` | ustaw `PM_PACKAGES_ROOT=D:\packman-repo` (już ustawione w env user) |
| `build.bat` → „TENSORRT_ROOT_DIR is not defined" | brak env | ustaw `$env:TENSORRT_ROOT_DIR="C:\TensorRT-10.13"` |
| `uv pip install` błąd `certifi==...` | kolejność indeksów (pytorch) | dodaj `--index-strategy unsafe-best-match` |
| Sample: „Unable to parse file…" | brak `_data\generated` | uruchom `download_models.bat` + `gen_testdata.bat` |