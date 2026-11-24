---
phase: 16-animation-mechanics-refactor
plan: 06
subsystem: lipsync
tags: [extensibility, animation-sources, avatar-director]
requirements: [ANIM-07]
key-files:
  created: [tests/animation-sources.test.ts]
  modified: [src/lipsync/animation-sources.ts, src/lipsync/animation-router.ts, src/lipsync/face-controller.ts, src/types/avatar.ts, tests/animation-router.test.ts]
status: complete
commits: 2
plan_head_before: f7c4dd8
plan_head_after: b5bee7c
actuals:
  tasks: 5
  commits: 2
---

# Phase 16 Plan 06: Open animation-source seam Summary

A third animation source registers and runs end to end without editing FaceController internals; `AnimationSourceSpec.short` is an open string; the router and the region-ownership model are documented where sources register.

## Registration contract (goes into 16-DRAFT "extension points")

```ts
// UI choice (animation-sources.ts): data entry, zero shell/HTML changes
registry.register({ id, label, short /* open string badge */, available(), apply(ctx) /* ctx.setSource(mode) */ });

// Runtime seam (types/avatar.ts + FaceController): routes data into an existing track
interface FaceTrackSource {
  kind: 'viseme' | 'frames';          // selects the runtime track (smoothing + safety come with it)
  start(ctx: FaceTrackContext): void; // FaceController already switched to the matching track (deferred mid-turn)
  feed(payload: unknown, epoch: number): void;
  stop(epoch: number): void;
}
interface FaceTrackContext { feedFrames(clip, baseSec, epoch); feedAlignment(alignment, startSec, epoch); interrupt(); }
faceController.registerTrackSource(id, adapter); startTrack(id); feedTrack(id, payload, epoch); stopTrack(id);
```
Built-in adapters `'viseme'` and `'frames'` are registered by the constructor. A source never writes morphs; stale epochs are rejected inside the tracks. Two payload kinds exist today; a genuinely new kind extends `kind` by contract (not speculated).

## Region ownership (documented in animation-sources.ts)

face morphs: FaceController (single writer); eyeball bones: GazeSaccades via SceneController, gated by carriesEyes; head/chest: HeadMicroMovements; future body/gestures: AvatarDirector region owner TBD.

## Deviations from Plan

1. **Production callers not rewired** to the adapters: `AnimationController`/`CompareController` still call `onAudioChunk`/`feedFrames` directly (their tests assert those calls and the plan says adapters "merely route"). The dispatch table is the extension seam and is exercised by the SYNTH test; migrating callers is a safe follow-up for F9/F10.
2. **Plan's `FaceTrackContext` was unspecified;** defined as the three capabilities above (a source can feed or interrupt, never write).
3. `animation-controller.ts` needed no edit in this plan (listed in files_modified); the LIVE-forces-visemes note was added in 16-01.
4. Source labels in `createDefaultAnimationSources` (`'LIVE wizemy'`, `'A2F (lokalny)'`) are UI strings owned by Phase 15 and left untouched; `ui/user/algorithm-switcher.ts` compares `spec.short` to string literals and still compiles against the open type.
5. Router tests: the policy table documents the existing offline-turn rules (a hypothetical `liveTurn: false` resolution); no behavior change.

## Self-Check: PASSED
(gate: build OK, 59 files / 344 tests green)
