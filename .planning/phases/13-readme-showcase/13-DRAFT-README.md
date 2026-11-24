> Working draft (13-DRAFT). Destination: `README.md` at repo root via plan 13-01.
> Facts verified 2026-11-18 (13-CONTEXT §1.3). Slots marked `<!-- 13-03 … -->` /
> `<!-- 18-0x … -->` are filled by their owning plans; nothing else changes them.

# Avatar — a real-time conversational 3D avatar in the browser

An interactive, realistic 3D avatar that **holds a voice conversation with you**: it hears
you (mic), thinks and answers out loud (ElevenLabs Conversational AI), and its face —
lips, gaze, blinks, micro-movements — stays synchronized with the speech, including when
you interrupt it mid-sentence (*barge-in*: audio stops in < 50 ms, the face relaxes in
< 300 ms, nothing freezes).

<!-- 13-03: hero screenshot (dark theme, avatar mid-speech). Alt: "The Avatar talking —
     mouth shapes match the audio waveform playing in real time." ≤ 300 kB. -->

**What makes it interesting:** lip-sync here is not canned blendshape playback. The
client schedules visemes and audio on a *single clock* (`AudioContext.currentTime`),
converts English text to phonemes with CMUdict + fallback rules, coarticulates them with
per-muscle-group smoothing, and supports a second neural animation track (NVIDIA
Audio2Face frames) through the same state machine and barge-in discipline. TypeScript
(strict), ~200 tests, and a planning process that documents every architectural decision.

## Quickstart

```bash
git clone https://github.com/kpulka/Avatar.git
cd Avatar
npm install
npm run dev        # → http://localhost:5310
```

That's it for the visuals — the avatar model ships in the repo (committed in 11.2, SHOW-09), so the app renders a
real MetaPerson head with zero setup. Requires Node.js 20+.
<!-- amended 2026-11-19 — see 11.1/11.2 -->

**Hear it right away:** press **Listen** — the avatar speaks a recorded demo sentence with
full lip-sync and captions. No agent, no microphone, no backend (SHOW-01).

**To actually talk with it** (optional): paste the public `agent_id` of an
ElevenLabs Conversational AI agent in Studio → Session (saved in your local settings;
a `?agent_id=` URL parameter takes priority) and allow microphone access. Everything
below works with no agent and no backend at all:

- **Listen demo** — recorded TTS sentence with real timing alignment and captions (SHOW-01).
- **A2F frames demo** — plays a synthetic clip of the neural frame track
  (what NVIDIA Audio2Face will drive end-to-end).
- **Studio** — `?studio=1` (or Ctrl+Shift+D) opens the tweaker layer: viseme
  calibration, per-shape inspector, telemetry, scene presets, A/B algorithm compare.
- **Presentation mode** — press `H` or `Esc` to hide all UI.

<details>
<summary>Troubleshooting</summary>

- **No conversation?** The voice loop needs a *public* `agent_id` (ElevenLabs dashboard →
  Conversational AI agent → "Public"). API keys are never used client-side.
- **Port 5310 busy?** It's pinned on purpose (`vite.config.ts`) — change it there.
- **Mic blocked?** The browser gates it per-origin; check the address-bar permission.
- **No WebGL?** The app shows a readable fallback card instead of a black canvas.

</details>

<!-- 18-05: live demo link line — "Try it without installing anything: <GitHub Pages URL>"
     (demo mode: avatar + demo speech, conversation = bring-your-own agent_id). -->

## What works today

| Area | Status |
|---|---|
| Voice conversation loop (mic → agent → speech) | ✅ Working |
| EN lip-sync on phonemes (CMUdict G2P, silent letters absorbed) | ✅ Working |
| PL lip-sync (digraphs sz/cz/rz/dź/dż, nasals ą/ę) | ✅ Working |
| Barge-in (epoch-based, < 300 ms to neutral face) | ✅ Working |
| Dual UI: clean user layer + hidden studio (`?studio=1`) | ✅ Working |
| A/B compare of animation tracks on the same utterance | ✅ Working |
| NVIDIA Audio2Face — local (RTX 3090) | 🧪 Designed, scaffolded in `a2f/` — not wired end-to-end yet |
| NVIDIA Audio2Face — cloud (Cloud Run, scale-to-zero) | 🧪 Design + docs, gated on the local go/no-go |

*Verified 2026-11. Live status of every area: [`ARCHITECTURE.md`](ARCHITECTURE.md) §9.*

## Key decisions (and what was rejected)

| Decision | Rejected alternative | Why |
|---|---|---|
| **ElevenAgents** for the whole conversation loop (STT+LLM+TTS+turn-taking server-side) | Own STT/VAD/LLM/TTS pipeline | Turn-taking is the hardest part; the server does it, the client owns time-critical scheduling. Docs: [docs/2](docs/2-elevenlabs-wss-integration.md) |
| **Raw WebSocket** to the agent (not the SDK for playback) | `@elevenlabs/client` audio playback | The SDK plays audio itself → no shared time axis → lip-sync drift. Raw WSS gives PCM + char alignment on our clock. Docs: [docs/2](docs/2-elevenlabs-wss-integration.md) |
| **Character alignment → visemes**, phoneme layer (CMUdict) between text and face | Acoustic viseme extraction (Rhubarb/MFCC WASM) | Alignment arrives with the audio, zero CPU cost; acoustics stay as the fallback path. Docs: [docs/3](docs/3-lip-sync-and-coarticulation.md) |
| **MetaPerson GLB + ARKit-52** blendshapes | Ready Player Me (closed), MetaHuman (needs Unreal/Pixel Streaming) | Realistic, web-optimized, standard morph rig. Docs: [docs/1](docs/1-architecture-and-3d-models.md) |
| **Single writer** (`FaceController` is the only module touching face morph targets) | Letting each feature write shapes | One state machine, one barge-in epoch, no fighting writers. Docs: [docs/4](docs/4-audio-and-barge-in.md) |
| **Epoch-based barge-in** (stale chunks dropped by construction) | Hard reset / frozen face | Late WebSocket audio after an interruption is ignored *by design*, not by luck. Docs: [docs/4](docs/4-audio-and-barge-in.md) |

## Architecture in one paragraph

The server (ElevenAgents) does the AI; the client does time. Audio playback and facial
animation are scheduled on one clock; every chunk carries an epoch so interruptions
invalidate whatever is in flight. Two animation tracks — algorithmic visemes and absolute
neural frames (Audio2Face) — run through the same state machine and safety rules. Layers
are enforced by a test, the event bus is typed, the composition root is a single file,
and every module has one job. Details, diagrams, and "how to extend" recipes:
[ARCHITECTURE.md](ARCHITECTURE.md).

## Documentation

| Doc | What's inside |
|---|---|
| [docs/0-roadmap-poc-mvp.md](docs/0-roadmap-poc-mvp.md) | PoC → MVP plan, acceptance criteria, risk register |
| [docs/1-architecture-and-3d-models.md](docs/1-architecture-and-3d-models.md) | 3D decision matrix, abstraction layers, GLB loading, ARKit-52 |
| [docs/2-elevenlabs-wss-integration.md](docs/2-elevenlabs-wss-integration.md) | Raw WSS protocol, auth, events, char alignment |
| [docs/3-lip-sync-and-coarticulation.md](docs/3-lip-sync-and-coarticulation.md) | Full char/phoneme → ARKit tables (EN + PL), coarticulation, smoothing |
| [docs/4-audio-and-barge-in.md](docs/4-audio-and-barge-in.md) | PCM playback, gapless scheduling, interruption state machine |
| [docs/5-shaders-and-realism.md](docs/5-shaders-and-realism.md) | Skin materials (PBR → pre-integrated SSS), lighting, tone mapping |
| [docs/6-opensource-analysis-and-future.md](docs/6-opensource-analysis-and-future.md) | Open-source landscape, agent-driven emotions, roadmap v2 |
| [docs/7-audio2face-cloudrun.md](docs/7-audio2face-cloudrun.md) | Neural animation track: local PoC → Cloud Run, GPU economics |
| [docs/a2f-local-setup.md](docs/a2f-local-setup.md) | Local Audio2Face environment (TensorRT, models, smoke tests) |
| [docs/en-visemes.md](docs/en-visemes.md) | Working notebook: EN articulation → ARKit parameters, control sentences |
| [docs/animation-runtime.md](docs/animation-runtime.md) | Deep dive: the animation runtime *(landing in v1.1)* |
| [docs/lipsync-deep-dive.md](docs/lipsync-deep-dive.md) | Deep dive: phonemes → visemes pipeline *(landing in v1.1)* |

## How this repo is run

This project uses a spec-driven planning process (openGSD): every phase has a context
document with measured evidence, plans with acceptance criteria, and a verification
record — phases 1–11 were planned in Polish, from v1.1 (phase 12) onward the project
works in English. Decision log and phase map: [`.planning/README.md`](.planning/README.md).

## Verification

```bash
npm run typecheck   # strict TS over src + tests, noUncheckedIndexedAccess
npm test            # ~200 unit/integration tests + gates (language, layering, lifecycle)
npm run build       # tsc + vite production build
```

<!-- 18-03: CI badge here — [![CI](https://github.com/kpulka/Avatar/actions/workflows/ci.yml/badge.svg)](https://github.com/kpulka/Avatar/actions/workflows/ci.yml) -->
<!-- 18-02: License badge + section here — MIT (link to LICENSE). -->

## License

<!-- 18-02: "MIT — see [LICENSE](LICENSE). Dependency licenses: all permissive
     (MIT / Apache-2.0 / BSD / ISC); see THIRD-PARTY-NOTICES.md." -->
To be added in v1.1 (Phase 18) — the dependency tree is permissive-only and has been
audited for it.
