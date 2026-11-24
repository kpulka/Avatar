---
phase: 18-ci-security-hygiene
plan: 07
status: partial
type: execute
requirements: [QUAL-08]
commits: 2
plan_head_before: 2bf2dc9
plan_head_after: 9c6831b
created: 2026-11-24
human_pending:
  - "18-05 Pages demo and 18-06 hygiene dispositions: BLOCKED on owner decisions"
  - "first GitHub CI run green: DEFERRED-HUMAN"
---

# Phase 18 Plan 07: verify umbrella, VERIFICATION, close-out prep (PARTIAL)

**`npm run verify` (typecheck, tests, build, lint, format:check) exists, passes in about 22 s, and README and CONTRIBUTING describe it. 18-VERIFICATION is executed with honest results; everything that depends on 18-05 and 18-06 is PENDING.**

## Done

- `package.json`: `"verify": "npm run typecheck && npm test && npm run build && npm run lint && npm run format:check"` (order kept from the plan; typecheck fails fastest).
- README Verification section: `npm run verify` as the headline, individual commands underneath, one line on CI. CONTRIBUTING: commands, gates, Node floor. Test counts refreshed to 706 / 75.
- 18-VERIFICATION filled (automated PASS for 18-01..04 and verify; PENDING for demo, hygiene, UAT).
- Phase 12 follow-up: `animation-sources.ts` labels translated (3231a7f) and pinned by a test.

## Not done (PENDING)

- Tasks 5 (retrospective claims needing a live badge, demo, metadata) and 7 (ROADMAP/STATE edits): not applied. This executor was told not to edit ROADMAP, STATE or REQUIREMENTS; the updates are listed below.
- Task 6 close-out artifacts partially: the tag draft and leftovers list are below.

## Retrospective (goal-backward: "credible at a glance and safe by construction")

| Claim | Status |
|---|---|
| Scan clean | yes (18-01, fallback regex tool; gitleaks re-run is optional) |
| License | All Rights Reserved file present; wording approval pending; GitHub shows no OSI license by design |
| Badge green on master | unproven: workflow never ran on GitHub |
| Demo live | no (18-05 BLOCKED) |
| `verify` reproducible from a cold clone | locally yes; cold clone and CI run pending |
| Metadata set | no (18-06 BLOCKED) |

## Close-out prep (for the orchestrator to apply)

**ROADMAP.md (Phase 18 row):** 18-01 done, 18-02 done (ARR license), 18-03 partial (workflow written, GitHub run deferred), 18-04 done, 18-05 blocked (owner), 18-06 blocked (owner), 18-07 partial. Phase 18 status: In progress / PARTIAL, not complete.

**STATE.md:** position "Phase 18: 18-03/04/07 landed on worktree-agent-a165c9232049c0ed3 (HEAD 9c6831b plus this summary); gate typecheck 0, lint 0, 75 files / 706 tests, build OK, verify 22 s". Decisions: Prettier 140/es5/quoteProps preserve; ESLint layering rule shares `tests/layering-check.ts`; `require-await` off in tests only. Blockers: owner for 18-05/18-06, LICENSE wording, push for first CI run.

**REQUIREMENTS.md:** QUAL-01 done; QUAL-02 partial (CI run pending); QUAL-03 done (wording approval pending); QUAL-04 done; QUAL-05 done; QUAL-06 pending; QUAL-07 pending; QUAL-08 partial (cold clone and CI run pending). Do not blanket-check.

**Release tag `v1.1` (draft, owner executes at close):** `git tag -a v1.1 -m "v1.1: English-only repo, architecture guards, UI/animation/lip-sync refactor, CI, lint"`, only after the first green CI run and the 18-05/18-06 decisions.

**Known leftovers the close-out must see:**
1. First GitHub CI run (workflow, lint and format steps, Node 22) and its runtime.
2. 18-05 demo (needs 11.2-03 "Listen" and the D4 decision) and 18-06 dispositions (`.claude/`, `scripts/make-demo-clip.mjs`, `config.json.bak-*`, repo metadata).
3. LICENSE wording and copyright holder approval; model (MetaPerson GLB) license terms unverified.
4. Dependencies: `@elevenlabs/client` is a runtime dependency that nothing in `src/` imports; 5 dev-only `npm audit` advisories (now more, with the ESLint tree: run `npm audit` for the current number).
5. Gaps from earlier retros: EmbedBridge window listener, AudioEngine.dispose, vignette DOM (Phase 14), T-8 a2f-parser edge cases, deferred-human UAT lists in 11.2, 15, 16, 17.
6. Language gate matches diacritics only; consider a word-list check for Polish words without diacritics.
7. Node 22 not run locally (local Node 25.6.1).

## Verification

`npm run verify` on this branch: typecheck exit 0; 75 files / 706 tests; build OK; lint exit 0; format:check exit 0; about 22 s wall.

## Deviations from Plan

- ROADMAP/STATE/REQUIREMENTS edits and task 5 retrospective evidence needing live systems were not performed (instruction and missing dependencies); reported above instead.

## Self-Check: PASSED

Commits 9c6831b and 3231a7f exist; `verify` re-run green after the last code commit.
