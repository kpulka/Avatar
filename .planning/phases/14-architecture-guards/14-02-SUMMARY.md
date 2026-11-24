---
phase: 14-architecture-guards
plan: 02
subsystem: architecture-guards
tags: [layering, import-graph, gate]
requirements: [ARCH-01, ARCH-06]
key-files:
  created:
    - tests/layering-rules.ts
    - tests/layering.test.ts
  modified:
    - src/realism/anim-config.ts (moved from src/lipsync/)
    - src/realism/alloc-probe.ts (moved from src/lipsync/)
    - src/app/container.ts
    - src/lipsync/a2f-parser.ts
    - src/lipsync/demo-frames.ts
    - src/lipsync/face-controller.ts
    - src/lipsync/procedural-blink.ts
    - src/lipsync/viseme-scheduler.ts
    - src/realism/emotion-layer.ts
    - src/realism/gaze-saccades.ts
    - src/realism/head-micro-movements.ts
    - docs/3-lip-sync-and-coarticulation.md
    - docs/4-audio-and-barge-in.md
status: complete
commits: 2
plan_head_before: cd05aff99e601734f7f69def6df3d149468aedea
plan_head_after: 53b7a85
actuals:
  tasks: 5
  commits: 2
---

# Phase 14 Plan 02: Layering contract and import-graph gate Summary

The measured layer stack is now data (`tests/layering-rules.ts`) enforced by `tests/layering.test.ts` in `npm test`; the one upward edge Phase 16/17 introduced (realism -> lipsync) was fixed by moving the two shared leaf modules down, not baselined.

Gate after this plan: `npm run typecheck` exit 0; `npm run build` OK; `npx vitest run --dir tests` 74 files / 696 tests (baseline 73 / 678, +18 gate tests).

## What changed

- **Rules as data.** `LAYER_ORDER` (13 layers), `DIR_LAYER`, `MODULE_RULES` (`app/` classified per module: contracts `app-types`, `events`, `ui-mode`, `copy`, `store/*`; root `container.ts` with `importableBy: ['entry']`; `legacy-bridge.ts` with `importableBy: ['app-root']`; `main.ts` = entry), `LAYER_MAY_IMPORT` (per layer allow-list, measured), `EXCEPTIONS`, and the side-effect lists. The file has no imports so an ESLint flat config (18-04) can import it.
- **Gate.** The TypeScript AST (not a regex) collects static imports, type imports, `export ... from` re-exports and dynamic `import()`; asserts every edge is allowed, every module is classified, no module-level cycles, container imported by `main.ts` only, `ui` never imports `features`, the rule table itself only points down `LAYER_ORDER`, every exception is documented and not stale, `main.ts` <= 100 lines (it is the ARCH-06 check), and no top-level `document/window/localStorage/sessionStorage/navigator/location` in `types, core, scene, prod, realism, avatar, audio, lipsync, features` (AST walk over module-level statements, function and class bodies and `typeof` guards excluded). Negative self-tests feed synthetic edges (`features -> ui`, `ui -> features`, `realism -> lipsync`, `avatar -> audio`, container importers, unclassified `app/` module, a cycle) and synthetic sources to the pure checkers, plus a parser fixture. A mutation check (`import '../ui/shared/dom'` appended to a feature, then reverted) failed the gate as expected.
- **Measured baseline (after the move), cross-directory import edges:** app -> audio 4, avatar 1, core 4, features 7, lipsync 10, prod 2, realism 3, scene 2, types 1, ui 19 (all from `container.ts`); audio -> lipsync 1, types 6; avatar -> types 3; features -> app 20 (contract modules only), audio 7, avatar 2, core 3, lipsync 7, prod 2, realism 2, scene 3, types 4; lipsync -> audio 2, avatar 1, realism 7, types 6; realism -> types 1; ui -> app 23, lipsync 3, scene 1, types 2; main.ts -> app 1, ui 1. Zero module-level cycles; zero `ui -> features`.
- **Drift edges recorded.** `face-controller -> audio/audible-clock` is downward (no exception); `ui/studio/panels/scene-panel -> scene/skin-shader` (the SSS toggle reaches module-level state directly, not via `AppServices`) and `container -> core/adaptive-resolution` are allowed by the table and noted in its comments; `app/copy.ts` is a contract module (22 importers in features/ui/container).

## How the realism -> lipsync edge was resolved

Phase 16/17 made `realism/emotion-layer.ts`, `gaze-saccades.ts`, `head-micro-movements.ts` import `lipsync/anim-config` (`ANIM_DEFAULTS`, `clamp01`) and `lipsync/alloc-probe`. Both files are dependency-free leaves. They moved with `git mv` to `src/realism/` (the lowest domain layer that uses them); `lipsync -> realism` already existed and is downward. No re-export shim: all importers were updated (7 src files, 6 tests, and the two `src/lipsync/anim-config.ts` path references in docs/3 and docs/4). The gate has no exception for it.

## Deviations from Plan

**1. [Layer model] Exceptions list has one entry, not three.** The plan's three groups assumed `app/` was one layer and `audio <-> lipsync` was a pair of exceptions. With `app/` classified per module, `app/store -> audio|lipsync` and `app-types -> lipsync` are ordinary downward edges (app-contracts sits above lipsync), and `lipsync/face-controller -> audio/audio-engine` is downward; only `audio/a2f-backend -> lipsync/a2f-parser` is upward, and it stays an exception with a reason (relocation deferred, as in 14-CONTEXT).
**2. [Rule 2] AST instead of regex** for import parsing (handles `import type`, `export ... from`, multi-line imports and dynamic `import()` without a regex that can silently match nothing); `typescript` is already a devDependency.
**3. [Move, outside `files_modified`]** the two module moves, 7 src importers, 6 test importers and two doc path references - all strictly required by the move, listed above.
**4. `vite-env.d.ts`** (ambient declarations) is excluded from the module walk.

## Known Stubs

None.

## Self-Check: PASSED

`tests/layering-rules.ts`, `tests/layering.test.ts`, `src/realism/anim-config.ts`, `src/realism/alloc-probe.ts` exist; `src/lipsync/anim-config.ts` and `src/lipsync/alloc-probe.ts` do not; commits eb7a5de and 53b7a85 are ancestors of HEAD; `grep -rn "lipsync/anim-config\|lipsync/alloc-probe" src tests docs` returns nothing.
