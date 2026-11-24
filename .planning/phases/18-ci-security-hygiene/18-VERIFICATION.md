---
phase: 18-ci-security-hygiene
type: verification
created: 2026-11-18
updated: 2026-11-24
verdict: PARTIAL
manual_uat: pending
---

# 18-VERIFICATION — CI, security, license, deploy, hygiene

> Executed 2026-11-24 for plans 18-01..04 and 18-07 (partial). 18-05 (Pages demo) and 18-06 (hygiene dispositions) are BLOCKED on owner decisions and are marked PENDING, not passed. Nothing here was run on GitHub: the owner has not pushed.

## 1. Automated gates

| Gate | Evidence | Result |
|---|---|---|
| Secrets | 18-01 SUMMARY: regex scan (gitleaks unavailable) over tracked tree + full `git log -p --all`: `sk-` values 0, quoted API-key assignments 0, bearer shapes 0; `xi-api-key` references are policy comments | PASS (fallback tool; gitleaks re-run optional) |
| `xi-api-key` policy | 18-01 scan above | PASS |
| CI green | `.github/workflows/ci.yml` written, YAML parsed, every step passes locally in order; never run on GitHub | **DEFERRED-HUMAN** (owner pushes; runtime unmeasured) |
| Lint/format | `npm run lint` (`--max-warnings 0`) exit 0; `npm run format:check` exit 0; layering rule shares data and decision code with `tests/layering.test.ts`; negative probe failed lint as expected (18-04 SUMMARY) | PASS |
| Verify umbrella | `npm run verify` exit 0 in about 22 s (typecheck, 75 files / 706 tests, build, lint, format:check) | PASS (local) |
| Tracked-tree hygiene | `git ls-files a2f/` shows no `sdk/` or `.venv`; no `.env`, `.pem`, `.key` or `dist/` tracked. `.claude/`, `scripts/` handling and `config.json.bak-*` are 18-06 | PARTIAL (18-06 pending) |
| Demo | 18-05 BLOCKED (no `demo=1` flag, no base-path override, "Listen" demo not executed) | PENDING |
| Suite | 75 files / 706 tests throughout; 705 before the animation-source label test | PASS |

## 2. Per-requirement acceptance

| Req | Check | Result |
|---|---|---|
| QUAL-01 | SECURITY.md exists; `.env`/`.pem`/`.key` ignored; scan documented. 11.1-01 hardening status is recorded in 18-01 SUMMARY | PASS (documented limits) |
| QUAL-02 | workflow and badge URL in README are real; badge shows "no status" until the first run | PARTIAL (first green run DEFERRED-HUMAN) |
| QUAL-03 | LICENSE is All Rights Reserved (owner decision 2026-11-19, not MIT); THIRD-PARTY-NOTICES verified against installed manifests. GitHub detection of an ARR file cannot apply | PASS (wording approval DEFERRED-HUMAN) |
| QUAL-04 | CONTRIBUTING lists setup, all commands, gates, language rule, PR rules; updated for `verify` | PASS |
| QUAL-05 | two labeled commits (36c65e2, 801eaef); single-source layering rule proven by a negative probe | PASS |
| QUAL-06 | demo not built | PENDING (18-05 BLOCKED) |
| QUAL-07 | dispositions, metadata checklist, size table not done | PENDING (18-06 BLOCKED) |
| QUAL-08 | `npm run verify` exists and is green locally; README Verification final. The cold-clone proof is 13-02's earlier run plus a first CI run that has not happened | PARTIAL |

## 3. Manual UAT (human session — PENDING)

1. Repo page as a stranger: badge status, license shown, social preview set, demo link works.
2. Demo on a phone or second machine (needs 18-05).
3. Owner: metadata items executed (description, topics, preview) from the 18-06 checklist.
4. Owner: quota decision (D4) and hygiene dispositions (D6) recorded as theirs.
5. Owner: push to `master` or open a PR, confirm the CI run is green, record the run URL and runtime here.

## 4. Cross-phase handoffs verified

- 14-01/14-02 outputs consumed: `typecheck` step in CI, layering rule data and decision code in ESLint. Single source held.
- 13-01 slots: CI badge filled; license section filled (18-02); demo link slot still open (18-05).
- 12-01 language gate runs inside `npm test` and so inside CI and `verify`. One gap found: it matches diacritics only, so two Polish labels without diacritics in `animation-sources.ts` passed it; translated in 3231a7f and pinned by a test.
- Milestone close-out prep delivered in 18-07-SUMMARY (not applied to ROADMAP / STATE / REQUIREMENTS by this executor).

## 5. Result

**Phase verdict: PARTIAL.** Automated and local gates pass for 18-01..04 and the verify umbrella. Open: 18-05, 18-06 (owner), the first GitHub CI run, wording approval for LICENSE.
