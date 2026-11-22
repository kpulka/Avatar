# a2f/ — local NVIDIA Audio2Face-3D PoC (Phase 9)

**Primary** path: Audio2Face-3D SDK (MIT) + weights on HuggingFace (NVIDIA Open Model License).
The NIM/NGC path is for comparison only (NVAIE EULA), see `docs/a2f-local-setup.md` and `.planning/phases/09-a2f-local-poc/09-CONTEXT.md`.

## Target structure

```
a2f/
  README.md            ← this file (toolchain + steps)
  sdk/                 ← clone of https://github.com/NVIDIA/Audio2Face-3D-SDK (binaries are not committed)
  rig/                 ← ARKit-52 extract from public/models/avatar.glb (extract_rig.py, 09-01)
  fixtures/            ← real dump of the solver response (predict.sample.json) — contract for 09-02
  wrapper/             ← FastAPI /predict + /status + pytest (09-02)
  tools/extract_rig.py ← neutral+deltas rig from avatar.glb (09-01)
  scripts/
    start.ps1|sh       ← start the wrapper (09-02)
    stop.ps1|sh        ← stop the wrapper
    preflight.ps1      ← toolchain readiness check (ALREADY THERE)
  docker/              ← production OCI image (Phase 10; built with Podman Desktop)
```

## Environment requirements (state as of 2026-09-02, verified on the user's machine)

| Component | Required by the SDK | Current state | Action |
|---|---|---|---|
| GPU + driver | NVIDIA, CUDA-capable, VRAM ≥ 4 GB | RTX 3090 24 GB, driver 595.79 | ✓ |
| CUDA Toolkit | **12.8–12.9** (`>=12.8, <13.0`; 12.9 recommended) | ✅ **12.9.1 installed alongside 13.2** (`C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.9`; CUDA_PATH user = v12.9) | set `CUDA_PATH` to v12.9 in the build session |
| TensorRT | **>=10.13, <11.0** | ❌ missing | log in to developer.nvidia.com → TensorRT 10.13.x **Windows x86_64 ZIP** → extract to `C:\TensorRT-10.13` |
| Python (SDK tooling) | **>=3.8, <=3.10.x** | ✅ **3.10.20 (uv) + `a2f/.venv`** | done |
| Visual Studio | MSBuild VS2022+ (C++) | ❓ | VS2022 + "Desktop development with C++" |
| git + git-lfs | SDK clone / data | — | check `preflight` |
| HF account | A2E click-through (gated) + token | — | `hf auth login` (Read gated) |
| Containers | Podman Desktop (instead of Docker) — only for the Phase 10 image | Podman Desktop | OK; Docker not needed |

> Key blocker: **CUDA 13.2 vs the `<13.0` requirement**. The SDK README builds against CUDA 12.x.
> Path: install CUDA Toolkit **12.9** (the installer allows several versions side by side),
> TensorRT **10.13** (compatible with 12.9), and at build time set `CUDA_PATH`/`-DCUDA_PATH` to 12.9
> and `TENSORRT_ROOT_DIR` to 10.x. Verify whether the SDK version on main supports CUDA 13 —
> if so, this blocker goes away (check the README after `git clone`).

## Steps (09-01)

> **Status 2026-09-11:** SDK clone ✅, `git lfs pull` ✅, Python dependencies ✅, `fetch_deps` ✅.
> Missing: TensorRT (TODO item 2.2) → `build.bat`, HF login (item 3) → `download_models`/`gen_testdata`.
> Full instructions: [`docs/a2f-local-setup.md`](../docs/a2f-local-setup.md).

1. `powershell -ExecutionPolicy Bypass -File a2f/scripts/preflight.ps1` — readiness report.
2. Install the missing items from the table above (CUDA 12.9, TensorRT 10.13, VS2022 C++, `uv python install 3.10`).
3. `git clone https://github.com/NVIDIA/Audio2Face-3D-SDK a2f/sdk` + `git lfs pull`.
4. In a Python 3.10 venv: `fetch_deps`, `hf auth login`, `download_models` (v3.0 diffusion primary;
   v2.3-Mark for comparison; A2E v2.2 gated), `gen_testdata` (**TRT engines prebuild** — without it
   the first run builds the engine = minutes).
5. `run_sample` on an EN sample → **dump the real output** to `a2f/fixtures/predict.sample.json`
   (09-02 replay test) + note: blendshape names/units, **whether eyeBlink L/R is present** (carriesEyes), fps/step.
6. `a2f/tools/extract_rig.py` — ARKit-52 rig from `public/models/avatar.glb` (input of `IBlendshapeSolver`).
7. Wrapper (09-02): FastAPI `/predict` + `/status` + pytest (replay against the fixture).

## Licenses

- SDK: **MIT** (C++/Python code) — fine commercially.
- A2F-3D models (HF): **NVIDIA Open Model License** — free.
- Audio2Emotion: gated (click-through) — free after acceptance.
- NIM/NGC: NVIDIA AI Enterprise EULA — **NOT used** in the PoC (paid for production).

## GPU/Windows note

The SDK builds natively on Windows (CUDA/TRT/MSVC). Containers are not needed for the PoC.
The OCI image (SDK+models+rig) is built with **Podman Desktop** only for Phase 10 (scale-to-zero on Cloud Run L4).
