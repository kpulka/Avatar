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
