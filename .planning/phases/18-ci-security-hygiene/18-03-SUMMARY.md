---
phase: 18-ci-security-hygiene
plan: 03
status: partial
type: execute
requirements: [QUAL-02]
commits: 1
plan_head_before: cda8128
plan_head_after: e2573c0
created: 2026-11-24
human_pending:
  - "CI green on GitHub: DEFERRED-HUMAN (owner pushes; the first run and its runtime are unobserved)"
---

# Phase 18 Plan 03: CI workflow and badge

**`.github/workflows/ci.yml` exists and every command it runs passes locally in the workflow's order. The workflow has never run on GitHub, so QUAL-02 stays PARTIAL until the owner pushes and the first run is green.**

## What was built

- `.github/workflows/ci.yml`: ubuntu-latest, Node 22 with npm cache, `npm ci` -> `npm run typecheck` -> `npm test` -> `npm run build` -> upload `dist` (7-day retention). Triggers: push to `master` and all pull requests. Read-only `contents` token, concurrency group cancelling superseded runs, 10-minute job timeout.
- README: the CI badge slot is filled with the real workflow URL (`.../actions/workflows/ci.yml/badge.svg`), in the Verification section, with one sentence describing what the workflow runs. The badge shows "no status" until the first run exists. It is not a claim of a green build.
- CONTRIBUTING.md: the "CI is planned" sentence replaced with a description of the real workflow.

## Verification (local)

| Check | Result |
|---|---|
| YAML syntax | parsed with PyYAML 6.0.3; keys `name/on/permissions/concurrency/jobs`, triggers `push.branches=[master]` + `pull_request`, run steps exactly `npm ci`, `npm run typecheck`, `npm test`, `npm run build` |
| `npm ci` | OK (clean install from the lockfile) |
| `npm run typecheck` | exit 0 |
| `npm test` | 75 files / 705 tests passed |
| `npm run build` | OK; dist produced (index 197 kB, dict chunk 259 kB, three 594 kB, no chunk-size warning) |
| Case-sensitivity (Linux runner) | every relative link in tracked non-planning `.md` files resolves with exact case; no test string literal path differs in case from the tracked file. 0 findings |
| Path separators (R-3) | `tests/layering.test.ts` normalizes with `sep` -> `/`; `tests/language.test.ts` normalizes `\` -> `/`. No portability fix was needed |

## Not verified (DEFERRED-HUMAN)

1. First run on GitHub (push to `master` or open a PR) and its status. A red first run is a finding to record here, per the plan.
2. Total runtime against the ~3 min budget. Local build+test took about 7 s on Node 25; the runner time (mostly `npm ci`) is unmeasured.
3. Task 3 of the plan (draft PR and watching the run) cannot be done without push access. Not attempted.
4. Local Node is 25.6.1 and CI uses 22. The suite has not been run on Node 22.

## Deviations from Plan

- Trigger branch is `master`, not `main` (the repo has no `main`).
- No `TODO(14-01)` fallback: `npm run typecheck` exists (Phase 14), so the step is real.
- Added `permissions: contents: read`, `concurrency` and `timeout-minutes`, none in the plan's sketch. All are hardening with no behavior change.
- No `build:dict` step: the pruned lexicon JSON is committed.
- Badge placed in the README Verification section (where the slot sat) and not at the top; the slot comment is removed.

## Self-Check: PASSED

`.github/workflows/ci.yml` exists; commit e2573c0 is on the branch.
