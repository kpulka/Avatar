---
phase: 12-english-language
type: verification
created: 2026-11-18
updated: 2026-11-22
manual_uat: pending
automated_verdict: pass
---

# 12-VERIFICATION — English language (i18n)

> Executed for real on 2026-11-22 (plan 12-07). Automated checks were run and their results
> recorded below. Human items stay PENDING — they were not performed by the executor.

## 1. Automated gates (final state — all scopes ON except the documented README exception)

| Gate | Evidence | Result |
|---|---|---|
| Diacritics: docs/ (10/10) | Gate A `docs/all` green; zero diacritic lines in `docs/`. No docs allowlist entries exist (none needed). | PASS |
| Diacritics: src/ | Gate A `src` green; only the eight functional allowlist entries (12-CONTEXT §1.2 classes + the two 12-06 additions) match. Every allowlist entry matches a real line (stale-entry test green). | PASS |
| Diacritics: tests/ | Gate A `tests` green (scope ON in 12-07); zero diacritic characters in `tests/**`. No allowlist entry used: no test asserts on Polish text, and the two Polish regex literals in `copy.test.ts` are `\uXXXX` escapes. | PASS |
| Diacritics: TODO + index.html (`lang="en"`) | Gate A `root` green over `TODO_humanInTheLoop.md` and `index.html`; `index.html` line 2 is `<html lang="en">`. | PASS |
| Root exception: README.md | Deliberately excluded from `root` (Phase 13 owns the rewrite). Exception documented in `tests/language.test.ts`. | DOCUMENTED EXCEPTION |
| Link integrity | Gate B green over the enforced file set; `GATE_B_SKIP_LIST` is EMPTY (mechanics test expects `[]`). | PASS |
| Suite | `npm test` (= `vitest run`): 52 files / 293 tests passed (baseline for this plan 52 / 291; +2 from the `tests` and `root` Gate A scopes). | PASS |
| Build | `npm run build` (`tsc && vite build`): exit 0. | PASS |
| History preserved | `git log --follow docs/3-lip-sync-and-coarticulation.md` reaches `cbd66cd` (pre-rename); `git log --follow docs/en-visemes.md` reaches `77cc306`. | PASS |
| Phase archives intact | `git diff --name-only ff17385 HEAD -- .planning/phases` lists zero paths outside `12-*` (32 commits since phase start, none touched phases 01–11 or other phases). | PASS |

## 2. Per-requirement acceptance

| Req | Check | Result |
|---|---|---|
| I18N-01 | Rename-only commit `2bbd063`: `git show --stat -M` reports 8 renames, 0 insertions, 0 deletions. | PASS |
| I18N-02 | 10/10 docs English (Gate A `docs/all`); heading order and numbering, tables and the `en-visemes` §6 control-sentence inventory were verified in the 12-02, 12-03 and 12-04 summaries. | PASS (automated; structure per earlier SUMMARY records) |
| I18N-03 | Gate B green with an empty skip-list; the archives' old filenames resolve through the rename map in `.planning/README.md`. | PASS |
| I18N-04 | `tests/copy.test.ts` (7 tests) green; `index.html` `lang="en"`. Manual UI pass (§3, item 1): see below. | AUTOMATED PASS; manual PENDING |
| I18N-05 | Console and `Error` strings translated in 12-06 (`src/**`, `a2f/` script); `copy.test.ts` checks no dangling slot ids. Live devtools console check (§3): not performed. | AUTOMATED PASS; manual PENDING |
| I18N-06 | Comment-line count per file (`^\s*(//|\*|/\*)`), before phase (`ff17385`) vs now: `face-controller.ts` 116/116, `speech-backend.ts` 29/29, `viseme-scheduler.ts` 42/42, `container.ts` 25/25, `calibration.ts` 37/37 (0% drift, within ±20%). Functional data intact: the allowlist stale-entry test passes. | PASS |
| I18N-07 | Suite green (293 tests). Describe/it titles translated in 37 files; targeted sweeps for remaining Polish (diacritic and ASCII-only vocabulary) return no open hits in `tests/**`. The ASCII sweep is heuristic, not exhaustive. | PASS |
| I18N-08 | `.planning/README.md` exists in English with the phase map 01–18 (plus 11.1, 11.2), the language policy and the rename map; `TODO_humanInTheLoop.md` translated in place; language gate runs in `npm test`; phases 01–11 archives untouched. | PASS |

## 3. Manual UAT (human session — PENDING, not performed by the executor)

1. `npm run dev` → user layer fully English (dock, status, captions, settings incl. studio
   toggle, webgl card if forced). — PENDING
2. `?studio=1` → all 6 panels English; A/B compare flow English; profile export/import
   toast English. — PENDING
3. PL lip-sync still works: PL test sentence plays with correct digraphs/nasals
   (functional data unharmed — the point of the allowlist). — PENDING
4. Devtools console during a session shows English messages only (I18N-05). — PENDING

## 4. Cross-phase handoffs verified

- Phase 13: README is not in the `root` scope and still holds Polish content (95 diacritic
  characters); the exception is documented in `tests/language.test.ts` and waits for Phase 13.
  Phase 13 must add `README.md` back to the `root` list when it lands.
- Phases 14–17: comment translation landed before the refactors (12-06).
- Phase 17: the allowlist paths for functional data (`viseme-mappings.ts`, `demo-frames.ts`,
  `emotion-layer.ts`, `animation-controller.ts`, `viseme-overrides.ts`) are declared once in
  `tests/language.test.ts`; a relocation changes that list only.
- Phase 18: `tests/language.test.ts` runs under `npm test` and is CI-ready.

## 5. Result

**Phase verdict:** ☐ PASS ☒ PARTIAL ☐ FAIL

- Automated gates: PASS (sections 1 and 2, all rows).
- Manual UAT (section 3): PENDING, so the phase cannot be closed as PASS yet.
- Open item for the owner: in `phoneme-visemes.test.ts` (v1.3 minimal pairs) the two Polish
  words for the minimal-pair cases were rendered as "twins" and "little detail"; confirm they read correctly.
- Per-plan SUMMARY links: `12-01-SUMMARY.md` … `12-07-SUMMARY.md` in this directory.
