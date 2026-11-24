---
phase: 16-animation-mechanics-refactor
plan: 05
subsystem: lipsync
tags: [performance, allocations, hot-path]
requirements: [ANIM-06]
key-files:
  created: [src/lipsync/alloc-probe.ts, tests/hot-path-allocations.test.ts]
  modified: [src/lipsync/viseme-scheduler.ts, src/lipsync/face-controller.ts, src/realism/emotion-layer.ts, src/realism/gaze-saccades.ts, src/lipsync/procedural-blink.ts]
status: complete
commits: 2
plan_head_before: acbde32
plan_head_after: 59cef71
actuals:
  tasks: 8
  commits: 2
---

# Phase 16 Plan 05: Allocation-free hot path Summary

The SPEAKING frame (both tracks) no longer constructs Maps, Sets or copies arrays; this is proven by counting real container constructions, not only by an instrumented probe, and the output is unchanged (golden weights).

## What changed (census A-1..A-10)

- A-1/A-2/A-3: scheduler `targets`/`updated` are reused scratch Maps (`clear()`); queue pruning is in-place (write index + `length`); `clear()`/`resetAll()` truncate in place. `update()` returns a BORROWED map.
- A-4/A-5: EmotionLayer drops the `Set` union (two passes over active + profile keys) and returns its internal map (borrow, `ReadonlyMap`); `takeWeights()` is the owned-copy variant (non-hot paths). Keyword arrays hoisted to module consts (D-12).
- A-6/A-7: `endTurn` closure became `endTurnIfDrained()`; consumed frames are dropped with `copyWithin` + `length` (no `slice`).
- A-8/A-9: `GazeSaccades.compute()` and `ProceduralBlink.update()` mutate and return one reused object (documented borrow, single consumer each).
- A-10: RELAXING skips driver writes for shapes at zero moving to zero.
- `meta.shapes.indexOf` -> `shapeSet` (Set built once per clip).
- `alloc-probe.ts`: `allocProbe {enabled, count, record(), reset()}`; `FaceController` option `debugAllocations`. The only recording site is `EmotionLayer.takeWeights()` (the owned copy that the old per-frame `new Map` became), so calling it from `render()` would be caught.

## Tests

`tests/hot-path-allocations.test.ts`: (a)/(b) 120 SPEAKING frames per track with `Map`/`Set` constructor counting plus spies on `Array.prototype.slice/filter/map/concat` and `Object.entries` = 0, and `allocProbe.count === 0`; probe guard test; in-place frame compaction keeps the current frame; (d) RELAXING writes only active shapes and still completes; golden weights (viseme frames 25/34, frames 25/60) to 1e-9. The golden numbers were captured from the PRE-refactor code (temporarily reverted src, same harness, then re-applied), and use a fixed `setCharMapper` table so Phase 17's viseme-table changes cannot invalidate them.

## Deviations from Plan

1. **`expectedShapes` scheduler hint not added:** JS `Map` cannot be presized, so the option would be inert; scratch maps simply stabilize after the first frame.
2. **`peekWeights()` not added;** `update()` itself returns the borrowed map, `takeWeights()` is the copy (simpler, same contract).
3. **Probe semantics:** the plan's "record at every replaced site" would never fire in the new code; the real proof is the container counting in the test, the probe guards the one remaining owned-copy API.
4. Iterator objects from `for...of` over Maps are not counted (short-lived, V8 escape analysis); documented limit.
5. FPS before/after in the browser not measured (no human/GPU session); the win is GC headroom. Manual item left to the verification UAT.

## Self-Check: PASSED
(gate: build OK, 58 files / 337 tests green)
