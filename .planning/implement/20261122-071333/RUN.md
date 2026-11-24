# Implement run 20261122-071333

Branch: implement/v1.1-refactor (from master d4d2291) · baseline tag: impl-baseline-20261122 (d08154c)
Baseline gate: npm run build OK · vitest 47 files / 245 tests passed · tsc --noEmit exit 0

## Model routing (from user instruction, not flags)
| Role | Model | Source |
|---|---|---|
| orchestrator | session (sonnet) | session |
| standard worker | haiku | user: "haiku for simple/mechanical" |
| complex worker | sonnet | user: "sonnet for complex" |
| drift checker | haiku | default |
| final auditor | opus | user |

## Gate (every merge)
`npm run build && npx vitest run` — test count must never drop below the previous merge.

## Human steps
Skipped per user; plans stop at checkpoint:human-* and are recorded as PARTIAL/BLOCKED.

## Waves
- A (parallel worktrees): track-render 11.2-04,05,06 [sonnet] · track-lip11 11.2-07,08 [sonnet] — 11.2-03/09 BLOCKED (real ElevenLabs recording / hero capture)
- B (serial main): 12-01..07 [haiku; 12-05/06 sonnet]
- C (parallel worktrees): track-ui 15-01..07 · track-anim 16-01..07 then 17-01..06 (shared face-controller.ts)
- D (serial main): 14-01..06 · 13-01,02,04 · 18-03,04 · 18-02 (drafts) · 18-07 partial — 13-03, 18-05, 18-06 BLOCKED on human
- Final: opus audit -> FINAL-REPORT.md

## Log
- Incident: manual worktree junction removal wiped main node_modules; restored with `npm ci`, gate re-verified 245/245. Switched to harness worktrees (project hook requires isolation="worktree").
- Gate amended: `npx vitest run --dir tests` (plain `vitest run` also collects `.claude/worktrees/**` tests → inflated 772).
- A/lip11 merged 34a22e1: 11.2-07 DONE, 11.2-08 DONE (code); human verify DEFERRED. Gate: build OK, 49 files / 259 tests. Deviations: tests/calibration.test.ts + tests/viseme-overrides.test.ts edited outside lock (assertions follow new defaults); mouthPress table 0.58 (effective 0.348).
- A/render merged ff17385: 11.2-04/05/06 DONE (code); human verify DEFERRED (real GPU). Gate: build OK, 50 files / 275 tests. Deviation: tests/container.test.ts mocks extended outside lock. Headless swiftshader shots in 11.2 shots/.
- Wave A complete. 11.2-03, 11.2-09 BLOCKED (real ElevenLabs recording; hero capture).
- B started: 12-01 [haiku].
- B/12-01 merged a8c8dc1 DONE [haiku]. Gate: build OK, 51 files / 281 tests. Docs renamed (8). Drift B1 recorded.
- B/12-02 merged DONE [haiku]: 3 core docs EN, docs/core Gate A scope ON. Gate 51/282. Drift: none downstream (docs-only; 'Etap'→'Stage' glossary candidate).
- B/12-03 DONE, 12-04 PARTIAL merged a385f24 [haiku]. Gate 51/283. docs/ 10/10 EN, Gate A docs/all ON.
  - CCR C (STATE/REQUIREMENTS old doc names) applied by orchestrator.
  - CCR A (a2f/README.md:4,46 → a2f-local-setup.md, then empty Gate B skip-list + mechanics test expects []) → hand to 12-06 follow-up / 12-07 (a2f/README.md is in 12-06 lock).
  - CCR B (TODO_humanInTheLoop.md:75,76,100 filename fixes) → 12-07 (in its files_modified).
- B/12-05 DONE, 12-06 DONE merged 98802f5 [sonnet]. Conflict in tests/language.test.ts (scope flags docs/all vs src) resolved by orchestrator: both ON. Gate 52/291. copy.ts created by 12-05 (15-02 must adapt). a2f/README link fixed (CCR A part 1).
- B/12-07 DONE merged 3638304 [haiku]. Gate 52/293. Gate A all scopes ON (README exception until 13), Gate B skip-list empty. Phase 12: 7/7 automated PASS, manual UAT pending. ROADMAP/REQUIREMENTS updated by orchestrator. Wave C started (15 ∥ 16) from baba904 — 12-07 tests/** translation merged after their base: expect conflicts in tests/.
- 2026-11-22/23: Wave C interrupted (weekly API limit on 15; session end on 16). Progress saved: 15-01..04 (ce6c53c), 16-01..04 (acbde32). 2026-11-24: both agents resumed via SendMessage at 15-05 / 16-05.
- C/16 merged 23078ad [sonnet]: 16-01..07 DONE. 6 test conflicts (12-07 EN names vs 16 logic) resolved by orchestrator: 16 logic + EN names. Gate 59/346. DEFERRED-HUMAN: 5 manual UAT + sign-off of 5 intentional behavior changes (16-VERIFICATION).
- C/15 merged da72a3f [sonnet]: 15-01..07 DONE. 1 conflict tests/container.test.ts resolved (15 tests, EN names). Gate 66/417. DEFERRED-HUMAN: 15-VERIFICATION §2-5 (visual matrix, keyboard walk, failure injection, viewport tiers, screenshots for 13-03). style.css grew 1229→1510 (plan expected shrink).
- Drift C1 recorded. D started: track-lip 17-01..06 [sonnet] ∥ track-readme 13-01,13-02 [haiku].
- D/13-01,13-02 merged 4fd5473 [haiku] DONE. Gate 66/417. README EN, removed 9 false draft claims; README in Gate A root scope. Follow-ups: @elevenlabs/client unused dep; 5 dev-only npm audit advisories; Node 20 floor untested. Drift: README now truthful re 'no ARCHITECTURE.md/LICENSE/typecheck' → 14-05/18-02/18-07 must add README links when those land.
- D/17 merged 4a0e79e [sonnet]: 17-01..04,06 DONE, 17-05 PARTIAL (live UAT DEFERRED-HUMAN). Gate 73/678. Bundle: dict 3,924 kB/961 kB gz → 259 kB/64.5 kB gz; total JS gz ~1162 → ~277 kB. GAP: T-8 a2f-parser edge cases unowned. Edits outside files_modified listed in 17 SUMMARYs (migrate, app-types, animation-controller/panel, copy, status-pill, style.css, vite.config warning limit).
- Drift D2 recorded. E started: track-arch 14-01..06 [sonnet] ∥ track-docs 13-04 → 18-02 [haiku].
- E/13-04 PARTIAL + 18-02 DONE merged bde1543 [haiku]. Gate 73/678. LICENSE = All Rights Reserved (wording approval DEFERRED-HUMAN). cmu-pronouncing-dictionary is ISC (18-CONTEXT said BSD-2). README test counts stale (417/66 vs 678/73) → orchestrator fixes after Phase 14 merge.
- E/14 merged 26d6ddd [sonnet]: 14-01..06 DONE (automated PASS, UAT pending). Gate: typecheck exit 0, build OK, 75/705. realism→lipsync edge fixed by git mv anim-config + alloc-probe → realism/ (no shim); 1 reasoned exception left (audio/a2f-backend → lipsync/a2f-parser). Dead: model-cache, setupRoomEnvironment, compare:disposed, 8 exports; 13 un-exported. Known gaps: EmbedBridge window listener, AudioEngine.dispose, vignette DOM; tests/speech-backend.test.ts:3 any[]; animation-sources.ts:72,79 Polish labels (gate miss).
- Orchestrator: README.md:8 test count 417/66 → 705/75 (line 99 already updated by 14).
- Drift E1 (inline): 18-03 can use `npm run typecheck` (exists now); 18-04 can import tests/layering-rules.ts (exists); CI branch = master.
- F/18-03 PARTIAL (CI written+locally validated; first GitHub run DEFERRED-HUMAN), 18-04 DONE, 18-07 PARTIAL merged 3a0690b [sonnet]. Interrupted once by 5h API limit, resumed via SendMessage.
- Orchestrator fix: `npm test` → `vitest run --dir tests` (plain vitest collected .claude/worktrees/** → stale worktree test failed `verify` locally; CI unaffected). tests/agent-id.test.ts CRLF-only Prettier fix. `npm run verify` exit 0: typecheck 0, 75/706, build OK, lint 0 (--max-warnings 0), format OK.
- Not executed (owner): 11.2-03, 11.2-09, 13-03, 18-05, 18-06. Deferred human sign-offs: 11.2-04..08 visual, 12 UI/console UAT, 13 manual, 14 cold-open doc + dev boot, 15 §2-5, 16 UAT + 5 behavior changes, 17 live UAT, 18 LICENSE wording + first CI run.

## Follow-up 2026-11-24: audit remediation (Sonnet executors)

| Item | Owner | Result |
|---|---|---|
| L-2, L-3, L-4 (language scope, CSP note, .gitignore EN) | orchestrator | 5702590 |
| UIX-02/04 static gates (44px targets, WCAG AA tokens, aria-live, modal focus) | sonnet | merged 8507d78 |
| L-5 dispose paths (EmbedBridge, AudioEngine, vignette), @elevenlabs/client removed, npm audit 5 to 0, T-8 tests, M-3 engines | sonnet | merged 7f3cbd5 |
| THIRD-PARTY-NOTICES regeneration | sonnet | pending |

Gate after both merges: `npm run verify` exit 0, 78 files / 855 tests.
Drift: the UIX agent applied 44px (REQUIREMENTS UIX-02). `15-DRAFT-ui-spec.md` still says 36/40px, so the owner should amend the spec. Both executor worktrees were created from `master` and the agents rebased onto `implement/v1.1-refactor` themselves; future dispatch prompts must state the base branch.
