---
phase: 12-english-language
plan: 06
subsystem: i18n
status: complete
tags: [i18n, comments, console-messages, english, language-gate]
requires: [12-01, 12-05]
provides:
  - English comments, console/Error messages across src/, vite.config.ts, a2f/README.md, a2f setup script
  - Gate A (diacritics) enforced for the src scope in tests/language.test.ts
key-files:
  modified: [src/**, vite.config.ts, a2f/README.md, a2f/scripts/setup-tensorrt-from-pip.ps1, tests/language.test.ts, tests/a2f-parser.test.ts, tests/a2f-backend.test.ts, tests/mic-capture-device.test.ts, tests/shape-normalizer.test.ts]
requirements: [I18N-05]
commits: 5
plan_head_before: 2b953bf59959791ef85543d0ecac90f6bbf94640
plan_head_after: b63682a623fbf81b1af73818756d5c85cde14087
metrics:
  tests_before: "52 files / 289 tests"
  tests_after: "52 files / 290 tests"
---

# Phase 12 Plan 06: Comments and runtime messages to English Summary

All code comments, console messages and thrown error strings in `src/`, plus `vite.config.ts`, `a2f/README.md` and `a2f/scripts/setup-tensorrt-from-pip.ps1`, are now English. Functional Polish data (12-CONTEXT section 1.2) was deliberately left untouched and is covered by the Gate A allowlist, which is now enforced for `src`.

## Commits (one per family)

- `397c829` lipsync (+ `tests/a2f-parser.test.ts` assertions)
- `34e30d9` audio (+ `tests/a2f-backend.test.ts`, `tests/mic-capture-device.test.ts` assertions)
- `dd10270` app / features / ui / types / main.ts
- `b22077b` realism / avatar / scene / core / prod (+ `tests/shape-normalizer.test.ts` assertion)
- `b63682a` config / css / a2f + `tests/language.test.ts` (src scope ON, allowlist update)

## Gate

`npx tsc --noEmit` clean. `npm run build` OK (chunk sizes unchanged: index 175 kB, three 596 kB, dictionary 3.9 MB lazy). `npx vitest run --dir tests`: 52 files / 290 tests passed (baseline for this plan 289; +1 test is the new Gate A `src` scope). Comment-line counts per file (HEAD vs now) match exactly on 7 spot-checked files (face-controller, speech-backend, viseme-scheduler, container, head-micro-movements, materials, calibration). `a2f/sdk` and `a2f/.venv` untouched; no files deleted.

## Behaviour-neutral translation notes

Translation only. Runtime strings that tests asserted were updated in the tests (never weakened):

- `A2F: niepoprawny JSON` -> `A2F: invalid JSON`; `A2F: brak frames` -> `A2F: missing frames`; `A2F: anulowano` -> `A2F: cancelled` (a2f-parser / a2f-backend tests).
- Default mic device label `Mikrofon` -> `Microphone` (mic-capture-device test).
- Fail-fast message `Model nie posiada blendshape'ow:` -> `Model is missing blendshapes:` (shape-normalizer test; the source string had been translated in the family commit).
- Diagnostic strings in `speech-backend.ts` (`FALLBACK (no alignment from EL)`, `empty alignment`, `GAP ...ms`, `empty chunk`, `outside [0.9,1.1]`) and console logs translated; no test asserts them.

## Deviations from Plan

1. **[Rule 2 - Gate] `viseme-mappings.ts:320` allowlist entry confirmed.** The regex char class `/[A-Z...PL letters]/` on that line is functional; the entry stays, its `why` now says "confirmed in 12-06" (the Polish comment on that line became English).
2. **[Rule 2 - Gate] New allowlist entry for `src/lipsync/viseme-overrides.ts`.** Viseme-editor rows are keyed by PL letters (`{ key: '...', label: '...' }`, plus ASCII-key rows with PL letters in the label such as `A / <A-ogonek>`). The pattern accepts only uppercase PL letters inside a label with no lowercase diacritics, so Polish prose cannot hide behind it. Not listed in 12-CONTEXT 1.2 (the editor labels were English-translated in 12-05, the PL keys are data).
3. **DRIFT-A1 follow-ups done.** New Polish comments in `src/scene/materials.ts`, `src/lipsync/g2p/phoneme-visemes.ts` and `src/lipsync/viseme-scheduler.ts` were translated; file counts in the plan were stale (about 81 .ts files in `src/` at execution time).
4. **Mojibake fixed in `src/style.css`** (line 898, a corrupted Polish section heading) - replaced with `/* ===== Viseme editor ===== */`.
5. **Non-diacritic Polish found and translated.** Diacritic-only scans miss ASCII-folded Polish comments/messages (e.g. `Przerwanie`, `pusty chunk`, `Kontrolery`); a vocabulary-based scan over comments and string literals was used to catch them, so the scope exceeded the diacritic count.
6. **Test assertion updates** (listed above) touch four test files beyond `tests/language.test.ts`, as permitted for asserted runtime strings. `tests/language.test.ts` changed only the scope flag and allowlist lines (file stays ASCII-only).
7. **`a2f/README.md` links.** Pointers to `docs/A2F-LOCAL.md` now read `docs/a2f-local-setup.md` (the 12-01 rename target) so the Gate B link check resolves after the parallel 12-04 docs rename; `a2f/README.md` is Gate B in-scope.

## Known Stubs

None.

## Self-Check: PASSED

- Commits 397c829, 34e30d9, dd10270, b22077b, b63682a present on the worktree branch; `git rev-list --count 2b953bf..HEAD` = 5 at the time of measurement.
- `git status --short` clean before writing this SUMMARY.
