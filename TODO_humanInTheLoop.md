# TODO — human in the loop

> Tasks that **the agent will not do for you** (system installs, accounts, visual evaluation,
> GO/NO-GO decisions). Do them in order; after each step there is a "How to verify" check.
> **Updated: 2026-09-10** (after Phase 11 — new UI: user layer + Studio).

## Project status (context)

| Area | Status |
|---|---|
| Phase 7 — UAT 07-04 | ⏸ deferred (resume after Phase 10) |
| Phase 8 — code 08-01..03 (frames track + parser + router/demo) | ✅ implemented, `npm test` green |
| Phase 8 — 08-04 (UAT + 08-VERIFICATION.md) | ⏳ **waiting for you** (item 1, together with the F11 UAT) |
| Phase 11 — code 11-01..11-07 (store/panels/compare/user/scene presets) | ✅ `npm test` **41 files / 202 tests** + build green |
| Phase 11 — manual UAT | ⏳ **waiting for you** (item 1) |
| Phase 9 — client (a2f-backend, A2F panel in Studio, source registry, LIVE/A2F segment) | ✅ implemented |
| Phase 9 — environment (CUDA/TensorRT/Python) | ⏳ **waiting for you** (item 2) |
| Phase 9 — A2F-3D SDK + rig + wrapper | 🔒 after the installs (items 3–5) |
| Phase 10 — Cloud Run (scale-to-zero) | 🔒 only after GO from Phase 9 |

> **GSD:** run the UAT from item 1 as `/gsd-verify-work 11` (conversational, point by point);
> the installs (item 2) are independent and can run in parallel. The agent closes F8/F11 per
> STATE → Pending Todos (A3/A4).

---

## 1. F11 UAT + finishing the F8 UAT (manual, ~30–40 min) — before we close the phases

Run: `npm run dev`. One pass below covers the **F11 UAT** (`11-VERIFICATION.md` §3) and **08-04**
(through the new UI).

**A. Studio → Animation (formerly "Calibrator"):**
- [ ] Load a model (`avatar.glb` loads automatically; fallback: Studio → Scene → "Load demo").
- [ ] Animation source: "A2F (frames)" → "▶ Demo A2F (frames)" → the mouth animates smoothly and you hear the voice from `public/demo/demo-speech.wav`.
- [ ] "Interrupt" (🛑 in the user dock) during the demo → the mouth returns to neutral in < 300 ms, no freeze. *(08-04)*
- [ ] Return to LIVE visemes (LIVE/A2F segment) → "Demo" (dock) → normal viseme lip-sync (regression check). *(08-04)*
- [ ] Change the source **while** speaking → the face is not cut mid-word (the switch happens at a turn boundary). *(08-04)*

**B. User layer (new):**
- [ ] "Start conversation" → the conversation works; the button changes to "End conversation".
- [ ] "Compare A/B" after one turn → the same utterance in both lanes (chips/result); interrupting with a new turn stops the replay.
- [ ] "Blind mode" → labels hidden until the result is shown.
- [ ] ⚙ (top right corner) → volume, microphone choice (if you see a device list), theme, scene preset.
- [ ] A/B audio fairness: record both lanes (audibly identical recording; RMS diff < 1% — held out).

**C. Scene / performance:**
- [ ] 4 scene presets (Studio → Scene and ⚙ → Scene preset): background/light/framing change with a 280 ms crossfade; `cinema` has the vignette; `light` uses the light theme. Take a screenshot of each.
- [ ] **~60 FPS** in both modes and on every preset (FPS meter in Studio → Session). *(08-04 + F11 backstop)*
- [ ] Tab through the UI: focus-visible is visible; aria-label on ⚙ and the close buttons; `prefers-reduced-motion` (in the OS) disables the animations.

**D. Locks / tweaker:**
- [ ] Studio → Session → set a lock, e.g. `volume`; check in the user ⚙ that the control is disabled with a tooltip; unlock it.
- [ ] Export the profile (JSON) → import on a fresh profile → values come back; bad JSON → a readable error without a state change.

After a PASS write "**UAT OK**" (plus any FAILs). The agent runs `/gsd-verify-work 11` to finish the record,
creates `08-VERIFICATION.md` and `11-VERIFICATION.md` → `manual_uat: pass`, and closes A3/A4.

## 2. Phase 9 environment — system installs (do this first)

> Check the status: `powershell -ExecutionPolicy Bypass -File a2f/scripts/preflight.ps1`
> (currently: CUDA 13.2 ⚠, no TensorRT ⚠, no Python 3.10 ⚠, the rest ✅).

| # | Task | How to do it (Windows) | How to verify |
|---|---|---|---|
| 2.1 | ~~**CUDA Toolkit 12.9**~~ | ✅ **done 2026-09-11** (12.9.1, toolkit-only, alongside 13.2; user CUDA_PATH = v12.9) | nvcc 12.9: `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.9\bin\nvcc.exe --version` |
| 2.2 | ~~**TensorRT 10.13+**~~ | ✅ **done 2026-09-11 without login** — wheels from `pypi.nvidia.com` + OSS headers + generated import-libs → `D:\TensorRT-10.13` (`a2f/scripts/setup-tensorrt-from-pip.ps1`) | preflight after setting `TENSORRT_ROOT_DIR`; SDK build ✅ (`a2f/scripts/build-sdk.ps1`) |
| 2.3 | ~~**Python 3.10**~~ | ✅ **done 2026-09-11**: `uv python install 3.10` + `a2f/.venv` (3.10.20) | `a2f\.venv\Scripts\python.exe --version` → 3.10.20 |
| 2.4 | (optional) longer demo wav | `speed 0.9` on `public/demo/demo-speech.wav` | file exists |

## 3. Hugging Face account + A2E license consent

- [ ] Account at `https://huggingface.co` + accept the license for `nvidia/Audio2Emotion-v2.2` and the A2F-3D models (v3.0/v2.3).
- [ ] Token (Read, gated): `https://huggingface.co/settings/tokens` → 🔒 only via `hf auth login`, never in chat or in the repo.

## 4. A2F-3D SDK — clone, models, TRT engines (after item 2)

> **Status 2026-09-11:** ✅ cloned (`a2f/sdk`), ✅ `git lfs pull`, ✅ Python deps in `a2f/.venv`, ✅ `fetch_deps.bat`, ✅ **TensorRT 10.13 without login** (pip wheels + generated libs; `D:\TensorRT-10.13`), ✅ **SDK built** (`sample-a2f-executor.exe`), ✅ A2F models (v3.0 + 4×v2.3). ⏳ Blocker: **host memory OOM** during `gen_sample_data` (close heavy apps / restart → command in `docs/a2f-local-setup.md` §4). ⏳ `hf auth login` is needed only for A2E (emotions).
> ⚠️ `extract_rig.py` from `avatar.glb` **postponed** — the solver needs the topology of the A2F output (template NPZ); details: `docs/a2f-local-setup.md` §5.

```powershell
cd D:\Projects\Avatar\a2f\sdk
# (clone already done)
git lfs pull
# venv 3.10: D:\Projects\Avatar\a2f\.venv
$env:CUDA_PATH = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.9"
$env:TENSORRT_ROOT_DIR = "C:\TensorRT-10.13"
.\build.bat all release
# inside the venv:
.\download_models.bat
.\gen_testdata.bat
```
**Check:** `.\run_sample.bat .\_build\release\audio2face-sdk\bin\audio2face-unit-tests.exe` passes.

## 5. REST wrapper + offline E2E (09-02/09-03 — agent + you)

- [ ] After `sample-a2f-executor`: dump the real output → `a2f/fixtures/predict.sample.json` (test contract).
- [ ] Agent: `tools/extract_rig.py` (ARKit-52 rig from `avatar.glb`) + FastAPI wrapper `/predict` + `/status`.
- [ ] You: `a2f/scripts/start.ps1`; check: `http://127.0.0.1:8000/status` → `ready`; in the Studio app → A2F → "▶ Demo A2F" shows real neural frames (toast "predict … ms (RTF …)").

## 6. Quality assessment and GO/NO-GO for the cloud (09-05) — your decision

- [ ] Compare LIVE vs A2F on the control sentences (`docs/en-visemes.md` §6) — or via "Compare A/B" in the UI; fill in the 1–5 table in `09-VERIFICATION.md`.
- [ ] **GO/NO-GO** decision: cloud, scale-to-zero only (~$0.02–0.1 per request); if a cold start would require warm instances → NO-GO.

## 7. (Only after GO) Phase 10 — GCP

- [ ] GCP account + project + billing; Cloud Run GPU L4 (`europe-west1`/`europe-west4`/`us-central1`/`us-east4`).
- [ ] Deploy through the agent with `gcloud` (plans 10-01..); `/gsd-execute-phase 10`.
- [ ] Budget alert ($20/month) + `min-instances=0` without exceptions.

---

## Working rules

- The agent **does not commit** without your consent — you make the commits yourself (or approve A5 in STATE).
- Keys/tokens: **only** via env / git-ignored `.env`; never in chat or in the repo.
- After a block is finished, write briefly what you did + the result of the check command — the agent moves on (GSD queue: `.planning/STATE.md` → Pending Todos).
