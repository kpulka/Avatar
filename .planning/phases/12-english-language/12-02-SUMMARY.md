---
phase: 12-english-language
plan: 02
subsystem: i18n
status: complete
tags: [i18n, docs, translation, glossary, language-gate, link-integrity]
requires:
  - phase: 12-english-language
    plan: 01
    provides: canonical English docs/ filenames, glossary, tests/language.test.ts gate
provides:
  - English translation of the three core docs (0-roadmap, 1-architecture, 2-elevenlabs), structure preserved
  - Gate A scope docs/core enforced (zero diacritics in the three files)
affects: [12-03, 12-04, 12-05, 12-06, 12-07]
key-files:
  modified:
    - docs/0-roadmap-poc-mvp.md
    - docs/1-architecture-and-3d-models.md
    - docs/2-elevenlabs-wss-integration.md
    - tests/language.test.ts
decisions:
  - "docs/renamed stays OFF; a narrower docs/core scope (three files) is enforced instead. Turning docs/renamed ON would fail on the six remaining Polish docs."
  - "No allowlist entries were added for docs. Polish nasal vowels are written as a-ogonek / e-ogonek so Gate A stays green without loosening it."
metrics:
  tasks: 5
  commits: 2
  plan_head_before: 25044ec0aa065bebc27bb56318ec6fec6af4b8cc
  plan_head_after: e4ea1ece04ad2742071699fc1bac23ec38358d9e
actuals:
  tokens: 6200
  tasks: 5
  commits: 2
commits: 2
plan_head_before: 25044ec0aa065bebc27bb56318ec6fec6af4b8cc
plan_head_after: e4ea1ece04ad2742071699fc1bac23ec38358d9e
---

# Phase 12 Plan 02: Docs translation, wave 1 (core: roadmap, architecture, EL integration) Summary

The three foundation docs (92 + 137 + 186 lines) are now in English. Section order, heading numbering, table rows, code fences and the ASCII pipeline diagram keep their original layout. Outbound links point at the post-rename filenames from 12-01, and Gate A enforces zero diacritics on the three files.

## Commits

| Commit | Message | Content |
|---|---|---|
| 3e5001b | docs(i18n): translate core set (0-roadmap, 1-architecture, 2-elevenlabs) to English | 3 docs translated, 176 lines changed each way |
| e4ea1ec | test(i18n): enforce Gate A on translated core docs (docs/core scope) | `tests/language.test.ts`: new `docs/core` scope, enforced |

## Task results

1. **Pre-flight (links).** Outbound relative links were listed for each file. Every target is now a canonical 12-01 name: `1-architecture-and-3d-models.md`, `2-elevenlabs-wss-integration.md`, `3-lip-sync-and-coarticulation.md`, `4-audio-and-barge-in.md`, `5-shaders-and-realism.md`, `6-opensource-analysis-and-future.md`. The section link `[docs/2, section "SDK vs raw WSS"]` uses the translated heading text.
2. **Translation.** Prose, headings, table headers and cells, code-block comments, and diagram labels are translated. Technical tokens stay verbatim: API/event/field names (`agent_response_correction`, `char_start_times_ms`, `morphTargetInfluences`), file paths, URLs, config keys, `jawOpen`/ARKit names, and the `docs/N` shorthand.
3. **Terminology.** Glossary terms are used throughout (for example `barge-in`, `viseme`, `coarticulation`, `morph targets`, `AV sync`, `phase`, `risk register`). The Polish originals are not kept in parentheses, because the docs have no allowlist entry for them (see deviation 2).
4. **Commit.** Translation commit `3e5001b`, gate-scope commit `e4ea1ec`.

## Gate numbers

| Gate | Command / check | Result |
|---|---|---|
| Build | `npm run build` | exit 0, built in 5.81s |
| Suite | `npx vitest run --dir tests` | 51 files passed, 282 tests passed (baseline 51 / 281; +1 from the new `docs/core` Gate A test) |
| Gate file alone | `npx vitest run tests/language.test.ts` | 7 passed (6 from 12-01 + 1 new `docs/core` scope) |
| Gate A enforced scopes | `docs/core` | 1 of 6 enforced (`docs/core` ON; `docs/renamed`, `docs/all`, `src`, `tests`, `root` OFF) |
| Gate A diacritics in the 3 files | count of PL diacritic chars | 0 / 0 / 0 |
| Gate B broken links | within gate | 0 |
| Gate B skip-list | `GATE_B_SKIP_LIST` | still 8 (must be emptied by 12-04; not touched in this plan) |
| Structure | heading lines, table lines, code fences | heading line positions identical vs HEAD pre-translation (6/8/13 headings); table lines 17/16/20 and fences 0/4/14, same as before |

## Deviations from Plan

**1. [Plan contradiction, resolved toward acceptance criteria] `docs/renamed` scope**
- **Found during:** Task 3 (gate wiring)
- **Issue:** The plan says to flip the `docs/renamed` scope ON "for these three files". That scope covers all eight renamed docs. Six of them (3, 4, 5, 6, a2f-local-setup, en-visemes) still contain Polish, so turning it ON would fail the suite.
- **Fix:** Left `docs/renamed` OFF and added a new `docs/core` scope with exactly the three translated files, `enforced: true`. The change only adds enforcement and loosens nothing. Later plans can flip `docs/renamed` once all eight files are translated.

**2. [Interpretation] Polish nasal vowels in the 0-roadmap**
- **Found during:** Task 2
- **Issue:** The glossary says to keep the PL original of nasal vowels (ą, ę) in parentheses. Gate A bans diacritics in `docs/core`, and the allowlist has no docs entries. Adding one would weaken the gate.
- **Fix:** Wrote them as `a-ogonek` and `e-ogonek` next to the digraph list. The meaning is kept and the gate stays strict.

**3. [Term decision, no glossary row] "Etap" and "Faza"**
- **Found during:** Task 2
- **Issue:** The glossary has no row for "etap" (stage). It has "faza" → phase. Its file is outside this plan's write-lock, so I did not edit it.
- **Fix:** "Etap N" is rendered as "Stage N"; "Faza N" as "Phase N". This is a candidate glossary row for a later plan.

**4. [Convention] Decimal comma**
- **Found during:** Task 2
- **Issue:** The 0-roadmap uses a decimal comma (`1,5 s`).
- **Fix:** Written as `1.5 s`. The value is unchanged; the number format follows English convention.

**5. [Plan-allowed] Gate file touched**
- `tests/language.test.ts` was edited only to add the `docs/core` scope, as the plan allows when a scope is flipped ON. No existing test or allowlist entry was changed, and the suite count rose from 281 to 282 because of the new scope test.

## Not done (write-lock)

- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` were not touched. The ROADMAP progress row and the I18N-02 partial check-off (3 of 10 files) are left to the orchestrator.
- No entries were appended to `.planning/WINDOWS.md`. Open items for the ledger: the Gate B skip-list (8 entries, TODO(12-04)) and the Gate A scopes still OFF.
- `docs/3`, `docs/4`, `docs/5`, `docs/6`, `docs/a2f-local-setup.md`, `docs/en-visemes.md` and `docs/7` are not translated (other plans).

## Known Stubs

None.

## Self-Check: PASSED

- Files exist: the three translated docs and `tests/language.test.ts` (checked by the gate run and `git diff --numstat`).
- Commits `3e5001b` and `e4ea1ec` present; `git rev-list --count 25044ec..HEAD` = 2 before this SUMMARY commit.
- `npm run build` exit 0; `npx vitest run --dir tests` 51 files / 282 tests passed.
