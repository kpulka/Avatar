---
phase: 14-architecture-guards
plan: 04
subsystem: dead-code
tags: [cleanup, legacy-bridge, unused-exports]
requirements: [ARCH-05]
key-files:
  deleted:
    - src/avatar/model-cache.ts
    - tests/model-cache.test.ts
  modified:
    - src/app/store/legacy-bridge.ts
    - src/app/events.ts
    - src/app/app-types.ts
    - src/app/container.ts
    - src/app/ui-mode.ts
    - src/app/store/settings-store.ts
    - src/ui/shared/dom.ts
    - src/audio/agent-config.ts
    - src/scene/environment.ts
    - tests/container.test.ts
status: complete
commits: 1
plan_head_before: ba8e3f6
plan_head_after: 480fdb1
actuals:
  tasks: 5
  commits: 1
---

# Phase 14 Plan 04: Dead code removal and legacy-bridge retirement criteria Summary

The two modules the import graph proved dead are gone (one was already deleted upstream), the confirmed findings from the 2026-11-19 amendment are resolved, and `legacy-bridge.ts` states exactly when and how it can be removed.

Gate after this plan: `npm run typecheck` exit 0; `npm run build` OK (three chunk 595.84 -> 594.04 kB); `npx vitest run --dir tests` 74 files / 701 tests (before: 75 / 704; the removed `model-cache.test.ts` carried 3 tests).

## Pre-deletion proof (task 1, run at execution time)

- `grep -rn "eleven-client-smoke" src tests` -> nothing; the file was already deleted upstream (commit 0a08e8c, drift D2), so that half of the plan was a no-op.
- `grep -rn "model-cache" src tests` -> only `tests/model-cache.test.ts:2` (`import { ModelCache } ...`). Zero production importers; no dynamic import (the layering gate parses `import()` too).
- Post-delete both greps return nothing.

## What changed

- **Deleted:** `src/avatar/model-cache.ts` and its test.
- **4a findings:** (1) one `Unsub` type, owned by `src/app/events.ts`; `settings-store.ts` and `ui/shared/dom.ts` import it (their copies deleted; nothing imported the copies). (2) The container's inline editable-target check is replaced by `isEditableTarget` from `ui-mode.ts` (now exported, with a doc comment); behavior identical (input / textarea / select / contentEditable). (3) `compare:disposed` removed from `AppEvents` (never emitted, never listened). **`voice:error` kept**: the plan said "no listener", but `ui/user/connection-banner.ts` subscribes to it (drift D2 / C1). (4) `AgentConfig.outputAudioFormat` removed (never sent on the WSS URL; no reader).
- **Drift item:** `EnvironmentManager.setupRoomEnvironment` had no production caller (only a test mock). Deleted with its `RoomEnvironment` import, which removes that code from the three vendor chunk (-1.8 kB); the stale mock line in `tests/container.test.ts` removed. The softbox environment is the one in use.
- **legacy-bridge.ts:** WHAT / REMOVE WHEN / REMOVE HOW block. Verified facts the block states: the bridge mirrors the blob into the pre-F11 keys; the only live reader of a legacy key is `loadVisemeOverrides()` in the FaceController constructor; `loadCalibrationProfile` / `saveCalibrationProfile` / `saveVisemeOverrides` exist but have no production caller; removal needs both "one milestone cycle public" and "no module reads a legacy key directly".

## Unused-export sweep (task 4)

Scripted with the TypeScript AST (identifier references per file, no strings or comments), over every `export` in `src/`, counting `src` and `tests` references outside the declaring file. 122 exports had no other `src` reference. Disposition:

- **Deleted (dead: no reference anywhere, test or src):** `hasPolishDiacritic` (g2p/language.ts), `LIP_SYNC_ENGINES` (lipsync-engine.ts), types `LegacyKeyName`, `A2fBackendOptions`, `MappedShapeResult`, `AnimConfig`, `EmotionProfile`, `RequiredShape`.
- **Un-exported (used inside their own module only, nothing imports them):** `DEFAULT_A2F_URL`, `clampVolume`, `ENERGY_WINDOW_MS`, `SPEECH_ENERGY_THRESHOLD`, `MAX_RECONNECT_ATTEMPTS`, `relaxArmsToNaturalPose`, `ARKIT_52_SHAPES`, `MIN_SPAN_MS`, `EN_VISEMES`, `CHAR_VISEMES`, `SPEECH_SHAPE_FAMILIES`, `MAX_SAY_CHARS`, `configureTextures`.
- **Kept, test-facing exports of live modules (legitimate consumers per the plan):** e.g. `PHONEME_POSES`, `lipPoseToShapes`, `distributeDurations`, `rulesFallback`, `parseA2fPayload`, `rmsDiff`, `validateRequiredShapes`, `SCENE_PRESETS`, `ICON_NAMES`, `MAX_TOASTS`, `RECOVERY_CHUNKS`, `skinLightUniforms`.
- **Deferred (test-only users, production-dead):** `loadCalibrationProfile`, `saveCalibrationProfile`, `resetCalibrationProfile`, `saveVisemeOverrides`, `clearVisemeOverrides` - tied to the legacy-bridge REMOVE WHEN (b), so they go together with it; `fetchA2fStatus` (A2F panel wiring is Phase 9/10 territory), `getAudibleTime`, `isEditableViseme` (small, tested, no cost).
- **Kept, public signature types** (`*Options`, `*Deps`, `*Msg`, service interfaces): interfaces describing exported APIs; not orphans in the sense of the plan.
- **Phase 16 findings:** `purgeStaleEpochs`, `relaxToNeutral` and the adaptive-prebuffer family were already removed by Phase 16 (grep over `src` finds none); nothing of Phase 16's lane was touched here.

## Deviations from Plan

**1. Task 2 / `eleven-client-smoke.ts`:** already deleted upstream; only `model-cache` removed here.
**2. `voice:error` kept** (it has a listener); only `compare:disposed` deleted.
**3. [Rule 3] `setupRoomEnvironment` deleted** (drift note asked to decide; it is dead and removing it also shrinks the vendor chunk).
**4. [Rule 2 scope] Dead exports beyond the plan's list** deleted/un-exported per the sweep rule "wire it or delete it"; each is listed above.

## Known Stubs

None.

## Self-Check: PASSED

`src/avatar/model-cache.ts` and `tests/model-cache.test.ts` absent; commit 480fdb1 is an ancestor of HEAD; the REMOVE WHEN block is present in `src/app/store/legacy-bridge.ts`; no `.bak` or temp files in `git status`.
