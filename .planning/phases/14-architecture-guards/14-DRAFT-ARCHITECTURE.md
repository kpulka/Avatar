> Working draft (14-DRAFT). Destination: `ARCHITECTURE.md` at repo root via plan 14-05,
> after 14-01..04 land (deletions and strictness fixes shift line numbers — re-verify
> every claim at lift time; the event catalog must be re-grepped from `emit(` call sites).
> Verified against the tree on 2026-11-18.

# Architecture

Avatar is a real-time 3D conversational avatar that runs entirely in the browser: a
MetaPerson head rendered with Three.js, driven by ElevenLabs Conversational AI over a raw
WebSocket, with lips, gaze, blinks, and micro-movements synchronized to speech — including
natural interruptions (*barge-in*) that stop audio and relax the face in under 300 ms.

This document explains how the code is put together, the rules that keep it that way, and
the seams it was built to grow through. It is written for a reviewer opening the repository
cold: every claim points at the file that proves it.

## 1. The shape of the system

```
                    ┌──────────────────────────────────────────────┐
                    │            ElevenAgents (server)             │
                    │   ASR ─► LLM ─► TTS ─► turn-taking + VAD     │
                    └───────▲──────────────────────┬───────────────┘
        mic PCM 16 kHz, base64 │                  │ WSS events: audio (PCM + char alignment),
                            (WSS)                 │ interruption, transcripts, vad, tools
                    ┌─────────┴──────────────────▼───────────────┐
                    │              Browser client                 │
                    │                                            │
                    │  audio/      transport + playback           │
                    │  lipsync/    visemes ⨯ phonemes ⨯ A2F frames│
                    │  realism/    gaze, blinks, micro-movement   │
                    │  scene/      lighting, environment, SSS     │
                    │  features/   controllers (orchestration)    │
                    │  ui/         user layer + studio panels     │
                    │  app/        container (wiring) + contracts │
                    └─────────────────────────────────────────────┘
```

The server does the AI; the client does time. Everything that matters for lip-sync is a
*scheduling* problem, so the client owns a single time axis (`AudioContext.currentTime`)
on which both audio playback and facial animation are scheduled — that invariant is what
keeps the mouth on the voice without drift.

## 2. Layers and the rules between them

77 TypeScript modules in 12 directories. The dependency direction is enforced by a test
(`tests/layering.test.ts`), not by convention — the measured contract:

| Layer | Directories | May import | Notes |
|---|---|---|---|
| 0 — foundations | `types/`, `core/`, `scene/`, `prod/` | nothing local (+ three.js, stdlib) | `core/` (renderer, camera, scene) has zero local imports — the renderer really is swappable |
| 1 — domains | `realism/`, `avatar/`, `audio/`, `lipsync/` | lower layers | `audio/` is transport+playback; `lipsync/` is the animation brain (incl. `g2p/` — English grapheme-to-phoneme via CMUdict + rules) |
| 2 — orchestration | `features/` | domains, foundations, app contracts | one controller per concern (conversation, animation, compare, scene, telemetry) |
| 3 — presentation | `ui/` | app contracts, `lipsync` types (panels), foundations | **never** imports `features/` — panels receive injected services |
| 4 — composition | `app/` | everything | but split in two roles ↓ |
| 5 — entry | `main.ts` | `app/`, `ui/` | ≤ ~100 lines |

**The `app/` split that makes this work:** `app/container.ts` is the composition root —
the only module allowed to import from every layer, and *nothing* imports it except
`main.ts`. The rest of `app/` (`app-types.ts`, `events.ts`, `ui-mode.ts`, `store/`) is
*contracts* — freely importable by `features/` and `ui/`. This is why the import graph
has no cycles even though "app imports features" and "features import app" are both true
statements at directory level.

**Documented exceptions** (carried by the gate with reasons): `audio/a2f-backend.ts` →
`lipsync/a2f-parser` and `lipsync/face-controller.ts` → `audio/audio-engine` (a paired
domain dependency: the A2F HTTP client parses frames with the lipsync parser; the
scheduler drives the audio engine); `app/store/*` → `audio`/`lipsync` (settings schema
needs domain defaults and types).

## 3. The composition root and object lifecycle

`src/app/container.ts` is the single wiring point (~344 lines): it constructs the core
three.js objects, domain modules, the settings store, five feature controllers, the UI
shell and its panels, subscribes the bus, and returns `{ services, store, ui, shell,
start, dispose }`.

- `start()` applies persisted settings, shows the loader, loads the default avatar
  (`public/models/avatar.glb` ships in the repo — the app renders something real with
  zero setup), starts the rAF loop, and notifies an embedding parent page if present.
- The rAF loop runs three updates in a fixed order — scene (gaze/micro-movement), face
  animation, scene-preset tweening — then samples FPS for telemetry over a 500 ms window.
- `dispose()` is a 24-step teardown: rAF, three window listeners, nine stored
  subscriptions, the shell, five controllers, and the UI primitives — every one
  individually released.

**The lifecycle rule** (enforced by a regression test): every `bus.on(...)` subscription
created anywhere in `app/` must be collected and released in `dispose()`. After dispose,
the bus holds zero handlers — a test asserts it (`tests/container.test.ts`), so a future
subscription added without an `Unsub` fails CI instead of leaking for the session.

## 4. Communication: events up, commands down

Two directions, two mechanisms, one boundary — declared in `src/app/app-types.ts:1-7`:

- **State flows up** on a typed event bus (`src/app/events.ts`). `TypedEventBus<AppEvents>`
  with deliberate invariants: `on()` returns an *idempotent* `Unsub`; `emit()` iterates a
  copy of the handler set (unsubscribing during emission is safe); one handler throwing
  never breaks the others.
- **Commands flow down** by service references. `AppServices` exposes eight typed
  contracts (conversation, animation, telemetry, scene, animationSources, compare,
  lastTurn, scenePresets). UI panels call services; they never reach into controllers.

The event surface is small and closed — 16 events (voice state/error/muted, user/agent
transcripts, audio chunks with alignment, interruptions, A2F stats, toasts, avatar
loaded, animation source, scene preset, and four compare lifecycle events). Names follow
`domain:action`. The full producer/consumer catalog lives in the appendix table
(14-05 re-greps it from `emit(` call sites before publishing).

## 5. The face pipeline (brief — deep dive in `docs/animation-runtime.md`)

One writer, one clock, one epoch:

- **Single writer:** `FaceController` (`src/lipsync/face-controller.ts`) is the only
  module that writes facial morph targets. Everything else — viseme scheduler, A2F frame
  playback, emotion base, procedural blinks — hands *it* values; nothing touches
  `morphTargetInfluences` directly.
- **One clock:** speech animation and audio are scheduled on `AudioContext.currentTime`
  (gapless PCM playback in `src/audio/audio-engine.ts`); RELAXING uses the wall clock by
  documented rationale (it's a UI ease, not an audio event); damping is FPS-independent
  (`1 − exp(−λ·dt)`).
- **One epoch:** barge-in increments an epoch on the audio engine and the face
  controller; every in-flight chunk/frame carries its epoch and is dropped on mismatch.
  Late WebSocket audio after an interruption is ignored by construction, not by hoping it
  doesn't happen. Interruption handling is idempotent.
- **Two animation tracks, same spine:** `viseme` mode (scheduler + coarticulation +
  per-muscle-group smoothing) and `frames` mode (absolute values from NVIDIA Audio2Face
  output, parsed by `src/lipsync/a2f-parser.ts` into `FramesClip`s) — switchable per turn,
  with the same state machine, epoch, and rig safety in both.

## 6. Extension seams — how to add things

Each recipe lists every file you need to touch. If a change needs more than this, that's
a bug in the architecture, not a rite of passage.

- **A panel** (studio or user layer): register in the panel registry
  (`{id, title, mount, visibleIn}`) — the shell, lazy tabs, and error boundaries come
  from the contract; the panel receives injected services. Moving a panel between the
  user and studio personas is a one-field change (`visibleIn`).
- **An animation source** (the AvatarDirector direction — body gestures, a second
  neural track): register in `AnimationSourceRegistry` and implement the source strategy
  seam. Caveat: the `LIVE | A2F` short-label union is closed until the Phase 16 refactor
  opens it.
- **A scene preset**: one entry in `SCENE_PRESETS` (background, lighting rig, camera
  frame) — the tweening, reduced-motion handling, and theme sync come along.
- **An event**: one entry in `AppEvents` (TS guarantees name/payload consistency), emit
  from the owning controller, subscribe where needed, add the catalog row.
- **A speech backend**: `src/audio/speech-backend.ts` already isolates transport — the
  rest of the app consumes normalized chunk events with alignment.

## 7. Quality gates that run on every `npm test`

Beyond unit tests (~204, vitest + jsdom):

- **Language gate** (`tests/language.test.ts`) — the repo's user-facing English is
  enforced, with an explicit allowlist for functional Polish phonetic data (the avatar
  genuinely speaks Polish digraphs and nasal vowels; those literals are engine data, not
  copy). Also checks doc-link integrity.
- **Layering gate** (`tests/layering.test.ts`) — the import contract of §2.
- **Lifecycle regression** (`tests/container.test.ts`) — §3's zero-handlers-after-dispose.
- **Full-project typecheck** (`npm run typecheck`) — `src` + `tests`, strict flags
  including `noUncheckedIndexedAccess`, zero `any` casts.

CI (GitHub Actions) runs install → typecheck → test → build on every push and PR
(Phase 18 wiring).

## 8. Build and delivery

Vite + TypeScript (strict). Production chunks are deliberately split: the `three` vendor
chunk (~596 kB) caches independently of app code (~154 kB first render); the CMU
pronouncing dictionary — the heaviest asset in the project — is a *lazy* dynamic import
in the G2P layer, loaded after first render, and Phase 17 replaces the full 961 kB-gzip
dictionary with a build-time-pruned ~10k-word lexicon plus rule fallback. The dev server
runs on port 5310 (`strictPort`).

## 9. What this is not (yet) — honest status

- NVIDIA Audio2Face local inference (RTX 3090 + TensorRT) is designed and scaffolded
  (`a2f/`) but not yet wired end-to-end (Phase 9); cloud deployment (Cloud Run,
  scale-to-zero) waits on that go/no-go (Phase 10).
- Phase 12–18 (v1.1) are in flight: English-ization of docs/UI, README showcase, this
  architecture doc, UI/animation/lipsync refactors, CI + license + hygiene.
- Deliberately not abstracted: one avatar rig (MetaPerson GLB, ARKit-52), one language
  pair (EN speech + PL phonetic support), desktop browsers first. The seams exist where
  those decisions would reverse; the code doesn't pay for flexibility it doesn't use.

---

*Appendix (added at lift time, 14-05): the 16-event producer/consumer catalog, the
dispose-step table, and the layering exceptions list — all generated from the tree, not
hand-copied.*
