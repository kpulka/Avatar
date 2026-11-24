# Avatar — a real-time conversational 3D avatar in the browser

An interactive 3D avatar that **holds a voice conversation with you**. It listens through your microphone, answers out loud through ElevenLabs Conversational AI, and keeps its lips, gaze and blinks in step with the speech. When you interrupt it mid-sentence (*barge-in*), the old audio is dropped and the face returns to neutral.

<!-- 13-03: hero screenshot (dark theme, avatar mid-speech). Alt: "The Avatar talking —
     mouth shapes match the audio waveform playing in real time." ≤ 300 kB. -->

**What makes it interesting:** lip-sync is not canned blendshape playback. The client converts English text to phonemes with the CMU Pronouncing Dictionary (with fallback rules for unknown words), maps them to ARKit viseme targets, and schedules them against the same audible clock that plays the audio. Interrupted turns are tagged with an epoch, so late audio from a cancelled turn is ignored by construction. A second animation source, neural frames in the Audio2Face style, goes through the same router. The codebase is TypeScript in strict mode with 855 automated tests in 78 files (measured 2026-11-24), and the planning process records each architectural decision.

## Quickstart

```bash
git clone https://github.com/kpulka/Avatar.git
cd Avatar
npm install
npm run dev        # → http://localhost:5310
```

Requires **Node.js 20.19 or newer** (ESLint 10 sets that floor; CI runs Node 22).

- **The avatar appears with no setup.** The MetaPerson model is committed in the repo (`public/models/avatar.glb`, 11.9 MB) and loads at startup.
- **Hear it right away (no agent, no microphone, no backend):** open the studio with `?studio=1` (or press Ctrl+Shift+D), go to the **Animation** tab, and press **▶ Sample speech (EN)**. The sentence is spoken with generated speech-like audio (synthetic tones, not a recorded voice), character-timed lip-sync and captions. **▶ A2F demo (frames)** plays the bundled recording `public/demo/demo-speech.wav` with generated frames.
- **To talk with it:** in Studio → **Session**, paste the public `agent_id` of an ElevenLabs Conversational AI agent, press **Start conversation** in the dock, and allow microphone access. A `?agent_id=` URL parameter takes priority over the saved value. If neither is set, the app uses the default agent ID bundled in `src/audio/agent-config.ts`.
- **Presentation mode:** press **H** or **Esc** to hide all UI (press again to bring it back).

<details>
<summary>Troubleshooting</summary>

- **The conversation does not start?** The connection banner shows "The conversation could not start" with the error text. The client connects without a signed URL, so the agent must allow public connections. Check the agent ID in Studio → Session.
- **Port 5310 busy?** The port is pinned in `vite.config.ts` (`strictPort: true`), so Vite fails instead of picking another port. Change `server.port` there.
- **Mic blocked?** The browser gates microphone access per origin. Check the permission in the address bar. The app shows the microphone error in the connection banner.
- **No WebGL?** The app shows a fallback card ("WebGL not supported") instead of a black canvas.

</details>

<!-- 18-05: live demo link line — "Try it without installing anything: <GitHub Pages URL>"
     (demo mode: avatar + demo speech, conversation = bring-your-own agent_id). -->

## Status

✅ implemented and covered by automated tests · 🧪 experimental: code exists, not wired end to end · 🚧 planned, documents only. Verified 2026-11-24.

| Area | Status | Evidence |
|---|---|---|
| Voice loop: mic → ElevenLabs agent → speech | ✅ | `tests/raw-wss-client.test.ts`, `tests/speech-backend.test.ts`. A live round trip needs a reachable agent and is not part of the automated suite. |
| English lip-sync (CMUdict phonemes → ARKit visemes) | ✅ | `tests/g2p-en.test.ts`, `tests/viseme-mappings.test.ts` |
| Polish lip-sync (digraphs sz, cz, rz, dz; nasal vowels) | ✅ | Mapping in `src/lipsync/viseme-mappings.ts`. No dedicated Polish test yet. |
| Barge-in (epoch-tagged audio, stale chunks dropped) | ✅ | `tests/barge-in-pipeline.test.ts`, `tests/race-condition-epoch.test.ts` |
| Gaze, blinks, head micro-movements | ✅ | `tests/gaze-saccades.test.ts`, `tests/procedural-blink.test.ts`, `tests/head-micro-movements.test.ts` |
| Dual UI: user layer and studio (`?studio=1`) | ✅ | `tests/ui-mode.test.ts` |
| A/B comparison of animation algorithms on the last turn | ✅ | `tests/compare-controller.test.ts`, `tests/compare-ui.test.ts` |
| Audio2Face, local (neural frames) | 🧪 | `a2f/` proof of concept and `src/lipsync/a2f-parser.ts`. The frame path plays, but no Audio2Face backend is wired end to end. |
| Audio2Face, cloud (Cloud Run) | 🚧 | Design only: `docs/7-audio2face-cloudrun.md` |

## Key decisions (and what was rejected)

| Decision | Rejected alternative | Why |
|---|---|---|
| **ElevenAgents** for the whole conversation loop (speech-to-text, LLM, text-to-speech and turn-taking on the server) | Own STT / VAD / LLM / TTS pipeline | Turn-taking is the hardest part; the server does it, and the client owns the time-critical scheduling. Docs: [docs/2](docs/2-elevenlabs-wss-integration.md) |
| **Raw WebSocket** to the agent | `@elevenlabs/client` audio playback | The SDK plays audio itself, so there is no shared time axis and lip-sync drifts. The raw socket delivers PCM and character alignment on our clock. Docs: [docs/2](docs/2-elevenlabs-wss-integration.md) |
| **Character alignment → visemes**, with a phoneme layer (CMUdict) between text and face | Acoustic viseme extraction (Rhubarb / MFCC WASM) | Alignment arrives with the audio at no CPU cost. Acoustic analysis is deferred as a fallback. Docs: [docs/3](docs/3-lip-sync-and-coarticulation.md) |
| **MetaPerson GLB + ARKit-52** blendshapes | Ready Player Me (closed), MetaHuman (needs Unreal / Pixel Streaming) | A realistic, web-optimized model with a standard morph rig. Docs: [docs/1](docs/1-architecture-and-3d-models.md) |
| **Single writer:** `FaceController` is the only caller that applies face weights | Letting each feature write shapes | One state machine and one barge-in epoch, with no competing writers. Docs: [docs/4](docs/4-audio-and-barge-in.md) |
| **Epoch-based barge-in** (stale chunks dropped by construction) | Hard reset or a frozen face | Late WebSocket audio after an interruption is ignored by design, not by timing luck. Docs: [docs/4](docs/4-audio-and-barge-in.md) |

## Architecture in one paragraph

The server (ElevenAgents) does the AI; the client does the timing. Audio playback and facial animation are scheduled on one audible clock, and every audio chunk carries an epoch so an interruption invalidates whatever is still in flight. Two animation sources, algorithmic visemes and neural frames, are routed by `src/lipsync/animation-router.ts`. The code is split into `src/app` (composition root in `container.ts`, typed event bus, settings), `src/audio` (WebSocket client, microphone capture, audio engine), `src/lipsync` (phonemes, visemes, face controller), `src/avatar` (GLB loader, ARKit driver), `src/features` (controllers) and `src/ui` (user and studio layers). Design details: [docs/1-architecture-and-3d-models.md](docs/1-architecture-and-3d-models.md) and [docs/4-audio-and-barge-in.md](docs/4-audio-and-barge-in.md).

## Documentation

| Doc | What's inside |
|---|---|
| [docs/0-roadmap-poc-mvp.md](docs/0-roadmap-poc-mvp.md) | PoC → MVP plan, risk register, engineering principles |
| [docs/1-architecture-and-3d-models.md](docs/1-architecture-and-3d-models.md) | 3D model decision, abstraction layers, GLB loading, ARKit-52 |
| [docs/2-elevenlabs-wss-integration.md](docs/2-elevenlabs-wss-integration.md) | WebSocket protocol, auth, events, character alignment |
| [docs/3-lip-sync-and-coarticulation.md](docs/3-lip-sync-and-coarticulation.md) | Character and phoneme → ARKit tables (EN and PL), coarticulation, smoothing |
| [docs/4-audio-and-barge-in.md](docs/4-audio-and-barge-in.md) | PCM playback, gapless scheduling, interruption handling |
| [docs/5-shaders-and-realism.md](docs/5-shaders-and-realism.md) | Skin materials, lighting, tone mapping |
| [docs/6-opensource-analysis-and-future.md](docs/6-opensource-analysis-and-future.md) | Open-source landscape, agent-driven emotions, later phases |
| [docs/7-audio2face-cloudrun.md](docs/7-audio2face-cloudrun.md) | Neural track: local PoC to a Cloud Run deployment plan |
| [docs/a2f-local-setup.md](docs/a2f-local-setup.md) | Local Audio2Face environment setup |
| [docs/en-visemes.md](docs/en-visemes.md) | Working notes: English articulation → ARKit parameters |

How the code is layered, how events flow and how to extend it: [ARCHITECTURE.md](ARCHITECTURE.md). The animation runtime and the lip-sync pipeline are covered in [docs/4](docs/4-audio-and-barge-in.md) and [docs/3](docs/3-lip-sync-and-coarticulation.md).

## How this repo is run

The project uses GSD (Get Shit Done), a spec-driven planning workflow: every phase has a context document, plans with acceptance criteria, and a verification record. Phases 1 to 11 are kept in Polish as a historical record; from phase 12 onward the project is in English. Decision log and phase map: [`.planning/README.md`](.planning/README.md).

## Verification

```bash
npm run verify
```

One chain, stops at the first failing step (the failing step is the last one named in the output). It is `typecheck && test && build && lint && format:check`; the steps also run on their own:

```bash
npm run typecheck     # tsc over src AND tests (tsconfig.test.json), noUncheckedIndexedAccess on
npm test              # vitest: unit tests, the language gate, the import-layer gate
npm run build         # tsc (strict, src only) + vite production build
npm run lint          # ESLint (typescript-eslint, type-checked), zero warnings, layering rule
npm run format:check  # Prettier over src, tests and the TS config files
```

855 tests in 78 files, measured 2026-11-24 with `npx vitest run --dir tests`; `npm run verify` took about 22 s on the development machine. The CI workflow runs the same steps on every push and pull request.

The workflow in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs `npm ci`, `typecheck`, `lint`, `format:check`, `test` and `build` on Node 22 for every push to `master` and every pull request. Its status:

[![CI](https://github.com/kpulka/Avatar/actions/workflows/ci.yml/badge.svg)](https://github.com/kpulka/Avatar/actions/workflows/ci.yml)

## License

Copyright (c) 2026 kpulka. All rights reserved. This project is **All Rights Reserved**: no license is granted to use, copy, modify or distribute it. See [LICENSE](LICENSE) for the terms. Commercial use requires written permission from the owner, requested through [github.com/kpulka](https://github.com/kpulka).

Third-party dependencies keep their own licenses. All 157 lock-file entries declare permissive licenses (MIT, Apache-2.0, BSD, ISC and similar), as recorded in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) (audited 2026-11-24).
