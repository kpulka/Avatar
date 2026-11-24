# Architecture

Avatar is a real-time 3D conversational avatar that runs in the browser: a MetaPerson head rendered with Three.js, driven by an ElevenLabs conversational agent over a raw WebSocket, with lips, gaze, blinks and micro-movements synchronized to speech, including natural interruptions (barge-in) that stop the audio and ease the face back to neutral.

This document explains how the code is put together, the rules that keep it that way, and the seams it was built to grow through. It is written for a reader opening the repository cold, and every claim points at the file that proves it as `path:line`.

> **Verified 2026-11-24 against commit `0e893c5`** (every `path:line` reference, the layer table, the event catalog and the teardown table). Line numbers move; when one is off, search for the symbol next to it. Three parts are also checked by `tests/layering.test.ts` and `tests/architecture-doc.test.ts`, so they cannot silently drift: the layer table (section 2), the event catalog (section 4), and the existence of every cited file.

## 1. The shape of the system

```
                  +--------------------------------------------+
                  |            ElevenAgents (server)           |
                  |  speech-to-text, LLM, text-to-speech,      |
                  |  turn-taking and voice-activity detection  |
                  +---------^----------------------+-----------+
     mic PCM 16 kHz, base64 |                      | WSS events: audio (PCM + character
                       (WSS)|                      | alignment), interruption, transcripts
                  +---------+----------------------v-----------+
                  |                Browser client              |
                  |                                            |
                  |  audio/      transport, mic, playback      |
                  |  lipsync/    visemes, phonemes, A2F frames |
                  |  realism/    gaze, emotion, micro-movement |
                  |  scene/      lighting, environment, skin   |
                  |  features/   controllers (orchestration)   |
                  |  ui/         user layer + studio panels    |
                  |  app/        container (wiring) + contracts|
                  +--------------------------------------------+
```

The server does the AI; the client does the timing. Everything that matters for lip-sync is a scheduling problem, so the client keeps one time axis: audio is scheduled gaplessly on the `AudioContext` timeline (`src/audio/audio-engine.ts:42`, `playChunk`), and facial animation reads that timeline through an audible clock that compensates the output latency (`src/audio/audible-clock.ts:5`, `getAudibleTime`; used by `src/lipsync/face-controller.ts:134`). That shared axis is what keeps the mouth on the voice without drift.

The microphone path is the reverse direction: `MicCapture` resamples to 16 kHz PCM and `RawWssClient` sends it as base64 `user_audio_chunk` messages (`src/audio/raw-wss-client.ts:204`; input format fixed in `src/audio/agent-config.ts:10`). The raw socket is a deliberate choice over the vendor SDK: the SDK plays audio itself, so there would be no shared time axis (reasoning in `docs/2-elevenlabs-wss-integration.md`).

## 2. Layers and the rules between them

89 TypeScript modules under `src/`: 88 in eleven directories plus `src/main.ts`. The dependency direction is enforced by a test, not by convention. The contract lives as data in `tests/layering-rules.ts` (no imports, so the ESLint configuration planned for Phase 18 can import the same table) and `tests/layering.test.ts` checks every import statement in `src/` against it. A module may import a layer only if that layer appears in its "May import" cell; imports inside one layer are free.

<!-- layer-table:start -->
| Layer | Contents | May import |
|---|---|---|
| `types` | `src/types/` (2): shared contracts for avatar, audio and wire messages | nothing |
| `core` | `src/core/` (5): renderer, camera, scene, adaptive resolution, three.js disposal | nothing |
| `scene` | `src/scene/` (4): lighting, environment, materials, skin shader | nothing |
| `prod` | `src/prod/` (2): embed bridge (postMessage), telemetry | nothing |
| `realism` | `src/realism/` (5): gaze saccades, head micro-movements, emotion layer, shared animation constants (`anim-config`, `alloc-probe`) | `types` |
| `avatar` | `src/avatar/` (4): GLB loader, ARKit driver, shape normalizer, procedural test avatar | `types` |
| `audio` | `src/audio/` (12): WSS client, mic capture, audio engine, speech backend, A2F client | `types` |
| `lipsync` | `src/lipsync/` (16, including `g2p/`): face controller, viseme scheduler, phoneme layer, A2F parser | `types`, `avatar`, `audio`, `realism` |
| `app-contracts` | `src/app/` contract modules (8): `app-types`, `events`, `ui-mode`, `copy`, `store/*` | `types`, `audio`, `lipsync` |
| `features` | `src/features/` (8): one controller per concern | `types`, `core`, `scene`, `prod`, `realism`, `avatar`, `audio`, `lipsync`, `app-contracts` |
| `ui` | `src/ui/` (21): user layer, studio shell and panels, shared widgets | `types`, `scene`, `lipsync`, `app-contracts` |
| `app-root` | `src/app/container.ts`: the composition root | `types`, `core`, `scene`, `prod`, `realism`, `avatar`, `audio`, `lipsync`, `app-contracts`, `features`, `ui` |
| `entry` | `src/main.ts` | `app-root`, `ui` |
<!-- layer-table:end -->

Three structural facts make the table work:

- **`app/` is two roles, classified per module.** `features/` and `ui/` import `app/` (20 and 24 import statements), but only its contract modules; `container.ts` imports `features/` and `ui/` back. A directory-level rule would call that a cycle. The gate classifies every file under `app/` in `MODULE_RULES` (`tests/layering-rules.ts:53`), `container.ts` is importable by `main.ts` only (`importableBy: ['entry']`, same file), and a new file under `app/` fails the gate until it is classified.
- **`ui/` never imports `features/`.** Panels receive an `AppServices` object by injection (`src/ui/studio/panel-registry.ts:27`, `PanelContext`), so presentation stays testable with plain fakes. The gate asserts zero edges, and one edge crosses sideways on purpose: `ui/studio/panels/scene-panel.ts` imports `scene/skin-shader`, so the subsurface-scattering toggle reaches that module's state directly rather than through a service.
- **Shared animation constants live in `realism/`.** `ANIM_DEFAULTS`, `clamp01` and the allocation probe (`src/realism/anim-config.ts`, `src/realism/alloc-probe.ts`) are used by `realism/`, `lipsync/` and the container. They used to sit in `lipsync/`, which made `realism/` import a higher layer; they moved down in Phase 14 instead of being baselined.

**The one documented exception.** `audio/a2f-backend.ts` imports `lipsync/a2f-parser.ts` (the HTTP client parses the server's frames with the lipsync parser). That edge points upward, so `audio` and `lipsync` form a directory-level pair, although there is no module-level cycle. It is the only entry in `EXCEPTIONS` (`tests/layering-rules.ts:99`), the gate fails if the entry goes stale, and the deferred fix (moving `a2f-backend.ts` under `lipsync/`; two importers in `features/`) is recorded in its reason string. The opposite edge, `lipsync/face-controller.ts` to `audio/audio-engine.ts`, is an ordinary downward import.

What `tests/layering.test.ts` asserts, beyond the allow-table: no module-level import cycles, every module classified, the rule table itself only points downward, `main.ts` stays at or under 100 lines (it is 24, `src/main.ts`), and no module in the domain layers touches `document`, `window`, `localStorage` or `navigator` at module top level (functions and class bodies are fine). Negative self-tests feed the checkers synthetic forbidden edges, so a parser that silently matches nothing would fail.

## 3. The composition root and object lifecycle

`src/app/container.ts` (411 lines) is the single wiring point. `createApp(canvas)` (`:63`) constructs the renderer, camera and scene (`:65-:67`), the domain modules, the settings store (`:81`), the bus (`:102`), the scene, conversation, animation and telemetry controllers (`:138-:161`), the last-turn buffer (`:171`) and compare controller (`:173`) and the scene-preset controller (`:196`), registers the studio and user panels (`:235-:258`), creates the shell (`:263`) and returns `{ services, store, ui, shell, start, dispose }` (`:356`).

- `start()` (`:361`) applies the persisted input device and scene preset, shows the loader, loads the default avatar (`public/models/avatar.glb` ships in the repository, so the app renders something real with zero setup; a procedural avatar is the fallback), starts the animation loop and notifies an embedding parent page.
- The frame loop (`animate`, `:330`) runs three updates in a fixed order: face animation, then the scene (which renders), then scene-preset tweening (`:337-:339`). Face morphs go first so that the render inside the scene update draws this frame's pose. A 500 ms window then feeds FPS to telemetry and to adaptive resolution (`:345-:350`).
- `dispose()` (`:370`) is idempotent and releases 30 things. They are listed below because the table is the contract the regression test enforces.

| Step | What is released | Lines |
|---|---|---|
| Session | `conversationController.dispose()`: stops the speech backend (WSS closed, microphone stopped, audio hard-stopped), then detaches every backend callback and embed-bridge command | `:374` |
| Frame loop | `cancelAnimationFrame` | `:375` |
| Window listeners (3) | `pointermove`, `resize`, `keydown` | `:376-:378` |
| Subscriptions (12) | 6 bus (`toast`, `avatar:loaded` x2, `avatar:progress`, `avatar:error`, `scene:preset`), 4 store (theme and volume, microphone device, scene theme, UI-mode to shell), UI-mode keyboard shortcut, legacy bridge | `:379-:390` |
| Studio shell | `shell.destroy()` (unmounts panels) | `:391` |
| Controllers (5) | compare, last-turn buffer, scene presets, animation, telemetry | `:392-:396` |
| UI and model helpers (5) | toast, loader indicator, modal, environment, GLB loader | `:397-:401` |
| GPU | `renderer.dispose()` | `:402` |
| Audio | `audioEngine.ctx.close()` | `:405` |

**The lifecycle rule.** Every subscription created anywhere in `app/` must be collected and released in `dispose()`; controllers keep their own `Unsub[]` and release it in their `dispose()`, panels release theirs in their handle's `destroy()`, and `disposables()` (`src/app/events.ts:64`) is the collector for code that wants one. The rule is a test, not a habit: `tests/container.test.ts` records `bus.handlerCount()` after `start()` (it must be above zero, so the check cannot pass on an empty bus), calls `dispose()`, and asserts the bus is empty and that the session, renderer and audio context were each released exactly once, including on a second `dispose()`. `handlerCount()` (`src/app/events.ts:56`) exists for that test and is marked test and debug only.

**Known gaps (not covered by that guarantee).** `EmbedBridge` registers a `message` listener on `window` in its constructor and has no removal path (`src/prod/embed-bridge.ts:113-:116`); `AudioEngine` has no `dispose()` of its own (the container closes its context directly); the vignette overlay (`container.ts:106`) and the presentation exit button (`container.ts:303`) are appended to the host element and stay in the DOM. All three are harmless for a page that lives as long as its tab and are recorded for follow-up.

## 4. Communication: events up, commands down

Two directions, two mechanisms, one boundary, stated at `src/app/app-types.ts:4-6`:

- **State flows up** on a typed event bus (`src/app/events.ts`). `TypedEventBus<AppEvents>` has deliberate invariants, each covered by `tests/events.test.ts`: `on()` returns an idempotent `Unsub` (`:16-:29`), `emit()` iterates a copy of the handler set so unsubscribing during an emission is safe (`:38`), and one handler throwing never stops the others (`:39-:43`).
- **Commands flow down** by service references. `AppServices` (`src/app/app-types.ts:146`) exposes nine typed contracts: `conversation`, `animation`, `telemetry`, `scene`, `animationSources`, `compare`, `lastTurn`, `scenePresets`, `uiMode`. Panels call services; they never reach into controllers.

The event surface is small and closed: 17 events in `AppEvents` (`src/app/app-types.ts:52`). Names follow `domain:action` (`voice:state`, `compare:result`), with one exception, `toast`. TypeScript guarantees every `emit` and `on` uses a declared name with the right payload; the table below fills in who produces and consumes each event, from a grep of every `emit(` and `on(` call in `src/` on the verification date.

<!-- event-catalog:start -->
| Event | Payload | Producers | Consumers |
|---|---|---|---|
| `voice:state` | `VoiceState` (`app-types.ts:15`) | `conversation-controller.ts:45`, `:175` | `last-turn-buffer.ts:63`, `algorithm-switcher.ts:222`, `connection-banner.ts:43`, `conversation-dock.ts:63`, `status-pill.ts:37` |
| `voice:error` | `string` | `conversation-controller.ts:39`, `:137` | `connection-banner.ts:39` |
| `voice:muted` | `boolean` | `conversation-controller.ts:160` | `conversation-dock.ts:74` |
| `transcript:user` | `string` | `conversation-controller.ts:50`, `:195`; `animation-controller.ts:129`, `:144` | `compare-controller.ts:81`, `last-turn-buffer.ts:62`, `telemetry-controller.ts:19`, `captions.ts:41` |
| `transcript:agent` | `string` | `conversation-controller.ts:55`, `:61`, `:197`, `:206`, `:215`; `animation-controller.ts:131`, `:145` | `animation-controller.ts:66`, `last-turn-buffer.ts:59`, `captions.ts:51` |
| `audio:chunk` | `AudioChunkEvent` (`app-types.ts:17`) | `conversation-controller.ts:68` | `animation-controller.ts:64`, `compare-controller.ts:82`, `last-turn-buffer.ts:44`, `telemetry-controller.ts:20`, `status-pill.ts:48` |
| `speech:interruption` | `string` (reason) | `conversation-controller.ts:78`, `:173`, `:202`, `:211` | `animation-controller.ts:65`, `compare-controller.ts:80`, `telemetry-controller.ts:24`, `captions.ts:46` |
| `a2f:stats` | `A2fStatsEvent` (`app-types.ts:28`) | `animation-controller.ts:331`, `:354` | `telemetry-controller.ts:25`, `a2f-panel.ts:64` |
| `toast` | `{ message, type }` | `animation-controller.ts` (5 sites), `compare-controller.ts` (3), `conversation-controller.ts` (6) | `container.ts:114` |
| `avatar:loaded` | `AvatarLoadedEvent` (`app-types.ts:36`) | `scene-controller.ts:124` | `container.ts:119`, `:229`; `animation-controller.ts:63`; `scene-panel.ts:65` |
| `avatar:progress` | `{ fraction }` | `scene-controller.ts:74` | `container.ts:123` |
| `avatar:error` | `{ message }` | `scene-controller.ts:86` | `container.ts:130` |
| `animation:source` | `AnimationMode` (`types/avatar.ts:88`) | `animation-controller.ts:114`, `:318` | `animation-panel.ts:228`, `algorithm-switcher.ts:175` |
| `scene:preset` | `string` (preset id) | `scene-preset-controller.ts:129` | `container.ts:225`, `scene-preset-controller.ts:86` |
| `compare:state` | `string` | `compare-controller.ts:214` | `algorithm-switcher.ts:176` |
| `compare:result` | `CompareResultEvent` (`app-types.ts:44`) | `compare-controller.ts:164` | `algorithm-switcher.ts:198` |
| `compare:cancelled` | `void` | `compare-controller.ts:190` | `algorithm-switcher.ts:216` |
<!-- event-catalog:end -->

Every file in the table lives under `src/app`, `src/features` or `src/ui` (the `ui` consumers are in `ui/user/` and `ui/studio/panels/`); the doc-sync test resolves each name to a real file. `toast` producers: `animation-controller.ts:120`, `:133`, `:309`, `:338`, `:355`; `compare-controller.ts:171`, `:239`, `:255`; `conversation-controller.ts:40`, `:138`, `:191`, `:203`, `:212`, `:217`. Not on this bus: the embed bridge's `avatar:ready`, `avatar:state_change`, `avatar:transcript` and `avatar:error` messages (`src/prod/embed-bridge.ts:165-:177`) go out to a parent window by `postMessage` and are a separate protocol.

## 5. The face pipeline

A short version; the full treatment is in [docs/4-audio-and-barge-in.md](docs/4-audio-and-barge-in.md) and [docs/3-lip-sync-and-coarticulation.md](docs/3-lip-sync-and-coarticulation.md).

How one agent utterance reaches the face: `RawWssClient` delivers an audio event; `ElevenAgentsSpeechBackend` normalizes the alignment, schedules the PCM with `audioEngine.playChunk(...)` and reports `onAudioChunk(pcm, alignment, epoch, scheduledStartTime, sampleRate)` (`src/audio/speech-backend.ts:86-:122`); `ConversationController` turns that into an `audio:chunk` bus event (`src/features/conversation-controller.ts:65-:75`); `AnimationController.handleAudioChunk` forwards it to the face (`src/features/animation-controller.ts:85-:96`).

- **Single writer of face morphs.** `FaceController` (`src/lipsync/face-controller.ts`) is the only module that applies facial weights: every `applyWeight` call in `src/` comes from it (`:623`, `:632`, `:667`, `:668`, `:679`), and the doc comment at `:70` states the rule. The viseme scheduler, A2F frames, the emotion layer and the blink and gaze providers hand it values. The rule is per region, not global: eyeball bones belong to `GazeSaccades` and head and chest bones to `HeadMicroMovements`, as the region table at `src/lipsync/animation-sources.ts:7-:17` lays out.
- **Clocks, one per concern.** Speech and frames use the audible audio clock; the 150 ms ease back to neutral (`relax.durationMs`, `src/realism/anim-config.ts:24`) uses the wall clock because it is a UI ramp, not an audio event, and must not stall when the audio context is suspended; damping uses the frame `dt`, so it is frame-rate independent. The contract is spelled out at `src/lipsync/face-controller.ts:72-:83`.
- **One epoch, owned by the audio engine.** `AudioEngine` holds the epoch (`src/audio/audio-engine.ts:15`); `hardStop()` increments it and stops every scheduled node (`:85-:101`). Every chunk and frame carries the epoch it was produced under and is dropped on mismatch: in `playChunk` (`:44`), in `FaceController.onAudioChunk` (`face-controller.ts:419`) and in `feedFrames` (`:294`). `FaceController` keeps no epoch of its own; it asks the engine. A late WebSocket chunk after an interruption is therefore ignored by construction, not by timing luck.
- **Barge-in path.** The server's interruption event reaches `ElevenAgentsSpeechBackend`, which calls `audioEngine.hardStop()` and `onInterruption` (`speech-backend.ts:125-:129`); the controller emits `speech:interruption` (`conversation-controller.ts:78`); `AnimationController` calls `faceController.onInterruption()` (`animation-controller.ts:65`), which clears the viseme queue and starts RELAXING (`face-controller.ts:556-:569`). The UI-initiated interrupt takes the same route (`conversation-controller.ts:171-:176`). Handling is idempotent: an interruption in IDLE stays IDLE, in RELAXING it re-anchors the timer.
- **Two tracks, one state machine.** `viseme` mode (scheduler plus coarticulation) and `frames` mode (absolute values from Audio2Face output, parsed by `src/lipsync/a2f-parser.ts`) share the IDLE, SPEAKING, RELAXING state machine (`face-controller.ts:32`), the epoch check and the rig safety clamps. The per-turn choice of track is one pure function, `resolveAnimationSource` (`src/lipsync/animation-router.ts:34`); live turns are always visemes because a batch neural pass would break time-to-first-byte.

## 6. Extension seams: how to add things

Each recipe lists the files to touch. If a change needs more than this, that is a bug in the architecture, and the notes say where today's code falls short of the ideal.

**A panel (studio or user layer).**
1. Create `src/ui/studio/panels/<name>-panel.ts` or `src/ui/user/<name>.ts` exporting a factory that returns a `PanelDefinition` (`{ id, title, icon, visibleIn, region?, lazy?, mount(ctx) }`, `src/ui/studio/panel-registry.ts:39`). `mount` receives the store, the bus, the injected `AppServices`, the shared UI ports and a container element, and returns a handle with `destroy()`.
2. Register it in `src/app/container.ts`: studio panels next to `:235-:240`, user-layer panels next to `:253-:258` (user panels are mounted by the loop at `:259-:261`; the shell mounts studio panels as tabs, `src/ui/studio/studio-shell.ts:29-:30`). Moving a panel between personas is a one-field change, `visibleIn`.
3. Put its strings in `src/app/copy.ts`; release every subscription in `destroy()`; if it needs a new command, add it to the matching service interface in `src/app/app-types.ts` and the controller behind it.

**An animation source** (the direction for body gestures or a second neural track).
1. Add an `AnimationSourceSpec` (`{ id, label, short, available, apply }`) in `createDefaultAnimationSources()` (`src/lipsync/animation-sources.ts:68`). `short` is an open string (`:38`), so a new badge needs no edit to a union. The user-layer segmented switcher renders whatever the registry lists (`src/ui/user/algorithm-switcher.ts:32`).
2. If the source drives the face, register a runtime adapter with `FaceController.registerTrackSource(id, adapter)` (`face-controller.ts:184`), where `adapter` is a `FaceTrackSource` (`src/types/avatar.ts:108`). Its `kind` is an `AnimationMode` (`types/avatar.ts:88`, `'viseme' | 'frames'`), which is genuinely closed: a source with a new payload kind extends that union and adds a track in `FaceController`.
3. If it changes which source wins a turn, that policy belongs in `resolveAnimationSource` (`animation-router.ts:34`), never in `FaceController`. A source feeds a region owner and never writes a region itself; a new region needs its own owner (`animation-sources.ts:7-:17`).

**A scene preset.**
1. Add an entry to `SCENE_PRESETS` (`src/features/scene-presets.ts:21`): background, key, fill and rim lights, ambient, exposure, pedestal, framing.
2. Add its label slot to `src/app/copy.ts` (`scenePreset.<id>`, next to `:181-:184`).
3. Add its id to `ScenePresetController.list()` (`src/features/scene-preset-controller.ts:92-:93`). Today that method names the four ids by hand instead of reading `SCENE_PRESETS`, so this third edit is easy to forget; the tween, reduced-motion handling and theme sync come along once it is listed.

**A bus event.**
1. Add the entry and a payload type to `AppEvents` (`src/app/app-types.ts:52`).
2. Emit it from the owning controller; subscribe where needed and keep the returned `Unsub` (controllers: their `subscriptions` array and `dispose()`; panels: `destroy()`; the container: its `dispose()` table).
3. Add the catalog row in section 4 above: `tests/architecture-doc.test.ts` fails until the catalog and `AppEvents` agree. The leak guard, `tests/container.test.ts`, fails if the subscription is never released.

**A speech backend.** The contract is `SpeechBackend` in `src/types/avatar.ts:19`, implemented by `ElevenAgentsSpeechBackend` (`src/audio/speech-backend.ts:32`), which wires `RawWssClient`, `MicCapture` and `AudioEngine`. The seam is real for the audio side and partial for the controller side. To add one: implement the contract and its callbacks (route every chunk through `audioEngine.playChunk(pcm, sampleRate, epoch)` and call `audioEngine.hardStop()` on an interruption, so the epoch rule above keeps holding); construct it in `container.ts:83`; and widen `ConversationController`, which is typed against the concrete class (`src/features/conversation-controller.ts:7`, `:15`) and also calls members the interface does not declare (`setMuted`, `getIsRunning`, `triggerDemoSpeech`, `setInputDevice`, `listInputDevices`).

## 7. Quality gates that run on every `npm test`

The suite is vitest with jsdom: 855 tests in 78 files at the verification date (2026-11-24), plus these structural gates:

- **Layering gate** (`tests/layering.test.ts`): section 2's import contract, cycles, and the top-level side-effect rule.
- **Doc sync** (`tests/architecture-doc.test.ts`): this document's layer table equals `LAYER_MAY_IMPORT`, its event catalog lists exactly the `AppEvents` keys, and every cited file exists.
- **Lifecycle regression** (`tests/container.test.ts`): section 3's zero handlers after dispose.
- **Language gate** (`tests/language.test.ts`): user-facing English is enforced across `src`, `tests`, `docs` and the root documents including this one, with an explicit allowlist for functional Polish phonetic data (the avatar genuinely handles Polish digraphs and nasal vowels; those literals are engine data, not copy). It also checks documentation link integrity.

Outside `npm test`, `npm run typecheck` runs `tsc` over `src` and `tests` (`tsconfig.test.json`) with the strict flags plus `noUncheckedIndexedAccess`, and `src` contains no `any` casts. `npm run build` type-checks `src` only. A CI workflow that runs install, typecheck, test and build is planned for Phase 18; there is no `.github/` directory yet.

## 8. Build and delivery

Vite and TypeScript (strict). Production output is split on purpose (`vite.config.ts:33`, `manualChunks`): the `three` vendor chunk caches independently of application code. The English pronouncing lexicon is a build-time-pruned JSON (`src/lipsync/g2p/dict-en-pruned.json`, produced by `npm run build:dict`) loaded by a dynamic `import()` after first render (`src/lipsync/g2p/g2p-en.ts:54`), so it is a separate lazy chunk. Measured on 2026-11-24 (`npm run build`):

| Chunk | Size | Gzip |
|---|---|---|
| application (`index`) | 197.28 kB | 60.21 kB |
| `three` | 594.04 kB | 151.79 kB |
| pruned lexicon (lazy) | 259.03 kB | 64.51 kB |

A Content-Security-Policy `<meta>` is injected at build time only, so the dev server is unaffected (`vite.config.ts:5`). The dev server runs on port 5310 with `strictPort` (`vite.config.ts:20-:21`). `chunkSizeWarningLimit` (`:38`) is set so that an accidental return of the full dictionary would show up as a warning.

## 9. What this is not yet: honest status

- **Neural lip-sync (NVIDIA Audio2Face).** The client half exists and is tested: an HTTP client (`src/audio/a2f-backend.ts`), a frames parser, the `frames` track, and the A/B comparison. No Audio2Face inference service is wired end to end, so the status in the README is "experimental"; the local proof of concept (`a2f/`) is Phase 9, and a Cloud Run deployment is Phase 10, which waits on it. Both are open in `.planning/ROADMAP.md`.
- **CI, license notice and deployment** are Phase 18 and not present yet.
- **Deliberately not abstracted:** one avatar rig (MetaPerson GLB with ARKit-52 blendshapes), one speech vendor behind a partial seam (section 6), English speech with Polish phonetic support, desktop browsers first. The seams exist where those decisions would reverse; the code does not pay for flexibility it does not use.
- **Deferred structural fixes** that are recorded, not hidden: moving `a2f-backend.ts` under `lipsync/` (the one layering exception), teardown of the embed-bridge listener (section 3), and removing the legacy localStorage mirror once nothing reads the old keys (`src/app/store/legacy-bridge.ts`, which carries its own REMOVE WHEN block).
