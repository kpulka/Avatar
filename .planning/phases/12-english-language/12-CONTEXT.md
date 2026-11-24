---
phase: "12"
name: "English language (i18n)"
created: "2026-11-17"
updated: "2026-11-18"
---

# Phase 12: English language (i18n) — Context

The repo is a **public portfolio project** (github.com/kpulka/Avatar) whose audience speaks
English, whose avatar speaks English, and whose #1 owner priority is: **the repository must read
as English**. Today everything user-facing is Polish. This phase is the umbrella
"English-ization": docs, UI strings, code comments, test descriptions, runtime messages, and the
human-in-the-loop TODO — everything except README *content* (Phase 13) and repo plumbing
(LICENSE/CI/badges — Phase 18).

Analysis is read-only; every count below was produced by grepping the working tree on
2026-11-17 (diacritic set: `ą ć ę ł ń ó ś ź ż Ą Ć Ę Ł Ń Ó Ś Ź Ż`).

---

## 1. Current-state inventory

### 1.1 docs/ — 10 files, all Polish, 1,686 lines, 2,099 diacritic chars

| File (current) | Lines | Diacritics | Rename target (canonical, fixed) |
|---|---:|---:|---|
| `0-roadmap-poc-mvp.md` | 92 | 173 | unchanged |
| `1-architektura-i-modele-3d.md` | 137 | 120 | `1-architecture-and-3d-models.md` |
| `2-integracja-elevenlabs-wss.md` | 186 | 141 | `2-elevenlabs-wss-integration.md` |
| `3-lip-sync-i-koartykulacja.md` | 273 | 373 | `3-lip-sync-and-coarticulation.md` |
| `4-audio-i-obsluga-przerwan.md` | 193 | 142 | `4-audio-and-barge-in.md` |
| `5-shadery-i-realizm.md` | 145 | 153 | `5-shaders-and-realism.md` |
| `6-analiza-opensource-i-rozwoj.md` | 91 | 142 | `6-opensource-analysis-and-future.md` |
| `7-audio2face-cloudrun.md` | 98 | 120 | unchanged |
| `A2F-LOCAL.md` | 124 | 57 | `a2f-local-setup.md` |
| `EN-visemes.md` | 347 | 678 | `en-visemes.md` |

The two biggest files (`EN-visemes.md`, `3-lip-sync…`) are dense technical working documents
(articulation tables, per-phoneme ARKit parameters) — they need careful translation, not a
machine dump. Polish **phonetic data inside them stays** (digraph letters `sz/cz/rz/dź/dż`,
nasal vowels `ą/ę`, control sentences like `szczypczyzna`); the prose around them translates.

### 1.2 src/ — 78 of 78 source files contain Polish, 2,273 diacritic chars

Top files by diacritic count (all verified by grep):

| File | Diacritics | Kind |
|---|---:|---|
| `src/lipsync/face-controller.ts` | 243 | comments + a few console strings |
| `src/lipsync/viseme-overrides.ts` | 132 | comments + **EDITOR label literals (UI)** |
| `src/lipsync/demo-frames.ts` | 107 | comments + **functional vowel Sets (data)** |
| `src/lipsync/g2p/g2p-en.ts` | 96 | comments |
| `src/lipsync/g2p/phoneme-visemes.ts` | 87 | comments |
| `src/lipsync/calibration.ts` | 79 | comments + console strings |
| `src/audio/speech-backend.ts` | 77 | comments + console strings |
| `src/lipsync/viseme-scheduler.ts` | 78 | comments |
| `src/lipsync/viseme-mappings.ts` | 64 | comments + **case labels (data)** |
| `src/ui/studio/panels/inspector-panel.ts` | 66 | **label literals (UI)** |
| `src/ui/studio/panels/animation-panel.ts` | 47 | comments + labels (UI) |
| `src/types/avatar.ts` | 41 | comments |
| `src/lipsync/a2f-parser.ts` | 40 | comments + **Error strings** |

**Critical classification — functional data that MUST NOT be translated** (verified by
reading the code, not guessing):

1. `src/lipsync/viseme-mappings.ts` — `case 'Ą':` / `'Ę'` / `'Ó'` / `'Ł'` / `'Ś'` / `'Ć'` /
   `'Ź'` / `'Ż'` / `'Ń'` (lines ~220–255) and two-char `case 'DŹ':` / `'DŻ':` (~line 71) plus the
   `DIGRAPHS` token array (line ~301). These are PL phoneme tokens the engine matches on.
2. `src/lipsync/demo-frames.ts` — `VOWELS`, `ROUNDED`, `SMILE_VOWELS`, `SIBILANT`,
   `VOICED_CONSONANTS` Sets built from `'aeiouyaeą'`, `'ouó'`, `'szczzs'`, `'mbnwlrgyjdzdźdzż'`
   style strings (lines ~19–27). Functional: drives synthetic demo frames.
3. `src/realism/emotion-layer.ts` — sentiment keywords `'dobrze'`, `'świetnie'` (lines 53–54).
   Functional: PL keyword detection (agent may reply in PL).
4. `src/features/animation-controller.ts` — `testPhrase('pl')` string
   `'Dzień dobry! Cieszę się, że mogę z Tobą dzisiaj porozmawiać.'` (line ~127). Functional:
   the PL calibration sentence the avatar *speaks*. Its label prefix `[Test kalibracji PL]`
   (line ~129) is UI and translates.

Everything else in src/ is comments, UI literals, console messages, or Error strings →
translate.

### 1.3 tests/ — 38 of 41 test files, 385 diacritics, 103 Polish describe/it lines

Per-file Polish `describe/it` counts (21 files affected):

`settings-store.test.ts` 14 · `animation-frames.test.ts` 12 · `a2f-parser.test.ts` 8 ·
`a2f-backend.test.ts` 7 · `g2p-en.test.ts` 7 · `events.test.ts` 5 · `mic-capture-device.test.ts`
5 · `scene-presets.test.ts` 5 · `compare-controller.test.ts` 6 · `viseme-overrides.test.ts` 6 ·
`viseme-scheduler.test.ts` 24 (mix of describe/it + comments) · `animation-router.test.ts` 3 ·
`phoneme-merge.test.ts` 3 · `phoneme-visemes.test.ts` 4 · `embed-bridge.test.ts` 4 ·
`ui-mode.test.ts` 4 · `procedural-blink.test.ts` 10 (mostly comments) · `energy-fallback.test.ts`
22 (mostly comments) · `alignment-rescale.test.ts` 2 · `container.test.ts` 2 ·
`panel-registry.test.ts` 2 · `helpers/memory-storage.ts` 2 (comments).

**Key safety finding (verified):** no test asserts on any Polish UI/message string
(grep over `toBe|toContain|toEqual|toMatch` lines containing diacritics: **0 matches**).
Translating UI strings and runtime messages does not break the 204-test suite. Assertions that
*do* exist target structural tokens (`ok: false`, `'char'`, `LEGACY_KEYS.lipSyncEngine`) which
stay untouched.

### 1.4 UI strings — full map lives in 12-05-PLAN §Appendix

User-visible Polish lives in: `src/ui/user/*` (conversation-dock, status-pill, captions,
algorithm-switcher, user-settings), `src/ui/studio/panels/*` (6 panels), `src/ui/studio/`
(panel-registry error card, studio-shell aria-labels), `src/ui/shared/` (loader defaults),
`src/features/` (toast emissions in conversation/animation/compare controllers), `src/app/`
(container presentation button + loader copy; settings-schema/settings-store Error strings),
`src/ui/webgl-fallback.ts`, and `index.html` (`lang="pl"`, WebGL fallback card). Roughly
**120 distinct user-visible strings + ~40 console/Error strings**, every one enumerated with an
exact EN replacement in 12-05-PLAN.

### 1.5 Root & config files

| File | Diacritics | Note |
|---|---:|---|
| `README.md` | 95 | Phase 13 owns content; 12-04 fixes only link targets |
| `TODO_humanInTheLoop.md` | 132 | Living owner checklist; translated in place (12-07) |
| `index.html` | 14 | `lang="pl"`, fallback card, one comment |
| `vite.config.ts` | 11 | comments |
| `src/style.css` | 5 | 2 comment lines |
| `package.json` | 0 | clean |

### 1.6 a2f/ (non-vendored only)

`a2f/README.md` 35 diacritics; `a2f/scripts/setup-tensorrt-from-pip.ps1` 2; other scripts/tools
0. `a2f/sdk/` is a cloned third-party NVIDIA SDK and `a2f/.venv/` is vendored Python deps —
**both out of scope forever** (never translate; excluded from the language gate by path).

### 1.7 .planning/ — 134 Polish files, ~7,100 diacritic chars

Split: **living docs** (`ROADMAP.md` 519, `REQUIREMENTS.md` 229, `STATE.md` 197, `PROJECT.md`
161, `prompts/review-a2f-unification.md` 185) vs **historical phase archives 01–11** (~5,800
chars across ~129 files). Policy decision in §4.

---

## 2. Cross-reference topology (what breaks when files are renamed)

Full-filename references to the 8 renamed docs, counted repo-wide (excluding
`.venv/node_modules/dist`):

| Old filename | Refs | Files containing it |
|---|---:|---|
| `1-architektura-i-modele-3d.md` | 20 | 9 (README, ROADMAP, phases 01/05, docs 0/5/6) |
| `2-integracja-elevenlabs-wss.md` | 18 | 13 (README, ROADMAP, phases 02/04/06/10, docs 0/4/6) |
| `3-lip-sync-i-koartykulacja.md` | 27 | 17 (README, ROADMAP, phases 03/05/07, docs 0/1/4/6) |
| `4-audio-i-obsluga-przerwan.md` | 27 | 18 (README, ROADMAP, phases 02/03/04/06/07/08, docs 0/2/3) |
| `5-shadery-i-realizm.md` | 18 | 12 (README, ROADMAP, phases 01/05/11, docs 0/1) |
| `6-analiza-opensource-i-rozwoj.md` | 13 | 8 (README, ROADMAP, phases 02/03, docs 0/2/3/4) |
| `A2F-LOCAL.md` | 15 | 8 (TODO, REQUIREMENTS, ROADMAP, STATE, phases 09, a2f/README, docs self) |
| `EN-visemes.md` | 18 | 12 (README, TODO, REQUIREMENTS, ROADMAP, STATE, phases 07/09, prompts, docs 3) |

**Scope-critical facts:**

- `src/**` references docs **only by numeric shorthand** (`docs/3`, `docs/5 Stage 2`,
  `docs/7 §5` — 43 occurrences, all comments). Shorthand survives renames → **no src repair
  needed**, only comment translation.
- Docs reference each other with relative links + `§N` section numbers (not markdown anchors),
  e.g. `[docs/2, sekcja "SDK vs surowy WSS"](2-integracja-elevenlabs-wss.md)`. **Keep section
  numbering stable during translation** and §-refs keep resolving.
- Phase archives 01–11 reference old filenames too — deliberately left untouched (§4); the
  rename map in the new `.planning/README.md` resolves them.
- `0-roadmap-poc-mvp.md` and `7-audio2face-cloudrun.md` keep their names → their inbound links
  never break.

---

## 3. Problems & risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R-1 | Translation drift of domain terms (e.g. *koartykulacja*, *nosówki*, *tuba*) across 10 docs + 78 source files | HIGH | `12-DRAFT-glossary.md` is **normative**; every translator task references it; reviewer greps translated output against glossary terms |
| R-2 | Broken links after renames (156 refs / ~40 files) | HIGH | 12-04 runs a mechanical, list-driven replacement over the exact files in §2; `tests/language.test.ts` adds a link-integrity check that runs in `npm test` forever |
| R-3 | Accidentally translating functional data (PL phoneme tokens, sentiment keywords, PL test phrase) | HIGH | Explicit allowlist in §1.2 + line-pattern exemptions inside the language gate; suite must stay green |
| R-4 | git history detached by renames (recruiters value history) | MEDIUM | `git mv` only (rename-only commit, 100% similarity detection); verify with `git log --follow` in 12-VERIFICATION |
| R-5 | `.planning` GSD tooling breaks when we touch living docs | LOW | Living-doc edits are filename-substring-only inside prose; no structural/frontmatter changes; STATE.md keys untouched |
| R-6 | Collisions with sibling phases (13 README, 14/15/16/17 refactors, 18 CI) | MEDIUM | Sequencing note in §6; 12-04's README step is conditional (filename-only, skipped if 13 landed); comment translation lands before big file moves |
| R-7 | Subtle typo existing in `panel-registry.ts` line 67 (`Panel ,${definition.title}"`) — mojibake-adjacent bug spotted during inventory | LOW | 12-05 fixes the string while translating it |
| R-8 | Case-insensitive filesystems (Windows) confusing `git mv` | LOW | No rename is case-only (`A2F-LOCAL.md`→`a2f-local-setup.md` changes the whole stem); do renames in one commit |

---

## 4. Scope decisions & rationale

**D1 — UI strings: straight English, no i18n layer.**
The avatar speaks EN, the audience is EN-recruiters, and the only PL "users" are the owner.
An i18n framework (key catalogs, runtime language switch) would add code churn in all 13 UI
files + a maintenance burden for a language with zero users. If PL UI is ever needed, extracting
the (then-English) literals into catalogs is purely additive — nothing about a one-time
translation blocks it. Cost: ~160 strings, one pass. Benefit: permanent, zero runtime cost.

**D2 — .planning 01–11 archives stay Polish; add English `.planning/README.md` index.**
Cost of translating 129 archive files (~5,800 diacritic chars): days of work, destroyed git
blame, and *semantic drift risk in normative requirement texts* (REQUIREMENTS IDs point at PL
prose; a sloppy re-translation silently changes what was built). Benefit: cosmetic.
The archives are an authentic record — "phases 1–11 were planned in Polish; from v1.1 (phase 12)
onward the project is English" is a *better* portfolio story than retro-rewritten history.
The new `.planning/README.md` (English) explains the GSD process, artifact types, the phase map,
the language policy, and carries the old→new doc **rename map** so every stale reference in an
archive resolves for a human reader.

**D3 — Living .planning docs (ROADMAP/STATE/PROJECT/REQUIREMENTS/prompts): path repair, no translation.**
These four + prompts file keep Polish prose (they are part of the same historical record and
are actively appended to by GSD; mixing is accepted and documented in the index) but their
**full doc filenames get mechanically updated** so links resolve. New artifacts (12+) are
English, so the living docs naturally converge to English over the milestone.

**D4 — `TODO_humanInTheLoop.md`: translate in place at repo root.**
It is the owner's *active* operational checklist (referenced by ROADMAP.md Phase 11 docs-refs
and STATE.md workflow), not a process archive. Moving it to `.planning/` would bury it from the
human it serves and break living-doc references. Filename stays (already English-ish).

**D5 — Language gate lives in `tests/language.test.ts` (vitest), not a standalone script.**
Runs with the existing `npm test` (no new tooling, no CI wiring needed until Phase 18 picks it
up). Two checks: (a) zero diacritics outside the functional allowlist, (b) all relative `.md`
links resolve in the enforced scope. The regex is written with `\uXXXX` escapes so the test
file itself is ASCII-clean. Enforcement scope tightens progressively: 12-01 enforces
renamed-docs + gate plumbing; 12-05/06/07 flip scopes on as each wave lands.

**D6 — a2f: only `README.md` + the 2 ps1 comments; `sdk/` and `.venv/` are vendored, never touched.**

---

## 5. Proposed requirements

- **I18N-01** — Canonical English filenames: the 8 renames from §1.1 executed via `git mv`
  (history preserved), rename-only commit, `git log --follow` reaches pre-rename history.
- **I18N-02** — All 10 docs/ files fully translated to English: prose, headings, tables,
  code-block comments; structure (section order/numbering, tables, ASCII diagrams) preserved;
  terminology per `12-DRAFT-glossary.md`; Polish phonetic *data* kept with English glosses.
- **I18N-03** — Link integrity: every doc-path reference in the enforced scope (docs/, README,
  TODO, a2f/README, .planning root + prompts) resolves; historical phase archives 01–11 are
  exempt by policy and resolved via the published rename map.
- **I18N-04** — User-facing UI strings English: all labels, buttons, captions, status pill,
  aria-labels, toasts, loader/modal copy, panel titles, option labels, error cards in
  `src/ui/**`, `src/features/**`, `src/app/**`, `index.html` (`lang="en"` included); exact
  string map per 12-05-PLAN appendix.
- **I18N-05** — Developer-facing runtime strings English: `console.log/warn/error` messages,
  `new Error(...)` messages, `validateSettings`/import error strings — keeping technical tokens
  (`__proto__`, `schemaVersion`, paths, IDs) intact so tests keep passing.
- **I18N-06** — Code comments English: every `//` and `/** */` comment in `src/**`,
  `src/style.css`, `vite.config.ts`, `index.html` comment, non-vendored `a2f/**`; functional
  data literals untouched.
- **I18N-07** — Test suite English: all `describe/it` titles and comments in `tests/**`
  translated; PL phonetic fixtures/tokens preserved; 204+ tests green.
- **I18N-08** — Language gate + process index: `tests/language.test.ts` (diacritics gate with
  functional allowlist + link check) enforced in `npm test`; English `.planning/README.md`
  (GSD process, artifact types, phase map, language policy, rename map); `TODO_humanInTheLoop.md`
  translated in place; `.planning` phases 01–11 kept as Polish historical archives.

---

## 6. Cross-area notes (for the orchestrator)

1. **Phase 13 (README)** — 12-04 performs *filename-only* updates to README's docs table and
   inline links (mechanical, content untouched). If 13 lands first, that step is skipped —
   it is flagged conditional in 12-04.
2. **Phases 14–17 (refactors)** — strongly recommend Phase 12 lands **before** them: comment
   translation (12-06) on pre-move files avoids conflict soup; if a refactor lands first,
   re-run 12-06 against the new paths. Phase 15 rewrites panels → 12-05 first keeps its diffs
   English-only. Phase 17 touches `viseme-mappings.ts`/`g2p/*` — if it *relocates* those files,
   the gate's allowlist paths must move with them (one-line change in `tests/language.test.ts`).
3. **Phase 18 (CI)** — `tests/language.test.ts` is designed to be picked up by 18's CI wiring
   and can back a "English ✓" badge; LICENSE/CONTRIBUTING from 18 are English natively.
4. **Pre-existing working-tree state** (left untouched per constraints): `.planning/config.json`
   modified, `.planning/config.json.bak-modeloverrides-…` untracked,
   `.planning/phases/16-animation-mechanics-refactor/16-CONTEXT.md` untracked (sibling phase 16
   already started by another agent).
5. **`a2f/sdk` + `a2f/.venv`** — vendored; excluded from every gate/rename/translation task.
   (Verify `.gitignore` covers `.venv` in Phase 18's hygiene pass.)
6. **`docs/EN-visemes.md` §6 control sentences** are referenced by Phase 9's UAT
   (09-VERIFICATION table) and `TODO` — translation must keep the sentence inventory and §
   numbering identical so those references stay meaningful.
