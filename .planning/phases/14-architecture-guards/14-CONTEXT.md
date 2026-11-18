---
phase: "14"
name: "Architecture — documentation, strictness, guards"
created: "2026-11-18"
updated: "2026-11-18"
---

# Phase 14: Architecture — documentation, strictness, guards — Context

The repo's architecture is *good* but *invisible and unguarded*. Phase 11 built a genuinely
clean modular frontend (composition root, TypedEventBus, panel registry, SettingsStore), yet
none of it is documented anywhere a reviewer would look, nothing enforces the layering that
currently exists only by convention, and two strictness holes undermine the "rigorous
TypeScript" story this portfolio repo wants to tell. This phase makes the architecture
**visible (ARCHITECTURE.md), strict (full-project typecheck, zero `any`), and guarded
(layering gate + lifecycle regression test)** — and removes the dead modules that blur the
dependency story.

This is explicitly **not** a big-bang refactor. The deep module surgery is owned by sibling
phases (16: FaceController mechanics; 17: viseme/G2P data). Phase 14 documents, guards, and
deletes — it moves almost nothing.

All measurements below were produced on 2026-11-18 from the working tree (import-graph
script over static imports; `Get-ChildItem`/grep evidence cited per claim).

---

## 1. Current-state inventory

### 1.1 Module & layer topology — 78 source files, zero module-level cycles

`src/` (77 `.ts` + `style.css`): `app` (+`app/store`), `audio`, `avatar`, `core`, `features`,
`lipsync` (+`lipsync/g2p`), `prod`, `realism`, `scene`, `types`, `ui` (+`ui/shared`,
`ui/studio`, `ui/studio/panels`, `ui/user`), plus `main.ts` at the root.

**Cycle check: zero module-level import cycles** (DFS over static imports, run 2026-11-18).

Measured cross-directory import edges (counts = import statements):

```
core      → (nothing local)          scene → (nothing local)
types     → (nothing local)          prod  → (nothing local)
realism   → types [1]
avatar    → types [3]
audio     → lipsync [1], types [5]
lipsync   → audio [1], avatar [1], realism [1], types [5]   (g2p → types [1])
features  → app [16], audio [8], avatar [2], core [3], lipsync [6], prod [2],
            realism [2], scene [3], types [4]
ui        → app [5 total]; ui/studio/panels → lipsync [2], types [1];  ui → features [0] ✔
app       → audio [2], avatar [1], core [3], features [7], lipsync [4], prod [2],
            realism [2], scene [2], types [1], ui [17];  app/store → audio [1], lipsync [3]
main.ts   → app [1], ui [1]
```

Two structural facts fall out of the graph:

1. **`app` is two roles, not one layer.** `features` imports `app` 16× — but only the
   *contract* modules (`app-types.ts`, `events.ts`, `ui-mode.ts`, store types); the root
   module `app/container.ts` imports `features` back (7 edges). Directory-granular rules
   ("nothing may import app") are therefore wrong; the contract must be **module-granular**:
   `container.ts` is imported by `main.ts` only; the contract modules are importable by
   `features`/`ui`.
2. **`audio` ↔ `lipsync` is a directory-level cycle** (not a module cycle): the only edges
   are `audio/a2f-backend.ts:9` → `lipsync/a2f-parser` (A2F JSON parsing) and
   `lipsync/face-controller.ts:2` → `audio/audio-engine` (AudioEngine). A naive boundary
   rule would flag it; the layering gate (14-02) carries it as an explicit, documented
   exception (candidate future fix: `a2f-backend.ts` moves under `lipsync/` — deferred,
   sequencing with 12-06 comment translation and 16/17 file edits).

The de-facto layer stack (bottom → top): `types`/`core`/`scene`/`prod` (no local imports) →
`realism`/`avatar` → `audio`/`lipsync` → `features` → `ui` → `app/container` (root) →
`main.ts`. UI never imports features (0 edges) — panels receive `AppServices` via injection.
This is the contract 14-02 freezes.

### 1.2 Event surface — TypedEventBus + 16 events + 8 services

- `src/app/events.ts:13-50` — `TypedEventBus`: `on` returns an **idempotent `Unsub`**
  (:16-29), `emit` iterates over a copy of the handler set (:35-45) with per-handler
  try/catch so one failing handler can't break an emission (:39-43), `off`/`clear` provided.
- `src/app/events.ts:53-72` — `disposables()` collector: one place to gather `Unsub`s and
  release them in `dispose()`.
- `src/app/app-types.ts:51-68` — `AppEvents`: **16 events** (`voice:state`, `voice:error`,
  `voice:muted`, `transcript:user`, `transcript:agent`, `audio:chunk`, `speech:interruption`,
  `a2f:stats`, `toast`, `avatar:loaded`, `animation:source`, `scene:preset`,
  `compare:state`, `compare:result`, `compare:cancelled`, `compare:disposed`).
- `src/app/app-types.ts:138-147` — `AppServices`: **8 service contracts** (conversation,
  animation, telemetry, scene, animationSources, compare, lastTurn, scenePresets).
- The events-vs-commands split ("events STATE up on the bus, COMMANDS down via service
  references") is documented only in the header comment of `app-types.ts:1-7` — in Polish
  (12-06 translates it), never in a doc file. **No producer/consumer catalog exists
  anywhere.**

### 1.3 Composition root & lifecycle

`src/app/container.ts` (~344 lines) is the single wiring point: constructs renderer/camera/
scene (core), domain modules, 5 feature controllers, the store, the studio shell + panels,
wires bus subscriptions and keyboard/pointer/resize listeners; `start()` (:305-313) applies
input device + scene preset, shows the loader, loads the default avatar, starts the rAF loop
(:279-298 — scene→animation→scenePreset update order), notifies the embed bridge.
`dispose()` (:314-339) runs a **24-step teardown**: rAF cancel, 3 `removeEventListener`,
9 stored `Unsub`s, `shell.destroy()`, 5 controller `dispose()`s, 5 UI/environment/loader
destroys. This thoroughness is the P11 review A1 P2 fix (STATE.md decision log) — but the
guarantee lives in discipline, not in a test: nothing fails if someone adds
`events.on(...)` in `app/` without collecting the `Unsub`. `tests/container.test.ts` and
`tests/events.test.ts` exist (baselines for 14-03) but don't assert post-dispose emptiness.

### 1.4 Type strictness — strong, with two holes

`tsconfig.json` is already strict: `strict`, `noUnusedLocals`, `noUnusedParameters`,
`noFallthroughCasesInSwitch` (:13-16). `npm run build` = `tsc && vite build`
(package.json:8).

**Hole 1 — tests are never type-checked.** `tsconfig.json:18` has `include: ["src"]`;
vitest transforms via esbuild without type checking. A type error in `tests/**` surfaces
nowhere until it becomes a runtime failure. For a repo whose pitch includes a 204-test
suite, the suite itself being untyped is a credibility gap.

**Hole 2 — exactly 3 `any` casts survive in src** (grep `(:\s*any|as any|@ts-ignore)` —
this is the complete list, verified 2026-11-18):

| Location | Code | Typed fix (14-01) |
|---|---|---|
| `src/avatar/meta-person-loader.ts:53` | `REQUIRED_SHAPES.includes(k as any)` | type `k` via the morph-name key type; `includes` on `readonly ArKitShapeName[]` |
| `src/audio/speech-backend.ts:66` | `(payload.alignment ?? (payload as any).normalized_alignment ?? (payload as any).alignments) as any` | one `RawAlignmentPayload` interface with optional fields + a narrowing guard |
| `src/audio/audio-engine.ts:50` | `buffer.copyToChannel(floatData as any, 0)` | TS 5.7 DOM lib wants `Float32Array<ArrayBuffer>` — construct/annotate the scratch buffer with the right generic instead of casting |

**Hole 3 (new flag, staged):** `noUncheckedIndexedAccess` is off. Array/record indexing in
the scheduler and parsers assumes definedness; turning the flag on hardens the hot paths
16/17 are about to touch — but only if the fallout is fixed in the same commit (R-7).
`exactOptionalPropertyTypes` is deliberately **not** adopted this milestone (cost/benefit
recorded in 14-01).

### 1.5 Dead / vestigial modules (production-import-graph based)

| Module | Production importers | Evidence | Verdict |
|---|---|---|---|
| `src/audio/eleven-client-smoke.ts` | **0** (src and tests) | grep over `from '…eleven-client-smoke'` → only self-import; references exist solely in phase-02 archive docs | Phase-02 SDK smoke tool, superseded by `raw-wss-client` + `speech-backend`. **DELETE** (14-04) |
| `src/avatar/model-cache.ts` | **0** in src; only `tests/model-cache.test.ts:2` | grep; no feature or container wiring | Feature without a user (GLB re-loads go through browser HTTP cache anyway). **DELETE module + its test** (14-04, decision D5) |
| `src/app/store/legacy-bridge.ts` | 1 — `container.ts:20` (`attachLegacyBridge`) | `migrate.ts:22` documents the pairing ("mirror w legacy-bridge") | Alive but transitional: mirrors pre-F11 localStorage keys into SettingsStore. **Retirement criteria documented now, removal deferred** (D5) |
| `AudioEngine` adaptive-prebuffer family | tests only | 16-CONTEXT **D-3** (`audio-engine.ts:121-135`) | **Owned by Phase 16 (16-04)** — cross-reference only, no parallel edit |
| `FaceDriver.relaxToNeutral` rAF loop | none prod. | 16-CONTEXT **D-2** (`face-driver.ts:70-112`) | **Owned by Phase 16 (16-01)** — cross-reference only |

### 1.6 Extension seams (AvatarDirector direction, per PROJECT.md)

16-CONTEXT §8 already diagnosed the seam quality: blink/gaze providers are the right pattern;
`AnimationSourceRegistry` is open for registration but `short: 'LIVE' \| 'A2F'` is a closed
union (16-06 opens it); `resolveAnimationSource` is the future per-turn policy home. Phase 14
does **not** redesign these — it documents them (with "how to add X" recipes) so the seams
are discoverable, and leaves the mechanics to 16.

---

## 2. Problems & risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R-1 | Type-checking `tests/` for the first time surfaces latent errors → broken main | MEDIUM | 14-01 fixes everything it finds in the same plan; `npm test` + `npm run build` green are acceptance gates |
| R-2 | `noUncheckedIndexedAccess` fallout larger than a plan-sized fix (scheduler/parsers index heavily) | MEDIUM | 14-01 measures first (`tsc` error count), fixes all in-plan; if fallout is > ~40 errors the flag lands behind the fixes in the same commit — never half-on |
| R-3 | Layering gate false-positives on legitimate cross-layer edges (audio↔lipsync, features→app contracts, app/store→domain) | HIGH | Gate config encodes the **measured** graph (§1.1) including documented exceptions; any new exception requires a CONTEXT-documented reason (that's the point) |
| R-4 | Collisions with 16: `container.ts:285-287` (16-02 render order/gaze rewiring) and `audio-engine.ts` (D-3 removal in 16-04) | HIGH | 14-02/14-03 touch `container.ts` only additively (test file + a debug method on the bus); 14-04 does not touch `audio-engine.ts` at all. Sequencing note §5 |
| R-5 | Lifecycle test brittle (jsdom mock of WebGL container) | MEDIUM | `tests/container.test.ts` already constructs the container in jsdom — extend it, don't invent a new harness |
| R-6 | ARCHITECTURE.md drifts from reality the week after it's written | HIGH | Written **after** 14-01..04 land (wave ordering); every claim carries file:line evidence; 14-06 retro adds a "verify claims" step to the next milestone checklist; ARCH-08 keeps it linked from README/.planning index so drift is visible |
| R-7 | Deleting `model-cache.ts` removes a useful future feature | LOW | The module + test are preserved in git history; the decision (D5) records why (no user; HTTP cache covers reload); resurrection is a revert |
| R-8 | 12-06 (comment translation) touches the same files 14-01 edits (`speech-backend.ts`, `meta-person-loader.ts`) | MEDIUM | Recommended order: 12 lands before 14 (12-CONTEXT §6.2 already says this); if 14 lands first, re-anchor the 3 cast locations — they're line-stable (top-of-file region) |

---

## 3. Scope decisions

**D1 — Document + guard, don't restructure.** The valuable moves for a portfolio repo are:
a truthful ARCHITECTURE.md, machine-enforced layering, a lifecycle regression test, full
type coverage, dead code gone. Controller splitting / module moves belong to 16/17 (and to
the AvatarDirector milestone if ever green-lit). Anything 14 does to wiring is additive.

**D2 — `tests/` gets type-checked via `tsconfig.test.json` + `npm run typecheck`.** New
tsconfig extending the base with `include: ["src", "tests"]`; script
`"typecheck": "tsc --noEmit -p tsconfig.test.json"`. `npm run build` stays as is (src-only,
fast). Phase 18's CI runs typecheck before tests. This closes Hole 1 without slowing the
dev loop.

**D3 — The layering gate is a vitest test now, an ESLint rule later.** `tests/layering.test.ts`
parses static imports (regex over `from '…'`, resolving `../`), applies a
module-granular allow-table (from §1.1) and fails on violations — runs in `npm test` like
the 12-01 language gate, zero new tooling. 18-04 later mirrors the same table into ESLint
(`no-restricted-imports`/boundaries) for editor feedback; the test stays as the CI truth.

**D4 — Event catalog lives in ARCHITECTURE.md, verified at writing time.** A 16-row
producer/consumer table, generated by grepping `emit('` call sites during 14-05 execution —
not guessed. The bus invariants (idempotent Unsub, emit-over-copy, handler isolation) are
documented next to it and already tested in `tests/events.test.ts`.

**D5 — Delete the dead, document the transitional.** `eleven-client-smoke.ts` and
`model-cache.ts` (+ its test) are deleted; `legacy-bridge.ts` stays with explicit removal
criteria in code (comment block): removable when the v1.1 release has been public for one
milestone cycle AND `migrate.ts` handles the legacy keys alone — at that point the bridge
collapses into `migrate.ts` (one-shot on first store read).

**D6 — `noUncheckedIndexedAccess` ON; `exactOptionalPropertyTypes` OFF (recorded).** The
first is cheap insurance on exactly the hot paths 16/17 refactor; the second churns
optional-prop assignment patterns across the whole UI layer for marginal gain — revisit
post-v1.1 with the AvatarDirector work.

---

## 4. Proposed requirements

- **ARCH-01 Layering contract**: the measured layer stack (§1.1) is documented in
  ARCHITECTURE.md and enforced by `tests/layering.test.ts` (module-granular allow-table +
  documented exceptions: audio↔lipsync pair, features→app contract modules,
  app/store→domain types); any violation fails `npm test`; new exceptions require a
  documented reason in this phase's successor CONTEXT.
- **ARCH-02 Full-project typecheck**: `tsconfig.test.json` covering `src` + `tests`;
  `npm run typecheck` green in CI (18) and locally; `noUncheckedIndexedAccess` enabled;
  zero `any`/`as any`/`@ts-ignore` in `src/` (the 3 casts from §1.4 typed away);
  `exactOptionalPropertyTypes` decision recorded (D6).
- **ARCH-03 Lifecycle guarantee**: after `container.dispose()` the TypedEventBus holds zero
  handlers (asserted via a new test-only `handlerCount()` method on the bus) — a regression
  test extends `tests/container.test.ts`; the `disposables()`/Unsub pattern is documented
  in ARCHITECTURE.md as the mandatory lifecycle rule for anything added to `app/`.
- **ARCH-04 Event surface catalog**: all 16 `AppEvents` documented in ARCHITECTURE.md with
  payload type, producer(s), consumer(s) — verified against `emit(` call sites at writing
  time; naming convention `domain:action` stated; bus invariants documented and covered by
  `tests/events.test.ts`.
- **ARCH-05 Dead code removed**: `src/audio/eleven-client-smoke.ts` and
  `src/avatar/model-cache.ts` (+ `tests/model-cache.test.ts`) deleted; `legacy-bridge.ts`
  carries removal criteria (D5); a one-shot unused-export grep over `src/` runs during the
  plan and findings are either wired or deleted (nothing new left orphaned).
- **ARCH-06 Composition-root discipline**: `container.ts` documented as the only wiring
  point (ARCHITECTURE.md §"Composition root"); module-level side-effect imports stay
  forbidden (no top-level DOM/localStorage access outside `app/` and `ui/` — verified by
  the layering test's side-effect rule); `main.ts` stays ≤ ~100 lines.
- **ARCH-07 Extension seams documented**: ARCHITECTURE.md contains working "how to add"
  recipes — a studio/user panel (panel registry contract), an animation source (registry +
  the closed-union caveat owned by 16-06), a scene preset, a bus event, a speech backend —
  each listing exact files to touch, so the AvatarDirector direction is visible without
  reading 78 modules.
- **ARCH-08 ARCHITECTURE.md at repo root (English)**: recruiter/senior-reviewer-facing;
  every architectural claim carries file:line evidence from the tree at writing time;
  linked from README (Phase 13) and `.planning/README.md` (12-07); kept in sync by 14-06's
  retro checklist item.

---

## 5. Plans & sequencing (for the orchestrator)

| Plan | Wave | Owns | Requirements |
|---|---|---|---|
| 14-01 | 1 | Strictness: `tsconfig.test.json`, `typecheck` script, `noUncheckedIndexedAccess`, kill the 3 `any` casts, record `exactOptionalPropertyTypes` decision | ARCH-02 |
| 14-02 | 2 | Layering gate: `tests/layering.test.ts` + allow-table + side-effect rule | ARCH-01, ARCH-06 |
| 14-03 | 2 | Lifecycle: `handlerCount()` on the bus, dispose regression test, Unsub pattern doc note | ARCH-03, ARCH-04 (invariants) |
| 14-04 | 2 | Dead code: delete 2 modules + 1 test, legacy-bridge criteria comment, unused-export sweep | ARCH-05 |
| 14-05 | 3 | ARCHITECTURE.md: lift 14-DRAFT, verify every claim (emit catalog via grep), wire links | ARCH-04, ARCH-06, ARCH-07, ARCH-08 |
| 14-06 | 4 | Retrospective & correction: learnings → ROADMAP, drift vs 16/17 handoffs, ESLint contract handoff to 18 | (process) |

**Sequencing constraints (cross-phase):**

1. **16-02 vs 14-02/14-03**: both touch `container.ts` — 16-02 rewires `:285-287` (gaze
   provider + render order), 14-02/14-03 only *add* a test file and a debug method on the
   bus (no overlap with 16-02's lines). Either order works; if 16 lands first, 14-03's
   dispose test must be validated against the gaze-provider teardown 16-02 adds.
2. **16-04 owns `audio-engine.ts`** dead-API removal (D-3) — 14-04 does NOT touch that
   file. ANIM-08 and ARCH-05 are complementary, not overlapping.
3. **12-06 (comment translation) vs 14-01**: 12 recommended first (12-CONTEXT §6.2); if 14
   executes first, the 3 cast sites are line-stable top-of-file regions — re-anchor at
   execution.
4. **18-04 (ESLint)** consumes 14-02's allow-table as its rule source — the table must be
   exported as data (JSON or a TS const importable by both the test and, later, the lint
   config), not inlined as test logic.

---

## 6. What deliberately stays (non-goals)

- No directory relocations (the `a2f-backend.ts` → `lipsync/` move is recorded as a
  candidate, not executed).
- No controller splitting, no FaceController changes (16's lane), no viseme/G2P changes
  (17's lane).
- No ESLint/Prettier adoption in this phase (18's lane — this phase only prepares the data
  contract).
- No `exactOptionalPropertyTypes` (D6).
- Archive phases 01–11 stay untouched (language policy, 12-CONTEXT D2).
