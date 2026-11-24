---
phase: 13-readme-showcase
plan: 01
status: complete
type: execute
requirements: [READ-01, READ-02, READ-04, READ-06]
commits: 1
plan_head_before: e22cb82
plan_head_after: 363e73b
created: 2026-11-24
---

# Phase 13 Plan 01: English README showcase rewrite

**README rewritten in English from 13-DRAFT, with every claim checked against the tree on 2026-11-24; README now in the language gate's enforced scope.**

## Scope notes

- Base was `e22cb82` (`implement/v1.1-refactor`, fast-forwarded; includes drift C1).
- Drift C1 applied: `docs/animation-runtime.md` and `docs/lipsync-deep-dive.md` do not exist, so the two deep-dive rows were removed and the pointer now goes to `docs/3-lip-sync-and-coarticulation.md` and `docs/4-audio-and-barge-in.md`. No skip-list entry was needed, so `GATE_B_SKIP_LIST` stays empty.
- Drift C1: README removed from the language-gate exemption in `tests/language.test.ts` (root scope). Only that scope line and its comment changed.
- Drift B1: docs links use the post-rename canonical filenames.
- Quickstart claims were checked by running the commands (see 13-02 for the cold-clone run).

## Changes

- `README.md`: full rewrite (English, ~107 lines body incl. slots).
- `tests/language.test.ts`: `'README.md'` added to the `root` Gate A scope; exemption comment replaced.

## Truthfulness checklist (claim -> evidence)

| # | Claim in README | Evidence (2026-11-24) | Result |
|---|---|---|---|
| 1 | `npm install`, `npm run dev` serves on http://localhost:5310 | `vite.config.ts` server.port 5310 + strictPort; dev server printed `Local: http://localhost:5310/` (ready in 663 ms); `curl` 200 | Pass |
| 2 | Avatar renders with zero setup | Headless Chrome on :5310 -> screenshot shows rigged avatar; console `Successfully loaded the rigged MetaPerson avatar.glb model` | Pass |
| 3 | Avatar model is committed | `git ls-files public/models/avatar.glb` tracked; 11,964,392 bytes served 200 | Pass |
| 4 | Node 20 or newer | `node_modules/vitest/package.json` engines `^20 \|\| ^22 \|\| >=24` | Pass |
| 5 | Studio opens with `?studio=1` and shows the panels | Screenshot: Animation, A2F, Session, Scene tabs plus floating Visemes and Inspector; `src/ui/studio/panels/` has six panels with `visibleIn: 'studio'` | Pass |
| 6 | Ctrl+Shift+D toggles studio | `src/app/ui-mode.ts` L80-84 (`ctrlKey && shiftKey && key === 'd'`) | Pass |
| 7 | H / Esc toggles presentation mode | `src/app/container.ts` L319 | Pass |
| 8 | "▶ Sample speech (EN)" in Animation tab speaks with lip-sync and captions | Button label `animation.phraseEn` visible in screenshot; `testPhrase('en')` -> `speak` -> `speechBackend.triggerDemoSpeech` | Pass, with the wording fixed: audio is synthetic tones (`speech-backend.ts` L347-366), not a recording |
| 9 | "▶ A2F demo (frames)" plays `public/demo/demo-speech.wav` | File tracked, served 200 (163,506 bytes); `animation-controller.ts` `DEMO_VOICE_URL`; synthetic fallback when missing | Pass |
| 10 | "Listen" button | No such label exists in `src/` or `copy.ts` | FAIL in draft, removed; replaced by item 8 |
| 11 | Agent ID in Studio → Session; `?agent_id=` has priority | `session-panel.ts`; `agent-config.ts` `resolveAgentId` (url > settings > default); `tests/agent-id.test.ts` (3 resolution tests) | Pass |
| 12 | "No agent" -> readable error | No such error path exists: a default agent ID is bundled (`DEFAULT_AGENT_CONFIG.agentId`), so the app always tries an agent. Failure path is `voice:error` -> connection banner ("The conversation could not start") + `Connection error: {message}` toast (`conversation-controller.ts` `startSession`, `connection-banner.ts`; `tests/conversation-controller-start.test.ts`) | Draft claim corrected; README states the bundled-default behaviour |
| 13 | Client never uses an ElevenLabs API key | `grep -i "xi-api-key\|api_key\|apiKey" src` -> 0 hits | Pass |
| 14 | WebGL fallback card | `src/main.ts` imports `handleWebGLFailure`; `copy.ts` `webgl.title` | Pass |
| 15 | Port 5310 pinned, change in `vite.config.ts` | `vite.config.ts` L6-7 | Pass |
| 16 | TypeScript strict | `tsconfig.json` `"strict": true` | Pass |
| 17 | 417 tests in 66 files | `npx vitest run --dir tests` -> `Test Files 66 passed`, `Tests 417 passed` (before and after this plan) | Pass (draft's "~200" removed) |
| 18 | `npm test` is unit tests plus language gate | `package.json` `"test": "vitest run"`; language gate green (11 tests) | Pass (see 13-02 for `npm test` run) |
| 19 | `npm run build` runs tsc then vite | `package.json` `"build": "tsc && vite build"`; build exit 0 | Pass |
| 20 | No typecheck script | `package.json` scripts: dev, build, preview, test | Draft's `npm run typecheck` removed |
| 21 | Single writer: only FaceController applies face weights | `applyWeight(` callers: 14 in `src/lipsync/face-controller.ts`; the only other occurrence is the interface in `src/types/avatar.ts` | Pass |
| 22 | Epoch-based barge-in, stale chunks dropped | `tests/barge-in-pipeline.test.ts`, `tests/race-condition-epoch.test.ts` (passing) | Pass |
| 23 | One audible clock for audio and face | `src/audio/audible-clock.ts`; `face-controller.ts` uses `audibleClock` (5 refs) | Pass |
| 24 | CMUdict phonemes with fallback rules | `cmu-pronouncing-dictionary` dependency; `src/lipsync/g2p/g2p-en.ts` (lexicon load, fallback); `tests/g2p-en.test.ts` | Pass |
| 25 | Polish digraphs and nasal vowels mapped | `src/lipsync/viseme-mappings.ts` (digraph list, Ą/Ę cases). **No dedicated Polish test** (`viseme-mappings.test.ts` covers EN digraphs) | Pass with caveat, written as "implemented" and noted in the status table |
| 26 | A/B comparison on the last turn | `src/features/compare-controller.ts`; `copy.ts` `algo.empty`; "Compare A/B" visible in user-layer screenshot; `tests/compare-controller.test.ts`, `tests/compare-ui.test.ts` | Pass |
| 27 | Local Audio2Face is scaffolded, not wired end to end | `a2f/` exists with README; `src/lipsync/a2f-parser.ts`; `animation-controller.ts` warns `predict unavailable — falling back` when no server | Pass (status 🧪) |
| 28 | Cloud Run Audio2Face is design only | `docs/7-audio2face-cloudrun.md`; no Cloud Run references in `src/` | Pass (status 🚧) |
| 29 | Gaze, blinks, head micro-movements tested | `tests/gaze-saccades.test.ts`, `tests/procedural-blink.test.ts`, `tests/head-micro-movements.test.ts` exist | Pass |
| 30 | Ten docs in the index, canonical names | `ls docs/*.md` -> 10 files, all linked (Gate B green) | Pass |
| 31 | Two deep-dive links | Targets do not exist -> rows removed, pointer to docs/3 and docs/4 | Corrected |
| 32 | "Layers enforced by a test" | No layering test exists (planned for 14-02). Claim removed | FAIL in draft, removed |
| 33 | "Lifecycle gate" | No such gate exists. Not claimed | Removed |
| 34 | Architecture links (ARCHITECTURE.md §9) | `ARCHITECTURE.md` does not exist (14-05). Replaced with docs/1 and docs/4 links | Corrected |
| 35 | License section | No `LICENSE` or `THIRD-PARTY-NOTICES.md` exists; removed "permissive and audited" claim; text now says no license file yet | Corrected |
| 36 | CI badge and demo link | Only HTML comments (18-03, 18-05 contracts), no rendered badge or link | Pass |
| 37 | Phases 1-11 Polish, 12+ English; decision log at `.planning/README.md` | `.planning/README.md` lines 62-70 and 4 ("GSD (Get Shit Done)") | Pass (draft's "openGSD" replaced with "GSD") |
| 38 | Hero "audio stops in < 50 ms, face relaxes in < 300 ms" | No test or measurement backs either number | Removed |
| 39 | Dependency tree "audited" as permissive | No audit exists (Phase 18) | Removed |
| 40 | Presentation of `@elevenlabs/client` | Dependency is listed in `package.json` but unused in `src/`. README does not claim it is used | Noted for follow-up (not a README claim) |

## Gates (after this plan)

- `npm run build`: exit 0 (tsc + vite).
- `npx vitest run --dir tests`: 66 files, 417 tests passed (baseline unchanged).
- `npx vitest run tests/language.test.ts`: 11 passed, README included in the root Gate A scope and Gate B link resolution.

## Read-aloud pass

Done as a read-through of the final text while writing it (clunkers fixed: "to talk with it", "the avatar appears"). A native-English tone check remains for UAT (13-VERIFICATION section 3). The glossary check (12-DRAFT-glossary) was not re-run in this plan.

## Deviations from Plan

**1. [Rule 1 - Bug] Draft claims that were false or unverifiable were removed or corrected**
- **Found during:** Task 1 (tree re-verification) and task 3 (truthfulness pass)
- **Issues:** "Listen" button (does not exist); "no agent -> readable error" (a default agent is bundled, so that path does not exist); "~200 tests" (417 measured); "layers enforced by a test" and "lifecycle gate" (not present); `npm run typecheck` (not a script); `ARCHITECTURE.md`, `LICENSE`, `THIRD-PARTY-NOTICES.md` links (absent); "audio stops < 50 ms, face relaxes < 300 ms" (unbacked); "permissive and audited" (no audit).
- **Fix:** corrected in README; table above records each change.
- **Commit:** 363e73b

**2. [Plan deviation - task 2 link rule] Deep-dive rows replaced**
- Per drift C1 the two deep-dive docs do not exist, so the rows were removed rather than marked "(landing in v1.1)". No skip-list entries were added to Gate B, which is required to stay empty.

**3. [Plan deviation - task 3 wording] Sample speech is not a recording**
- The draft said "recorded TTS sentence". The EN sample is synthesized tones with character timing. README says so. The bundled recording is used only by the A2F demo.

## Known Stubs

None. The three placeholder comments (`13-03`, `18-02`, `18-03`, `18-05`) are contracts with sibling plans, kept verbatim, and are HTML comments with no visible broken link.

## Threat Flags

None. Documentation-only change plus a test-scope line.

## Self-Check: PASSED

- README.md present and committed in 363e73b.
- tests/language.test.ts committed in 363e73b.
- Build and full test gates green (see above).
