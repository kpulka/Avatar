---
phase: 14-architecture-guards
plan: 01
subsystem: tooling-types
tags: [typescript, strictness, typecheck]
requirements: [ARCH-02]
key-files:
  created:
    - tsconfig.test.json
    - tests/helpers/defined.ts
    - scripts/lipsync-corpus.d.mts
  modified:
    - tsconfig.json
    - package.json
    - package-lock.json
    - README.md
    - src/audio/pcm-resampler.ts
    - src/audio/audio-engine.ts
    - src/avatar/meta-person-loader.ts
status: complete
commits: 2
plan_head_before: 0a04806
plan_head_after: 958d8ad
actuals:
  tasks: 5
  commits: 2
---

# Phase 14 Plan 01: Full-project typecheck and zero `any` Summary

`npm run typecheck` (src + tests) is green with `noUncheckedIndexedAccess` on, and `src/` contains no `any` casts or `@ts-ignore`.

Gate: `npm run typecheck` exit 0; `npm run build` OK; `npx vitest run --dir tests` 73 files / 678 tests (unchanged baseline).

## What changed

- **Typecheck script (task 1).** `tsconfig.test.json` extends the base config with `include: ["src", "tests"]`; `npm run typecheck` = `tsc --noEmit -p tsconfig.test.json`. The base `tsconfig.json` got `types: []` so Node globals never leak into the browser build; the test config opts in with `types: ["node"]` (tests use `node:fs`, `node:path`, `node:url`, `process`). `@types/node@^22` was added as a devDependency for that (DefinitelyTyped, no other way to type the tests honestly).
- **Latent test errors (task 1).** First run over `tests/`: 52 errors, 32 of them the missing Node types; the 20 real findings, all fixed: 9x TS6133 unused (`animation-frames`, `audio-engine` x2, `barge-in-pipeline`, `e2e-self-test` x2, `face-controller-state`, `poc-stress-harness`, `race-condition-epoch`), `calibration.test.ts` legacy-profile fixture missing the now-required `clockVersion` (typed `Omit<CalibrationProfile, 'clockVersion'>`, which is what a v1 record really is), `compare-controller.test.ts` 2x TS2349 (`release` narrowed to `never`) + 2x TS7023, `lighting-materials.test.ts` stale `onBeforeRender` arity (3 args missing), `panel-registry.test.ts` missing `PanelHandle` import, `states-recovery.test.ts` 2x TS2554 (stub callbacks declared with no parameters), 2x TS7016 for `scripts/lipsync-corpus.mjs` (fixed with `scripts/lipsync-corpus.d.mts`).
- **Casts (task 2).** Drift D2: the `speech-backend` cast was already removed by Phase 17, so two casts remained. `audio-engine.ts`: `pcmBytesToFloat32` now declares `Float32Array<ArrayBuffer>` (which is what `new Float32Array(n)` is), so `copyToChannel` needs no cast. `meta-person-loader.ts`: `(REQUIRED_SHAPES as readonly string[]).includes(k)` (a widening, not `any`).
- **`noUncheckedIndexedAccess` (task 3).** Measured 314 errors (94 in `src`, 220 in `tests`); all fixed in the same commit as the flag. Source fixes prefer guards and `charAt`/`??` with a one-line invariant comment where an index is provably in range; no `!` was needed. Notable: `SCENE_PRESETS` is a non-empty tuple type (fallback `[0]` is typed), `PHONEME_POSES` S/Z and the Polish TS/DZ aliases share one `SIBILANT` const, `mapPhonemeToShapes` goes through an own-property lookup helper. In tests the narrowing helper `tests/helpers/defined.ts` (`defined(x[i])`) throws a readable error instead of `!`; ~200 sites were rewritten with a TypeScript-API script (compiler diagnostics -> wrap the flagged expression), then reviewed by the green typecheck and tests.
- **D6 (task 4).** `exactOptionalPropertyTypes` stays OFF; a comment in `tsconfig.json` points at 14-CONTEXT D6.
- **README.** `npm run typecheck` line added to the Verification block; test count corrected to 678 / 73 (it said 417 / 66) and the "no separate typecheck script" sentence replaced.

## Deviations from Plan

**1. [Rule 3 - Blocking] `@types/node` devDependency + `package-lock.json`** (outside `files_modified`). Required: 32 of the first-run errors were missing Node types for the tests. `types: []` in the base config keeps them out of `src`.
**2. [Rule 3] `scripts/lipsync-corpus.d.mts`** (new file) to type an imported `.mjs` module instead of leaving it implicit-`any`.
**3. [Rule 1] Behavior notes from the index fixes (none changes a tested result):** `resampleLinear` used to write `NaN` if rounding of the output length pointed one sample past the input end; it now interpolates from silence. `demo-frames` / `viseme-scheduler` loops `continue` on an impossible undefined instead of throwing.
**4. Sequencing:** the plan's single commit became two (infra + test fixes, then the flag + fixes) so the flag commit is one coherent step and each commit is green.
**5. README edit** in the Verification block only (the parallel track works on the license section further down).

## Known Stubs

None.

## Self-Check: PASSED

Files exist (`tsconfig.test.json`, `tests/helpers/defined.ts`, `scripts/lipsync-corpus.d.mts`); commits 8389485 and 958d8ad are ancestors of HEAD; `grep -rnE "as any|: any\b|@ts-ignore" src` matches only prose in comments.
