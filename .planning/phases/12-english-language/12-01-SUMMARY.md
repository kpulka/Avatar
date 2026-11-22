---
phase: 12-english-language
plan: 01
subsystem: i18n
status: complete
tags: [i18n, glossary, renames, language-gate, git-mv]
requires: []
provides:
  - Normative EN<->PL glossary (re-verified, articulation terms added)
  - Eight canonical English docs/ filenames (history preserved)
  - tests/language.test.ts gate: Gate A (diacritics, allowlist) and Gate B (link integrity)
affects: [12-02, 12-03, 12-04, 12-05, 12-06, 12-07]
key-files:
  created:
    - tests/language.test.ts
  modified:
    - .planning/phases/12-english-language/12-DRAFT-glossary.md
  renamed:
    - docs/1-architektura-i-modele-3d.md -> docs/1-architecture-and-3d-models.md
    - docs/2-integracja-elevenlabs-wss.md -> docs/2-elevenlabs-wss-integration.md
    - docs/3-lip-sync-i-koartykulacja.md -> docs/3-lip-sync-and-coarticulation.md
    - docs/4-audio-i-obsluga-przerwan.md -> docs/4-audio-and-barge-in.md
    - docs/5-shadery-i-realizm.md -> docs/5-shaders-and-realism.md
    - docs/6-analiza-opensource-i-rozwoj.md -> docs/6-opensource-analysis-and-future.md
    - docs/A2F-LOCAL.md -> docs/a2f-local-setup.md
    - docs/EN-visemes.md -> docs/en-visemes.md
decisions:
  - "Gate A scopes are a registry with an enforced flag; all five scopes are report-only in 12-01 (docs/renamed flips on in 12-02)."
  - "Gate B skip-list holds exactly the 8 pre-rename filenames with TODO(12-04); it must be emptied by 12-04."
  - "Functional allowlist is line-pattern based; every entry must match a real line (stale-entry test)."
metrics:
  tasks: 4
  commits: 2
  plan_head_before: ff17385d6f46dc1f764be7e0717b873df2305d7c
  plan_head_after: 2bbd063b490cd139d1e6447403e197294fa01331
---

# Phase 12 Plan 01: Glossary, canonical renames, language gate Summary

Normative glossary re-verified and extended, eight docs renamed with `git mv` in a rename-only commit, and the language gate skeleton (`tests/language.test.ts`) landed with Gate B live behind a temporary skip-list.

## Commits

| Commit | Message | Content |
|---|---|---|
| c715645 | test(i18n): language gate skeleton + glossary | gate file (6 tests), glossary |
| 2bbd063 | docs(i18n): canonical English filenames (git mv, history preserved) | 8 renames, 0 content changes |

## Task results

1. **Glossary finalized.** Every row checked against `docs/`, `src/` and `.planning/`. Articulation terms from `docs/3` and `docs/EN-visemes.md` that were missing were added: vowel/consonant, rounding, smile, mouth corners, mouth opening, pucker ("beak"), lip protrusion, lip tube, alveolar, velar, half-open, closed/narrow.
2. **Renames.** `git mv` of the 8 files, one commit. `git show --stat -M` reports 8 renames, 0 insertions, 0 deletions. `git log --follow` on `docs/3-lip-sync-and-coarticulation.md` reaches pre-rename history (cbd66cd, 77cc306).
3. **Gate file.** `tests/language.test.ts` is ASCII-only (every Polish code point written as a `\uXXXX` escape). It contains:
   - Gate A: diacritic scanner over five scopes (`docs/renamed`, `docs/all`, `src`, `tests`, `root`), all `enforced: false` in 12-01. Functional allowlist with six entries, one per 12-CONTEXT section 1.2 class plus one extra (see deviations).
   - Gate B: relative `.md` link resolver over `docs/`, `README.md`, `TODO_humanInTheLoop.md`, `a2f/README.md`, `.planning/*.md`, with the 8-name skip-list.
   - Mechanics tests: detector self-check, every allowlist entry matches a real line, resolver extracts only relative `.md` targets, skip-list equals the 8 old names, every scope enumerates files.
4. **Pre/post-rename sweep.** Gate B passed before the renames. After the renames it still passes, and the skip-list is exercised: 36 inbound links in `docs/` (7 files) and 14 in `README.md` target old names.

## Gate numbers

| Gate | Command | Result |
|---|---|---|
| Build | `npm run build` | exit 0, built in 6.93s |
| Suite | `npx vitest run --dir tests` | 51 files passed, 281 tests passed (baseline 50 / 275; +1 file, +6 tests from `language.test.ts`) |
| Gate file alone | `npx vitest run tests/language.test.ts` | 6 passed |
| Gate A enforced scopes | - | 0 of 5 (by plan design) |
| Gate B broken links | within gate | 0 (old-name links tolerated by skip-list) |
| Skip-list size | - | 8 (must be 0 when 12-04 lands) |

## Deviations from Plan

**1. [Plan contradiction - resolved toward acceptance criteria] `docs/renamed` Gate A scope**
- **Found during:** Task 3
- **Issue:** Task 3 says the `docs/renamed` scope is ON in 12-01; the acceptance criteria say it is NOT yet ON, because the renamed docs still contain Polish and the gate must pass on current code.
- **Fix:** Scope registered with `enforced: false`. It flips on in 12-02 when the translations land.

**2. [Interpretation] Glossary verification scope**
- **Found during:** Task 1
- **Issue:** Task 1 says to verify terms against `docs/` or `src/` and drop unused ones. The glossary header states `docs/`, `src/` and `.planning/`.
- **Fix:** Verified against all three, following the header. Several rows appear only in `.planning/` (for example kamień milowy, retrospekcja, warstwa studio, mesze mowy), so they were kept because later EN artifacts and UI work need them. No row was dropped.

**3. [Added allowlist entry - needs 12-06 review] `viseme-mappings.ts` functional regex class**
- **Found during:** Task 3
- **Issue:** `src/lipsync/viseme-mappings.ts` contains a functional uppercase character class with PL letters in a regex literal, which is not in 12-CONTEXT section 1.2.
- **Fix:** Added as an explicit allowlist entry marked "NOT listed in 1.2". The surrounding comment on that line is Polish and is a 12-06 translation target. Flagged for review.

**4. [Mechanism] Disabled scopes are registry flags, not vitest skips**
- Not-yet-enforced scopes are filtered from the `describe` list instead of using `skip`, so the run contains no skipped tests.

## Not done (write-lock)

- `.planning/STATE.md`, `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md` were not touched, as instructed. The ROADMAP progress row and requirement check-offs for I18N-01 and the I18N-08 gate plumbing are left to the orchestrator.
- No entries were appended to `.planning/WINDOWS.md` (outside the write-lock). Open items for the ledger: the Gate B skip-list (8 entries, TODO(12-04)) and the disabled Gate A scopes.

## Known Stubs

None. The Gate B skip-list is a documented temporary tolerance (TODO(12-04)), not a stub.

## Self-Check: PASSED

- `tests/language.test.ts` exists and passes (6/6).
- `12-DRAFT-glossary.md` carries the re-verification note and added rows.
- Commits `c715645` and `2bbd063` present; `git rev-list --count ff17385..HEAD` = 2.
