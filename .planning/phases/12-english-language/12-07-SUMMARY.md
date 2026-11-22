---
phase: 12-english-language
plan: 07
subsystem: i18n
status: complete
tags: [i18n, tests, todo, planning-index, language-gate, verification]
requires: [12-01, 12-02, 12-03, 12-04, 12-05, 12-06]
provides:
  - English test suite (describe/it titles and comments in tests/**)
  - TODO_humanInTheLoop.md translated in place (structure and checks intact)
  - English .planning/README.md (process, phase map 01-18, language policy, rename map)
  - Gate B skip-list emptied; Gate A scopes tests and root enforced
  - 12-VERIFICATION.md executed (automated PASS, manual UAT pending)
affects: [13, 14, 15, 16, 17, 18]
key-files:
  created:
    - .planning/README.md
  modified:
    - tests/** (37 files)
    - tests/language.test.ts
    - TODO_humanInTheLoop.md
    - .planning/phases/12-english-language/12-VERIFICATION.md
decisions:
  - "Gate B skip-list is kept as an empty constant (not deleted) with a mechanics test expecting []; any future entry is a regression."
  - "Gate A tests scope needs no allowlist entry: no test asserts on Polish text; the two Polish regex literals in copy.test.ts are \\uXXXX escapes."
  - "Gate A root scope covers TODO_humanInTheLoop.md and index.html; README.md is an explicit, documented exception until Phase 13 rewrites it."
  - "Polish invalid-JSON fixtures ('{nie json', 'to nie json') were translated to English equivalents ('{not json', 'this is not json'); both remain invalid JSON."
metrics:
  tasks: 6
  commits: 6
  plan_head_before: 666d2890ac2864429d2a63854148e6a56b930823
  plan_head_after: a128aac1fb0d73531c7b2439598bcbcc161e4f37
commits: 6
plan_head_before: 666d2890ac2864429d2a63854148e6a56b930823
plan_head_after: a128aac1fb0d73531c7b2439598bcbcc161e4f37
---

# Phase 12 Plan 07: Test suite EN, TODO translation, .planning index, final gate Summary

Closed the phase's automated work: the test suite is English, the owner's TODO is English, the
English planning index exists, the Gate B skip-list is empty, the `tests` and `root` Gate A scopes
are enforced, and the verification checklist was executed. Manual UAT remains with the owner.

## Commits

| Commit | Message | Content |
|---|---|---|
| 58502e8 | test(i18n): empty Gate B skip-list after link repair (12-04/12-06) | `tests/language.test.ts`: skip-list `[]`, mechanics test expects `[]` |
| e4dcbbb | docs(i18n): translate TODO_humanInTheLoop.md to English (in place) | TODO translated; checkbox structure kept; canonical filenames (CCR B) |
| 2c8e764 | test(i18n): English suite descriptions and comments | 37 test files, 280 changed lines |
| f914b73 | test(i18n): enable Gate A on tests/ and root scopes | `tests` and `root` scopes `enforced: true`, README exception documented |
| 3236f8a | docs(i18n): English .planning index (process, phase map, language policy, rename map) | `.planning/README.md` (new) |
| a128aac | docs(i18n): record 12-VERIFICATION results (automated PASS, manual UAT pending) | `12-VERIFICATION.md` executed |

## Task results

1. **Tests EN.** Every Polish `describe`/`it` title and comment in `tests/**` was translated with
   exact-substring replacements; each pair was required to match exactly once. A second and third
   pass caught ASCII-only Polish (no diacritics), which the diacritic gate cannot see. Fixture data
   that is functional was not touched (the suite has no Polish phonetic fixtures; see deviations).
2. **TODO_humanInTheLoop.md.** Translated in place (D4). Checkboxes, item meaning, the "How to
   verify" checks and the command blocks are unchanged. References are canonical:
   `docs/a2f-local-setup.md` (the former lines 75, 76) and `docs/en-visemes.md` (§6, the former line 100). Gate A `root` is green.
3. **.planning/README.md.** New English index: artifact types, phase map 01-18 with 11.1 and 11.2
   (statuses from the ROADMAP progress table), the language policy (phases 01-11 kept as a Polish
   record, English from phase 12, D2 rationale), and the eight-entry docs rename map as plain text
   (not links, so Gate B does not treat old names as broken links). Gate B covers the file; all its
   relative links resolve.
4. **Gate scopes.** `tests` and `root` flipped ON. `root` = `TODO_humanInTheLoop.md` + `index.html`;
   `README.md` excluded with a comment that Phase 13 must add it back. Skip-list emptied.
5. **12-VERIFICATION.md executed.** Every automated row has a recorded result; human rows are PENDING.
   Phase verdict is PARTIAL (automated PASS; manual UAT pending).

## Gate numbers

| Gate | Command / check | Result |
|---|---|---|
| Build | `npm run build` (`tsc && vite build`) | exit 0 |
| Suite | `npx vitest run --dir tests` and `npm test` | 52 files / 293 tests passed (baseline 52 / 291; +2 from the two newly enforced Gate A scopes) |
| Gate file alone | `npx vitest run tests/language.test.ts tests/copy.test.ts` | 18 passed |
| Gate A enforced scopes | `docs/core`, `docs/all`, `src`, `tests`, `root` | 5 of 6 enforced (`docs/renamed` OFF, superseded by `docs/all`); all green |
| Gate B broken links | within gate | 0 unresolved; skip-list 0 |
| Diacritics | Unicode-aware search over `tests/`, `TODO_humanInTheLoop.md`, `index.html` | 0 |
| Comment lines | five src files, before (ff17385) vs now | 116/116, 29/29, 42/42, 25/25, 37/37 |

## Deviations from Plan

**1. [Rule 1 - Bug, self-introduced] Apostrophes in translated titles**
- **Found during:** full suite run after the translation pass
- **Issue:** two translated titles contained an apostrophe inside single-quoted `it('...')` strings
  (`frame's`, `word's`), causing esbuild transform errors in `animation-frames.test.ts` and
  `phoneme-merge.test.ts`.
- **Fix:** rewritten as `frame value` and `word time boundaries`. Suite re-run green.

**2. [Rule 1 - Bug, self-introduced] Polish regex literals in copy.test.ts not escaped**
- **Found during:** diacritic re-scan after the translation pass
- **Issue:** the spec entry for the two Polish literals (`PL_DIACRITICS` regex and the `Dzień dobry!`
  match) did not change the file, because its NEW side still carried the literal characters.
- **Fix:** converted those two lines to `\uXXXX` escapes programmatically; the file is now ASCII-only.

**3. [Fixture text] Invalid-JSON inputs translated**
- **Found during:** second and third translation passes
- **Issue:** `okResponse('{nie json')` (a2f-backend), `parseA2fJson('{nie json')` (a2f-parser) and
  `importProfile('to nie json')` (settings-store) are Polish words inside invalid-JSON inputs.
- **Fix:** `{not json` and `this is not json`. Both are still invalid JSON, so the expected
  `A2F: invalid JSON` assertions and `ok: false` results are unchanged. These are not the functional
  phonetic tokens 12-CONTEXT §1.2 protects, so no allowlist entry was added.

**4. [Interpretation] Gate B skip-list kept as a constant**
- The plan says "empty"; the mechanism is kept (`GATE_B_SKIP_LIST = []`) and its mechanics test now
  expects `[]`, so any future tolerance is a visible, reviewed change.

**5. [Interpretation] `docs/renamed` Gate A scope left OFF**
- Its comment is stale (all eight renamed docs are now translated). Its files are fully covered by
  the `docs/all` scope, which is ON, so no check is lost. Not changed in this plan; the owner may
  flip or remove it.

**6. [Cross-epic CCR A and B] Completed**
- CCR A part 2: the eight `TODO(12-04)` entries were removed; no further `a2f/README.md` change was needed
  (fixed by 12-06). Gate B green.
- CCR B: `TODO_humanInTheLoop.md` lines 75, 76 and 100 now reference `docs/a2f-local-setup.md` and
  `docs/en-visemes.md` (done as part of the full translation).

**7. [Human-only] Manual UAT not performed**
- 12-VERIFICATION §3 (four items: UI pass, `?studio=1` panels, PL lip-sync audibility, devtools
  console) is PENDING. The executor cannot perform these. Phase verdict: PARTIAL.

## Owner review items

- The two Polish minimal-pair words in `phoneme-visemes.test.ts` (v1.3 cases) were rendered as
  "twins" and "little detail". Check the wording.
- `TODO_humanInTheLoop.md` contains emojis (status markers) inherited from the original; kept as-is.

## Known Stubs

None. The README exception in the `root` gate is an intentional, documented scope boundary, not a stub.

## Self-Check: PASSED

- `.planning/README.md` exists; `tests/language.test.ts` shows skip-list `[]` and `tests`/`root` enforced.
- Commits 58502e8, e4dcbbb, 2c8e764, f914b73, 3236f8a and a128aac present on the worktree branch (`git rev-list --count 666d289..HEAD` = 6 before this SUMMARY commit).
- `npm run build` exit 0; `npm test` 52 files / 293 tests passed.
- Working tree clean for plan files apart from this SUMMARY.
