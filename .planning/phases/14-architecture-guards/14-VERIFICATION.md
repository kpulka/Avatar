---
phase: 14-architecture-guards
type: verification
created: 2026-11-18
executed: 2026-11-24
manual_uat: pending
verdict: PASS (automated); manual UAT PENDING
---

# 14-VERIFICATION — Architecture: documentation, strictness, guards

> Executed for real on 2026-11-24 in the worktree branch `worktree-agent-ac2a8bd73c6d87ae1`. Human items stay PENDING.

## 1. Automated gates (final state)

| Gate | Evidence | Result |
|---|---|---|
| Typecheck | `npm run typecheck` (src + tests via `tsconfig.test.json`, `noUncheckedIndexedAccess` on) exits 0 | PASS |
| Zero `any` | `grep -rnE "as any\|: any\|@ts-ignore\|<any>" src` -> 2 hits, both prose in comments (`alloc-probe.ts:6`, `algorithm-switcher.ts:66`); 0 in code. One pre-existing `as any` in `audio-engine.ts` was removed in 14-01. Tests: one pre-existing `any[]` in `tests/speech-backend.test.ts:3` (a `vi.hoisted` callback map, not touched by Phase 14); no `any` or `@ts-ignore` was added | PASS (with the test-file note) |
| Tests | `npx vitest run --dir tests`: 75 files / 705 tests green (baseline 73 / 678; +layering 18, +architecture-doc 4, +events 3, +container lifecycle, +conversation-dispose 3, -model-cache 3) | PASS |
| Build | `npm run build` green; chunks: index 197.28 kB, three 594.04 kB (was 595.84), lazy lexicon 259.03 kB | PASS |
| Layering gate | `tests/layering.test.ts` (18 tests) passes, including negative self-tests (synthetic `features -> ui`, upward edge, cycle, unclassified `app/` file, top-level `document`). Exceptions list = **1** entry (`audio/a2f-backend.ts -> lipsync/a2f-parser.ts`), fewer than the 3 groups planned, because `app/` is classified per module and the realism -> lipsync edge was fixed by moving two files | PASS |
| Lifecycle | `tests/container.test.ts`: `handlerCount() > 0` after start, `0` after `dispose()`, second `dispose()` is a no-op; plus a detector test proving the check fails when a handler leaks; `tests/events.test.ts` covers `handlerCount` | PASS |
| Deletions | `src/audio/eleven-client-smoke.ts` (already gone upstream), `src/avatar/model-cache.ts`, `tests/model-cache.test.ts` -> all absent; importer greps -> 0 | PASS |
| Language gate | `ARCHITECTURE.md` in Gate A (`root` scope) and Gate B (link integrity); `tests/language.test.ts` green, no allowlist entry added | PASS |
| Cycles | `tests/layering.test.ts` cycle check green (module-level graph acyclic) | PASS |
| Doc sync | `tests/architecture-doc.test.ts` (4 tests): layer table == `LAYER_MAY_IMPORT`; catalog keys == `AppEvents`, producer / consumer files == real `emit` / `on` callers; citations resolve; mutation check made it fail | PASS |

## 2. Per-requirement acceptance

| Req | Check | Result |
|---|---|---|
| ARCH-01 | ARCHITECTURE.md section 2 table equals `tests/layering-rules.ts` data (asserted by the doc-sync test); gate green; one documented exception, none undocumented | PASS (14-02, 14-05) |
| ARCH-02 | `typecheck` script in `package.json`; `noUncheckedIndexedAccess` on; D6 comment (why `exactOptionalPropertyTypes` stays off) in `tsconfig.json`; the three casts typed (`pcmBytesToFloat32` returns `Float32Array<ArrayBuffer>`, `REQUIRED_SHAPES` check, `copyToChannel`); about 20 latent test type errors fixed | PASS (14-01) |
| ARCH-03 | dispose regression green; `handlerCount` unit-tested; Unsub / `disposables` pattern and the dispose table in ARCHITECTURE.md section 3; new `ConversationController.dispose()` closes the session first | PASS (14-03). Known gaps recorded, not fixed: EmbedBridge window listener, AudioEngine has no `dispose()`, vignette and exit-presentation DOM nodes |
| ARCH-04 | 17-event catalog (plan said 16; `compare:disposed` removed in 14-04, `AppEvents` has 17 keys); every row from a fresh `emit(` / `on(` grep (list in 14-05 SUMMARY) and enforced by the doc-sync test | PASS (14-05) |
| ARCH-05 | `model-cache` deleted; `eleven-client-smoke` already gone; legacy-bridge WHAT / REMOVE WHEN / REMOVE HOW block present; unused-export sweep (122 candidates) dispositioned in the 14-04 SUMMARY | PASS (14-04). Test-only, production-dead exports deferred with owners (see section 4) |
| ARCH-06 | composition-root section (3) exists; side-effect rule green; `src/main.ts` is 24 lines (limit 100, asserted) | PASS (14-02, 14-05) |
| ARCH-07 | 5 extension recipes (panel, animation source, scene preset, bus event, speech backend) with file lists; the scene-preset recipe has 3 edits and the speech-backend recipe is honest that the seam is partial | PASS (14-05) |
| ARCH-08 | `ARCHITECTURE.md` at root, English, linked from README, `.planning/README.md` and docs/1 | PASS (14-05) |

## 3. Goal-backward check ("visible, strict, guarded")

- **Visible:** would a reader opening the repo cold understand the architecture in 10 minutes? Plausibly yes: the doc leads with the shape, then layers, wiring and lifecycle, the event catalog, and recipes, and every claim cites `path:line`. The honest caveat is that this is a judgment about prose and is unmeasured; the manual UAT below is the real test.
- **Strict:** is the typing story trustworthy? Yes for `src` and `tests` (typecheck covers both, `noUncheckedIndexedAccess` on, zero `any` in `src` code). Not claimed: `exactOptionalPropertyTypes` (deliberately off, D6). The build's own `tsc` still checks `src` only, so typecheck is a separate script; CI that runs it is Phase 18.
- **Guarded:** can layering be broken accidentally? Not without failing `npm test`: new files must be classified, edges are checked from the AST (static, dynamic and re-export forms), cycles fail, and a stale exception fails. Gaps: the gate is a test, not an editor-time lint (Phase 18-04 hands it to ESLint); `ui/` -> `scene/skin-shader` is an allowed direct edge; the speech-backend seam is partial; three lifecycle gaps remain.
- **Doc drift guarded?** Partly. The layer table, event keys, producer and consumer files and citation targets are tested. Line numbers and prose are not: they are re-verified by hand at each refresh (see handoffs).

## 4. Manual UAT (human session - PENDING)

1. Cold-open review: 10 minutes with ARCHITECTURE.md and the repo. Does a reader who hasn't built it understand layers, events, lifecycle, and where to add a panel? (The doc's real acceptance test.) **PENDING**
2. `npm run dev` after the deletions: app boots, avatar loads, conversation and demo animation unaffected (dead code really was dead). Automated evidence only so far (build and 705 tests, including container start / dispose in jsdom); no browser run was done. **PENDING**

## 5. Cross-phase handoffs

| Thread | Owner | State |
|---|---|---|
| ESLint reuses the layering contract | 18-04 | `tests/layering-rules.ts` has no imports and exports plain data (`LAYER_ORDER`, `DIR_LAYER`, `MODULE_RULES`, `LAYER_MAY_IMPORT`, `EXCEPTIONS`, side-effect lists), so a flat config can import it. 18-04 must keep the `app/` per-module classification |
| ARCHITECTURE.md refresh | 15 / 16 / 17 retros | Each touches files the doc cites. Retro checklist item to add: "re-verify ARCHITECTURE.md (line references, event catalog, dispose table, recipes); `tests/architecture-doc.test.ts` catches table drift only" |
| 16-02 / 16-04 collisions | start of 16 | 14 touched `container.ts` (dispose, lifecycle, shortcut helper) and made a one-line change in `audio-engine.ts` (a stale `as any` removed in 14-01). The earlier "audio-engine untouched" expectation was therefore not exact; the change is cast-only |
| README link slot (13-01) | done | filled by 14-05 |
| v1.2 backlog (not scheduled) | backlog | move `audio/a2f-backend.ts` under `lipsync/` (removes the one exception); re-evaluate `exactOptionalPropertyTypes`; EmbedBridge listener removal and `AudioEngine.dispose()`; remove `legacy-bridge.ts` (criteria in its header) together with the test-only calibration / viseme-override exports; widen `ConversationController` to the `SpeechBackend` interface; derive `ScenePresetController.list()` from `SCENE_PRESETS` |
| Out-of-scope finding | Phase 12 follow-up | `src/lipsync/animation-sources.ts:72,79` carry Polish labels (`'LIVE wizemy'`, `'A2F (lokalny)'`) that the language gate does not catch |

## 6. Result

**Phase verdict:** **PASS** on all automated gates and ARCH-01..08; **manual UAT PENDING** (cold-open review, `npm run dev` boot). Plan summaries: [14-01](14-01-SUMMARY.md), [14-02](14-02-SUMMARY.md), [14-03](14-03-SUMMARY.md), [14-04](14-04-SUMMARY.md), [14-05](14-05-SUMMARY.md), [14-06](14-06-SUMMARY.md).
