---
phase: 12-english-language
plan: 03
subsystem: i18n
status: complete
tags: [i18n, docs, translation, lip-sync, glossary, language-gate]
requires:
  - phase: 12-english-language
    plan: 02
    provides: canonical EN filenames, core docs translated, docs/core Gate A scope
provides:
  - English translation of the lip-sync trio (3-lip-sync-and-coarticulation, 4-audio-and-barge-in, en-visemes)
  - Gate A scope docs/core extended to 6 translated docs
affects: [12-04, 12-05, 12-06, 12-07]
key-files:
  modified:
    - docs/3-lip-sync-and-coarticulation.md
    - docs/4-audio-and-barge-in.md
    - docs/en-visemes.md
    - tests/language.test.ts
commits: 2
plan_head_before: 9862e8eb64255d9ea9de4dd2159cfc61aff0e9a8
plan_head_after: c432e692f78a56b2732f8b38e370d64bab1d2c57
metrics:
  tasks: 5
  commits: 2
---

# Phase 12 Plan 03: Docs translation, wave 2 (lip-sync trio) Summary

The three dense lip-sync documents (273 + 193 + 347 lines) are now in English. Heading order and numbering, every table (including the 29-row parameter sheet in en-visemes §4), every code block's executable lines, and the §6 control-sentence inventory are preserved. Gate A now enforces zero diacritics on six translated docs.

## Commits

| Commit | Message | Content |
|---|---|---|
| e146ec9 | docs(i18n): translate lip-sync canon (3-lip-sync, 4-audio, en-visemes) to English | 3 docs translated, links to canonical names |
| c432e69 | test(i18n): enforce Gate A on the lip-sync docs (docs/core scope, 6 files) | `tests/language.test.ts`: docs/core file list extended |

## Task results

1. **Pre-flight.** Outbound links listed per file. Old-name links found: docs/3 (to docs/6 and docs/4), docs/4 (to docs/2, docs/3, docs/6), en-visemes none. All rewritten to canonical 12-01 names. The `docs/EN-visemes.md` and `docs/3`/`docs/4` backtick references in prose were updated to the lowercase canonical filename.
2. **Tables.** docs/3 char→viseme and digraph tables, and the en-visemes §1 index, §2–§3 descriptions, §4 parameter sheet, §5 comparison tables and §8 change log: headers and prose translated, phonetic tokens, shape names, numeric values and column order untouched. The §4 parameter sheet (29 rows) matches HEAD line for line (only its header label changed from `Wizem` to `Viseme`).
3. **§6 control sentences.** The seven sentences are unchanged in content and order. Only the Polish opening quote marks were normalized to ASCII quotes, and two bullet labels were translated (`Wargi` → `Lips`, `Dyftongi` → `Diphthongs`). Verified with a diff against HEAD over the §6 bullets.
4. **docs/4 and 16-07.** No phase 16-07 sync exists in docs/4 (file last changed at the rename commit 2bbd063), so the on-disk text was translated. 16-07 will append its sync in EN directly (noted in the commit body).
5. **Commits.** Translation `e146ec9`, gate scope `c432e69`.

## Gate numbers

| Gate | Command / check | Result |
|---|---|---|
| Build | `npm run build` | exit 0, built in 7.79s |
| Suite | `npx vitest run --dir tests` | 51 files passed, 282 tests passed (baseline 51 / 282, unchanged count) |
| Gate file alone | `npx vitest run tests/language.test.ts` | 7 passed |
| Gate A enforced scopes | `docs/core` | 6 files (0-roadmap, 1-architecture, 2-elevenlabs, 3-lip-sync, 4-audio, en-visemes); `docs/renamed`, `docs/all`, `src`, `tests`, `root` still OFF |
| Gate A diacritics in the 3 new files | count of PL diacritic lines | 0 / 0 / 0 |
| Gate B broken links | within gate | 0 |
| Gate B skip-list | `GATE_B_SKIP_LIST` | still 8 (emptied by 12-04, not touched here) |
| Code integrity | JS/TS blocks in docs/3 and docs/4, comments stripped | identical to HEAD (only diagram prose and comments differ) |

## Deviations from Plan

**1. [Constraint] No Polish letters in docs; allowlist not extended**
- **Found during:** Task 2
- **Issue:** Gate A has no docs entries in the functional allowlist and the orchestrator forbids allowlist edits, so Polish phonetic data (`ą`, `ę`, `ś`, `ź`, `ż`, `dź`, `dż`) cannot appear literally in the docs.
- **Fix:** Written as ASCII names, the same convention as 12-02 (`a-ogonek`, `e-ogonek`, `s-acute`, `z-acute`, `z-dot`, `dz-acute`, `dz-dot`). docs/3 carries a short legend under its title so the names are decodable.

**2. [Layout] Legend block shifts heading line numbers in docs/3**
- **Found during:** Task 1
- **Issue:** The plan's "heading-line diff empty" check cannot hold literally because heading text is translated, and the legend adds 4 lines at the top of docs/3.
- **Fix:** Heading count, order and numbering are verified unchanged (`#`/`##`/`###` sequence identical). Heading text differs by translation only.

**3. [Test scope] tests/language.test.ts edited outside files_modified**
- **Found during:** Task 4
- **Issue:** The plan's files_modified lists only the three docs, but its acceptance criterion requires Gate A to cover six docs.
- **Fix:** Edited only the docs/core file list and its comment, as the orchestrator's coordination note allows for scope-flag lines. No allowlist entry, skip-list entry or assertion changed.

**4. [Minor] Document title label**
- **Issue:** The en-visemes title `EN-visemes` contained the old filename stem.
- **Fix:** Retitled `EN visemes — English visemes (working document)`.

**5. [Interpretation] §6 "diff against pre-translation copy"**
- **Issue:** The plan asks for an empty §6 diff, which cannot hold for a translated section.
- **Fix:** Verified the seven sentences are identical in content and order; the diff shows only quote normalization and two label translations.

## Not done (write-lock)

- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` not touched.
- No entries appended to `.planning/WINDOWS.md`. Open items for the ledger: Gate B skip-list (8, TODO(12-04)); Gate A scopes `docs/renamed`/`docs/all` still OFF; docs/4 will receive 16-07's EN sync.

## Known Stubs

None.

## Self-Check: PASSED

- Files exist: `docs/3-lip-sync-and-coarticulation.md`, `docs/4-audio-and-barge-in.md`, `docs/en-visemes.md`, `tests/language.test.ts` (checked via gate run and `git status`).
- Commits `e146ec9` and `c432e69` present; `git rev-list --count 9862e8e..HEAD` = 2 before this SUMMARY commit.
- `npm run build` exit 0; `npx vitest run --dir tests` 51 files / 282 tests passed.
