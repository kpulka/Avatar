---
phase: 12-english-language
plan: 04
subsystem: i18n
status: partial
tags: [i18n, docs, translation, link-repair, language-gate, git-mv]
requires:
  - phase: 12-english-language
    plan: 03
    provides: lip-sync trio translated, docs/core Gate A scope at 6 files
provides:
  - English translation of the remaining four docs (5-shaders, 6-opensource, 7-audio2face, a2f-local-setup); docs/ is 10/10 English
  - Gate A scope docs/all enforced (zero diacritics in all ten docs/ files)
  - Filename-only link repair in README, .planning/ROADMAP.md and .planning/prompts/review-a2f-unification.md
affects: [12-05, 12-06, 12-07]
key-files:
  modified:
    - docs/5-shaders-and-realism.md
    - docs/6-opensource-analysis-and-future.md
    - docs/7-audio2face-cloudrun.md
    - docs/a2f-local-setup.md
    - README.md
    - .planning/ROADMAP.md
    - .planning/prompts/review-a2f-unification.md
    - tests/language.test.ts
commits: 4
plan_head_before: 7fb5e92
plan_head_after: 427ffc2
metrics:
  tasks: 4
  commits: 3
---

# Phase 12 Plan 04: Docs translation wave 3 + link repair Summary

**Status: PARTIAL.** The docs translation is complete (10/10 English) and the doc-link repair is done in every file inside the write-lock. The final step, emptying the Gate B skip-list, is blocked: the one remaining broken markdown link is in `a2f/README.md`, which is outside the write-lock and excluded by the coordination note. The skip-list therefore still holds the 8 pre-rename names. Cross-epic requests are listed below.

## Commits

| Commit | Message | Content |
|---|---|---|
| 6d05c75 | docs(i18n): translate realism/opensource/a2f docs to English | docs/5, docs/6, docs/7, docs/a2f-local-setup |
| e61e66f | test(i18n): enforce Gate A on all docs/ files (docs/all scope) | `tests/language.test.ts`: docs/all enforced |
| 427ffc2 | docs(i18n): repair doc links to canonical EN filenames (living docs + README) | README, ROADMAP, prompts/review-a2f-unification |

## Task results

1. **Translate wave 3.** docs/5 (145 lines), docs/6 (91), docs/7 (98), docs/a2f-local-setup (124) are English. Tables (performance budget, scene presets, the 6-row OSS table, the setup-status table, troubleshooting), mermaid sequence, ASCII diagrams and code blocks keep their layout. Comment-stripped code diff against HEAD: docs/5 identical; docs/6 and docs/7 differ only in diagram labels and prose; a2f-local-setup differs only in comments and the one prose line.
2. **Link repair (filename-only).** The eight old names were replaced by exact-string substitution in README (docs table and inline references; content untouched), .planning/ROADMAP.md (docs refs and plan lines; progress rows untouched) and .planning/prompts/review-a2f-unification.md. Bare words such as `koartykulacja` in prose were not changed.
3. **Skip-list.** NOT emptied (see Deviation 1). Remains 8 entries, so the mechanics test "skip-list equals the 8 pre-rename names" still passes.
4. **docs/all.** Flipped ON; all ten docs/ files scanned with zero diacritics.

## Gate numbers

| Gate | Command / check | Result |
|---|---|---|
| Build | `npm run build` | exit 0, built in 8.10s |
| Suite | `npx vitest run --dir tests` | 51 files passed, 283 tests passed (previous 282; +1 from the new docs/all Gate A test) |
| Gate file alone | `npx vitest run tests/language.test.ts` | 8 passed |
| Gate A enforced scopes | `docs/core` (6 files), `docs/all` (10 files) | green; 0 diacritic lines in docs/ |
| Gate B broken links | within gate, skip-list 8 | 0 unresolved (1 link tolerated by the skip-list: `a2f/README.md -> ../docs/A2F-LOCAL.md`) |
| Gate B skip-list | `GATE_B_SKIP_LIST` | 8 (must be 0; blocked, see cross-epic request A) |
| Old-name markdown links in enforced scope | grep over `](...)` | 1 (a2f/README.md:46, out of lock) |
| Old-name references (plan acceptance grep) | grep over the plan's file set | not zero: TODO 3 lines, STATE 2, REQUIREMENTS 2, a2f/README 2 (all out of lock; see requests B and C) |

## Cross-epic change requests

CROSS-EPIC CHANGE REQUEST A (blocks the skip-list step; needed for Gate B):
- File: `a2f/README.md`, line 46 `[`docs/A2F-LOCAL.md`](../docs/A2F-LOCAL.md)` and line 4 `docs/A2F-LOCAL.md` (backtick).
- Change: `A2F-LOCAL.md` → `a2f-local-setup.md` in both places (filename-only).
- Why: it is the only real markdown link that breaks once the skip-list is emptied. `a2f/` is excluded by the coordination note, so this needs explicit approval.
- After it lands: remove the 8 `TODO(12-04)` entries from `GATE_B_SKIP_LIST`, update the mechanics test to expect `[]`, and run the gate again.

CROSS-EPIC CHANGE REQUEST B (needed for the plan's grep criterion, not for Gate B):
- File: `TODO_humanInTheLoop.md`, lines 75, 76, 100 (backtick references `docs/A2F-LOCAL.md` §4/§5 and `docs/EN-visemes.md` §6).
- Change: filename-only, to `docs/a2f-local-setup.md` and `docs/en-visemes.md`.
- Why: the file is in the 12-04 Files section but not in files_modified, so it is outside the lock.

CROSS-EPIC CHANGE REQUEST C (needed for the plan's grep criterion; the plan lists these files in files_modified, but the orchestrator forbids edits to them):
- `.planning/STATE.md` lines 85 (`docs/EN-visemes.md`) and 138 (`docs/A2F-LOCAL.md`).
- `.planning/REQUIREMENTS.md` lines 67 (`docs/A2F-LOCAL.md`) and 69 (`docs/EN-visemes §6`).
- Change: filename-only.

## Deviations from Plan

**1. [Blocked - cross-epic] Skip-list not emptied**
- **Found during:** Task 3
- **Issue:** Emptying the skip-list makes Gate B fail on `a2f/README.md:46`. Fixing that file is outside the write-lock and excluded by the coordination note. Editing the test to tolerate it would weaken the gate.
- **Fix:** Skip-list left at 8 so the suite stays green. Request A is raised. Plan status is PARTIAL.

**2. [Lock] TODO, STATE, REQUIREMENTS and a2f/README not edited**
- **Found during:** Task 2
- **Issue:** The plan's Files section and acceptance grep include these; the orchestrator's lock excludes them (STATE and REQUIREMENTS explicitly, a2f/ by coordination; TODO is not in files_modified).
- **Fix:** Not edited. Requests B and C raised. Their remaining hits are plain-text or backtick references, not Gate B links.

**3. [Conditional step applied] README**
- **Found during:** Task 2
- **Issue:** The plan makes the README step conditional on phase 13 not having landed. Phase 13 has plans and context but no SUMMARY, and README still carries the old names and Polish content.
- **Fix:** Filename-only substitutions applied; README content untouched (Phase 13 owns it).

**4. [Pre-existing] Duplicate "## 5." heading in a2f-local-setup kept**
- **Found during:** Task 1
- **Issue:** The source has two sections numbered 5 (Findings and Licenses). The translation keeps the source numbering rather than silently renumbering.
- **Fix:** None applied; flagged for the owner.

**5. [Interpretation] docs/4 and phase 16-07**
- Same as 12-03: no 16-07 sync exists in the file; translated from the on-disk text.

**6. [Test scope] tests/language.test.ts edits**
- The docs/all scope was flipped ON (a scope-flag line the coordination note allows). The skip-list and mechanics tests were not changed. Gate file: 8 tests (was 7).

## Not done (write-lock)

- `.planning/STATE.md`, `.planning/REQUIREMENTS.md`: not touched (orchestrator instruction).
- `.planning/PROJECT.md`: listed in files_modified, but it has no old-name hits, so no change.
- `.planning/WINDOWS.md`: no entries appended. Open items: the skip-list (8, TODO(12-04)) and requests A-C.
- 12-05 / 12-06 / src / style.css / index.html / vite.config.ts / a2f/: not touched.

## Known Stubs

None. The skip-list is a documented temporary tolerance (TODO(12-04)), not a stub.

## Self-Check: PASSED (with the partial status above)

- Files exist: the four translated docs, README, ROADMAP and the prompt file (checked by grep and `git diff --stat`).
- Commits `6d05c75`, `e61e66f`, `427ffc2` present; `git rev-list --count 7fb5e92..HEAD` = 3 before this SUMMARY commit.
- `npm run build` exit 0; `npx vitest run --dir tests` 51 files / 283 tests passed.
