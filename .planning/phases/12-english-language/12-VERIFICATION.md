---
phase: 12-english-language
type: verification
created: 2026-11-18
manual_uat: pending
---

# 12-VERIFICATION — English language (i18n)

> Execute for real; fill actual results. Human items stay PENDING — never confabulate.

## 1. Automated gates (final state — all scopes ON)

| Gate | Evidence | Result |
|---|---|---|
| Diacritics: docs/ (10/10) | `grep -rlP '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]' docs/` → only allowlisted phonetic-data files/lines (en-visemes §6 PL sentences, docs/3 PL tokens) | ☐ |
| Diacritics: src/ | grep → only §1.2 functional lines (viseme-mappings case labels, demo-frames Sets, emotion keywords, PL test phrase) | ☐ |
| Diacritics: tests/ | grep → only fixture data | ☐ |
| Diacritics: TODO + index.html (`lang="en"`) | grep → 0 | ☐ |
| Link integrity | `tests/language.test.ts` Gate B green, skip-list EMPTY | ☐ |
| Suite | `npm test` green (204+ tests) | ☐ |
| Build | `npm run build` green | ☐ |
| History preserved | `git log --follow docs/3-lip-sync-and-coarticulation.md` + `docs/en-visemes.md` reach pre-rename commits | ☐ |
| Phase archives intact | `git log --oneline -- .planning/phases/01-*` unchanged since phase start (no 12-xx commit touched them) | ☐ |

## 2. Per-requirement acceptance

| Req | Check | Result |
|---|---|---|
| I18N-01 | rename-only commit exists (`git show --stat` = 8 renames, 0 mods) | ☐ |
| I18N-02 | 10/10 docs English; heading-line diffs empty (structure preserved); en-visemes §6 inventory identical | ☐ |
| I18N-03 | Gate B green enforced scope; archives resolved via `.planning/README.md` rename map | ☐ |
| I18N-04 | manual UI pass (below) all-English; `lang="en"`; copy.test snapshots | ☐ |
| I18N-05 | devtools console during a session → English messages | ☐ |
| I18N-06 | comment-count spot-check ±20% on 5 files; functional data greps intact | ☐ |
| I18N-07 | suite green; describe/it spot-check English | ☐ |
| I18N-08 | `.planning/README.md` exists w/ phase map + rename map + language policy; TODO English | ☐ |

## 3. Manual UAT (human session — PENDING)

1. `npm run dev` → user layer fully English (dock, status, captions, settings incl. studio
   toggle, webgl card if forced).
2. `?studio=1` → all 6 panels English; A/B compare flow English; profile export/import
   toast English.
3. PL lip-sync still works: PL test sentence plays with correct digraphs/nasals
   (functional data unharmed — the point of the allowlist).

## 4. Cross-phase handoffs verified

- Phase 13: README ready for rewrite (links canonical; the gate's README exception is
  documented and waiting for 13).
- Phases 14–17: comment translation landed before refactors (or re-run 12-06 note);
  Phase 17 relocations → gate allowlist paths updated in ONE place.
- Phase 18: `tests/language.test.ts` is CI-ready; "English ✓" badge candidate.

## 5. Result

**Phase verdict:** ☐ PASS / PARTIAL / FAIL — filled at close with per-plan SUMMARY links.
