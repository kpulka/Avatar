---
phase: 14-architecture-guards
plan: 05
subsystem: documentation
tags: [architecture, doc-sync, language-gate]
requirements: [ARCH-04, ARCH-08]
key-files:
  created:
    - ARCHITECTURE.md
    - tests/architecture-doc.test.ts
  modified:
    - tests/language.test.ts
    - README.md
    - .planning/README.md
    - docs/1-architecture-and-3d-models.md
status: complete
commits: 1
plan_head_before: 0e893c5
plan_head_after: 55c6f43
actuals:
  tasks: 4
  commits: 1
---

# Phase 14 Plan 05: ARCHITECTURE.md Summary

A verified, English `ARCHITECTURE.md` at the repo root (layers, composition root and dispose table, 17-event catalog, face pipeline, five extension recipes, quality gates, build, honest status), plus a doc-sync test that keeps its layer table and event catalog equal to the code.

Gate after this plan: `npm run typecheck` exit 0; `npm run build` OK; `npx vitest run --dir tests` 75 files / 705 tests (before: 74 / 701; +4 doc-sync tests).

## What changed

- **ARCHITECTURE.md** lifted from `14-DRAFT-ARCHITECTURE.md` and rewritten against the code at `0e893c5`. Every `path:line` was re-read at write time (see spot-checks below).
- **tests/architecture-doc.test.ts** (4 tests): layer table == `LAYER_MAY_IMPORT` / `LAYER_ORDER`; event catalog keys == `AppEvents` keys, and the producer / consumer *files* in each row equal the files that call `.emit('<event>'` / `.on('<event>'` (line numbers are deliberately not asserted); every backticked `path` / `path:line` citation exists and is within the file; README and `.planning/README.md` link the doc. Mutation check: adding a bogus consumer to the `voice:error` row made the gate fail with `consumers of voice:error`.
- **tests/language.test.ts:** `ARCHITECTURE.md` added to Gate A scope `root` and to `gateBFiles()` (link integrity). No Polish allowlist entries were needed.
- **Links:** one sentence in README ("Documentation" section), one bullet in `.planning/README.md` "Where to start", one pointer in `docs/1-architecture-and-3d-models.md` ("Abstraction layers"). README test count updated 678/73 -> 705/75.

## Drift found while verifying the draft (corrected in the doc)

- `AppEvents` has 17 keys (plan said 16; `compare:disposed` removed in 14-04). `AppServices` has 9 services (`uiMode` added), the draft said 8.
- Frame order is face animation, scene (renders), then scene-preset tween (`container.ts:337-339`).
- `AnimationSourceId` / `short` is an open string; `AnimationMode` stays the closed `'viseme' | 'frames'` union.
- `ScenePresetController.list()` hardcodes the four preset ids (`scene-preset-controller.ts:92`), so "add a preset" needs three edits (presets, copy label, list); recipe says so.
- `ConversationController` depends on the concrete `ElevenAgentsSpeechBackend` (`conversation-controller.ts:7,15`), so the speech-backend seam is documented as partial.
- `docs/animation-runtime.md` does not exist; the doc points at docs/3 and docs/4.
- The realism -> lipsync edge was resolved by moving `anim-config` and `alloc-probe` to `src/realism/` (14-02), so the doc has no baseline exception for it. The only exception is `audio/a2f-backend.ts -> lipsync/a2f-parser.ts`.

## Event emit-grep (fresh, 2026-11-24)

`grep -rn "emit('" src` and `grep -rn "\.on('" src` produced the 17-row catalog. Totals: 17 events; `toast` has 14 emit sites (animation 5, compare 3, conversation 6) and one consumer (`container.ts:114`). `voice:error`, `voice:muted`, `avatar:progress`, `avatar:error`, `compare:state`, `compare:result`, `compare:cancelled` each have a single producer file and a single consumer file.

## Spot-checked line references (5 of the cited set, re-read after the final edit)

| Citation | Content at that line |
|---|---|
| `container.ts:370` | `dispose(): void {` (idempotent guard at :371) |
| `container.ts:337-339` | animation update, scene update, scene-preset update, in that order |
| `events.ts:56` | `public handlerCount(): number {` |
| `face-controller.ts:623` | `this.driver.applyWeight(shape, w);` (other callers :632, :667, :668, :679; no other file calls `applyWeight`) |
| `scene-preset-controller.ts:92` | `public list(): ScenePreset[] {` with four hardcoded ids on :93 |

Corrections made after the first draft: `container.ts` return at :356 (not :357), last-turn buffer :171 / compare :173, `layering-rules.ts` `MODULE_RULES` :53 and `EXCEPTIONS` :99, `PanelContext` :27, `events.ts` `on` range :16-:29, `audio-engine.ts` `hardStop` range :85-:101, `ui -> app` import count 24.

## Deviations from Plan

None beyond the drift list above. Files outside the plan's `files_modified`: none (README, `.planning/README.md` and docs/1 were named in the plan or the brief).

## Observations (not changed, out of scope)

- `src/lipsync/animation-sources.ts` labels (`'LIVE wizemy'`, `'A2F (lokalny)'`) (lines 72 and 79) are Polish user-facing copy that the language gate does not catch (no tests/language.test.ts allowlist entry mentions them). Candidate for a Phase 12 follow-up.

## Known Stubs

None.

## Self-Check: PASSED

`ARCHITECTURE.md` and `tests/architecture-doc.test.ts` exist; commit 55c6f43 is an ancestor of HEAD; all 4 doc-sync tests and the language gate pass.
