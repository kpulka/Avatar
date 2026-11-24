# A2F local setup — local NVIDIA Audio2Face-3D PoC (Phase 9)

> Instructions for setting up and verifying a local A2F (SDK MIT + HF weights) on an RTX 3090, Windows, without containers.
> Updated: 2026-09-11 (status rows corrected 2026-11-24 from `.planning/STATE.md`). Server contract (the `/predict` wrapper) → `docs/7-audio2face-cloudrun.md` §5.

## 1. Environment status (2026-09-11)

| Component | Requirement | Status |
|---|---|---|
| GPU + driver | NVIDIA, VRAM ≥ 4 GB | ✅ RTX 3090 24 GB, driver 595.79 |
| CUDA Toolkit | ≥12.8, <13.0 (12.9 recommended) | ✅ **12.9.1** (`...\CUDA\v12.9`; `CUDA_PATH` user = v12.9; alongside 13.2) |
| TensorRT | ≥10.13, <11.0 | ✅ **10.13.3.9** installed without an NVIDIA login (pip wheels, §4; the manual download in §2.2 was not needed). Recorded in `.planning/STATE.md` (2026-09-12). |
| Python | 3.8–3.10.x | ✅ 3.10.20 (uv) + venv `a2f/.venv` |
| Python dependencies | `deps/requirements.txt` | ✅ (torch 2.7.1+cu128, onnx, huggingface-hub) |
| Build tools | CMake/Ninja | ✅ `fetch_deps.bat` → `_deps/build-deps` |
| Visual Studio C++ | VS2022+ | ✅ VS 18 Enterprise |
| git + git-lfs | — | ✅ 2.53 / 3.7.1 |
| HF account + A2E license | gated `nvidia/Audio2Emotion-v2.2` | ⏳ to do (Read token) |
| SDK | `NVIDIA/Audio2Face-3D-SDK` | ✅ cloned to `a2f/sdk` |
| Containers | — | not needed locally; the F10 image is built with **Podman Desktop** |

Reproduction: `powershell -ExecutionPolicy Bypass -File a2f/scripts/preflight.ps1`.

## 2. Missing steps (blockers)

### 2.1 Hugging Face account + A2E license
1. Account at `https://huggingface.co` (free).
2. Accept the license at `https://huggingface.co/nvidia/Audio2Emotion-v2.2` ("Agree and access repository").
3. Read token (gated): `https://huggingface.co/settings/tokens`.
4. In the venv: `a2f\.venv\Scripts\activate` → `hf auth login` (paste the token; **never** into the repo or the chat).

### 2.2 TensorRT 10.13+ (requires an NVIDIA account)
1. `https://developer.nvidia.com/tensorrt` → sign in.
2. Download **TensorRT 10.13.x — Windows x86_64 ZIP** (compatible with CUDA 12.9).
3. Unpack to `C:\TensorRT-10.13` (it does not need to be on PATH; in the build we set `TENSORRT_ROOT_DIR`).

## 3. Build + models + testdata

In PowerShell (venv active, or `uv pip` — deps already installed):

```powershell
cd D:\Projects\Avatar\a2f\sdk
$env:PM_PACKAGES_ROOT = "D:\packman-repo"      # set permanently in the user env
$env:CUDA_PATH        = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.9"
$env:TENSORRT_ROOT_DIR= "C:\TensorRT-10.13"
git lfs pull
.\build.bat all release                        # requires TENSORRT_ROOT_DIR

# models (after hf auth login)
a2f\.venv\Scripts\activate
python -m ... # run download_models.bat inside the venv:
..\..\a2f\.venv\Scripts\python.exe --version
.\download_models.bat                           # A2F v3.0 + v2.3-Mark (+ A2E gated)
.\gen_testdata.bat                              # ONNX -> TensorRT (PREBUILD; requires TRT)

# verification
.\run_sample.bat .\_build\release\audio2face-sdk\bin\audio2face-unit-tests.exe
.\run_sample.bat .\_build\release\audio2face-sdk\bin\sample-a2f-executor.exe
```

> Note: `uv pip install` with `--extra-index-url` (torch) requires `--index-strategy unsafe-best-match`.

## 4. Path without NVIDIA login (completed 2026-09-11)

User environment: **VS 2026 (MSVC 195x)** — CUDA 12.9 does not support it (`cudafe++` crash), so the build was made on **CUDA 13.2** (NVIDIA pip index + public wheels), without installing VS2022:

1. **TensorRT 10.13.3.9 without login**: wheels `tensorrt-cu13-libs`/`-bindings` from `https://pypi.nvidia.com`; headers from GitHub `NVIDIA/TensorRT@release/10.13`; **import libs generated from the DLLs** (`dumpbin` + `lib`). Script: `a2f/scripts/setup-tensorrt-from-pip.ps1` → creates `D:\TensorRT-10.13` and sets `TENSORRT_ROOT_DIR`.
2. **Python TRT** into the venv: `tensorrt-cu13-bindings` + `-libs` (nvidia index) + the `tensorrt` module from an sdist (the metapackage is sdist-only) → `import tensorrt` = 10.13.3.9.
3. **Build the SDK**: `a2f/scripts/build-sdk.ps1` — CUDA 13.2 + `NVCC_PREPEND_FLAGS="-Xcompiler /Zc:preprocessor"` (CCCL requires the standard preprocessor) → **`sample-a2f-executor.exe` + `audio2x.dll` built**. Local SDK patches: 2× `thrust::pair<...>` → `auto` (`animator_cuda.cu`, `multitrack_animator_cuda.cu`; CUDA 13 removed `thrust::pair`).
4. **`trtexec` without NVIDIA's zip**: pip does not include the binary, so `a2f/tools/trtexec_shim.py` implements the subset of the CLI that is used, on top of the TRT Python API; `audio2x/trt.py` has a `TRTEXEC_SHIM` hook (env) → shim.
5. **A2F models from HF without a token** (A2F models are not gated): v3.0, v2.3-Mark, v2.3.1-Claire, v2.3.1-James into `a2f/sdk/_data/audio2face-models/` (`hf download nvidia/Audio2Face-3D-*`). Only **A2E is gated** (token).

### ⏳ Last recorded blocker (2026-09-11): OOM while building the engines
Still listed as open in `.planning/STATE.md` (entry of 2026-11-18): a retry needs the owner's consent because it is a heavy GPU/RAM job. The text below is the 2026-09-11 record.
`gen_sample_data.py` → shim → TRT `buildSerializedNetwork` throws `OutOfMemory` (832 MB) on `virtualMemoryBuffer` — **not enough memory/commit in the system** (only about 4.4 GB of commit free and ~7.7 GB of RAM with several processes running), not a configuration error. Fix: close heavy applications / restart, then:

```powershell
$env:TRTEXEC_SHIM="D:\Projects\Avatar\a2f\tools\trtexec_shim.py"
$env:TENSORRT_ROOT_DIR="D:\TensorRT-10.13"
$env:PYTHONPATH="D:\Projects\Avatar\a2f\sdk\audio2x-common\scripts"
$env:PATH="C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v13.2\bin;D:\TensorRT-10.13\bin;D:\TensorRT-10.13\lib;$env:PATH"
cd D:\Projects\Avatar\a2f\sdk
& D:\Projects\Avatar\a2f\.venv\Scripts\python.exe audio2face-sdk\scripts\gen_sample_data.py
```
Success = `[trtexec-shim] wrote ...network.trt` entries. Then `run_sample.bat` + a dump to `a2f/fixtures/predict.sample.json`.

## 5. Findings from the SDK inspection (2026-09-11)

1. **The solver rig is an NPZ** (`BlendshapeSolverDataOwner::Init`): `poseNames[0] == "neutral"`, a `neutral` array (V·3 float32) + one delta array per subsequent shape; optionally `frontalMask` (int). The SDK does not supply a rig for our avatar — the base must have the topology of the **A2F output (NVIDIA template)**, not `avatar.glb` (10 meshes, morphs 51+29+4).
   → **working decision:** solve on the ARKit rig of the template from the model package (`_data/audio2face-models/audio2face-3d-v2.3-mark/bs_skin.npz`) and transfer the ARKit weights by name to MetaPerson (no `tongueOut` → no-op). `extract_rig.py` from `avatar.glb` is postponed.
2. **No Python bindings in the SDK** — the API is C++ (`audio2x.dll` + headers). The 09-02 wrapper must be a thin C++ CLI (or `ctypes` to the DLL), which FastAPI will wrap. To be decided in 09-02.
3. The low-level sample (`sample-a2f-low-level-api-fullface`) shows the full pipeline: `AudioAccumulator` → `InferenceEngine` (TRT) → animators (PCA skin/tongue/teeth/eyes) → geometry + jaw transform + eye rotation; the solver tests use `bs_skin.npz`/`bs_tongue.npz`.

## 5. Licenses

- SDK: MIT; A2F-3D models: NVIDIA Open Model License (free); A2E: gated click-through; NIM/NGC: NVAIE EULA — **not used** in the PoC.

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `fetch_deps` → `CreateDirectoryIOError G:\packman-repo` | `PM_PACKAGES_ROOT` pointed to the unavailable `G:` drive | set `PM_PACKAGES_ROOT=D:\packman-repo` (already set in the user env) |
| `build.bat` → "TENSORRT_ROOT_DIR is not defined" | env var not set | set `$env:TENSORRT_ROOT_DIR="C:\TensorRT-10.13"` |
| `uv pip install` error `certifi==...` | index order (pytorch) | add `--index-strategy unsafe-best-match` |
| Sample: "Unable to parse file…" | missing `_data\generated` | run `download_models.bat` + `gen_testdata.bat` |
