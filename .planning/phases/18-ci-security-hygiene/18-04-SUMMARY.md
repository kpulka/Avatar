---
phase: 18-ci-security-hygiene
plan: 04
status: complete
type: execute
requirements: [QUAL-05]
commits: 2
plan_head_before: e99cbd1
plan_head_after: 801eaef
created: 2026-11-24
human_pending:
  - "CI lint/format steps: first GitHub run unobserved (DEFERRED-HUMAN, see 18-03-SUMMARY)"
---

# Phase 18 Plan 04: ESLint + Prettier, layering rule from one source

**`npm run lint` (zero warnings) and `npm run format:check` are green on src and tests; the import-layer rule in ESLint and the CI gate `tests/layering.test.ts` share both the data (`tests/layering-rules.ts`) and the decision code (`tests/layering-check.ts`).**

## Commits

| Commit | Label | Content |
|---|---|---|
| 36c65e2 | `chore(lint): ESLint + Prettier config; fix violations` | `eslint.config.ts`, `.prettierrc.json`, `tests/layering-check.ts`, scripts, devDeps, rule violations fixed |
| 801eaef | `style: prettier one-shot format` | formatting of `src/**/*.ts`, `tests/**/*.ts`, 2 config files; CI lint + format steps |

Gate before and after the format commit: typecheck exit 0, lint exit 0, 75 files / 705 tests, build OK. The format sweep did expose three text-sensitive consumers, all fixed without touching tests: Prettier unquoting `'toast'` in `AppEvents` broke the ARCHITECTURE.md event-catalog test (fixed with `quoteProps: preserve`); Prettier on `src/style.css` broke `responsive-layout.test.ts` (CSS, JSON dictionary and JSON fixtures are now out of the format scope); one `eslint-disable` moved after reflow in `tests/speech-backend.test.ts`.

## Single source for the layering rule (acceptance)

- Data: `tests/layering-rules.ts` (unchanged).
- Decision: `layerOf` / `violationOf` / `findViolations` moved out of `tests/layering.test.ts` into `tests/layering-check.ts` (pure, no vitest, no fs). `tests/layering.test.ts` imports them (assertions unchanged); `eslint.config.ts` imports `violationOf` and wraps it in a local rule `layering/import-layers` (static imports, re-exports, dynamic `import()`).
- Negative check, run once: a probe file `src/core/neg-probe.ts` importing `../ui/shared/dom` produced `core/neg-probe.ts (core) -> ui/shared/dom.ts (ui): layer may not import layer` from ESLint; probe removed. The real tree has 0 layering violations.
- The flat config is `eslint.config.ts` (loaded through the `jiti` devDependency) so it can import the `.ts` data directly; this avoided extracting a JSON copy.

## Violation classes found (a free architecture audit) and dispositions

| Class | Count (initial) | Disposition |
|---|---|---|
| `no-unnecessary-type-assertion` | 45 + 7 tests | removed (autofix + a scripted strip for `el(...) as HTMLXElement`); typecheck proves no type change |
| `no-unsafe-*` (`any` leaks) | ~22 src, ~14 tests | src: `Object.create(null)` typed once in `nullProtoRecord<T>()` (settings-schema), `postMessage` data in embed-bridge now `unknown` + narrowed, scene-controller `userData` eyes typed, raw-wss `event.data as string`. Tests: targeted, reasoned `eslint-disable-next-line` on untyped mocks |
| `no-useless-assignment` | 6 | declarations changed to `let x: number;` / loop-local `const` (settings-store, compare-controller, demo-frames, face-controller, procedural-blink, studio-shell) |
| `require-await` | 3 src, 35 tests | src: 3 targeted disables (Promise-returning contracts, keeps throw as rejection). Tests: rule off for `tests/**` only (async mocks) |
| `no-misused-promises` | 3 | targeted disables on async DOM handlers |
| `no-console` | 64 | `warn`/`error` allowed by config (45); 19 `console.log` trace lines each carry a reasoned disable; `--max-warnings 0` makes a new one fail |
| misc | 8 | `preserve-caught-error` (cause added to a2f-parser), `no-base-to-string` (disable with reason), redundant union in `telemetry.recordAlignmentChunk` -> `string`, regex escapes in 3 tests, `no-explicit-any` in speech-backend test -> `unknown[]` |

Observations: no `any` survived in `src/` beyond the DOM/JSON boundaries above; no unused imports; no layering breaches.

## Deviations from Plan

- **Prettier style:** the plan's `printWidth 100, trailingComma all` would have touched 137 of ~170 files. Measured on the real tree: `printWidth 140, trailingComma es5` leaves 97 files to change, the closest match; adopted ("match reality, not aspiration"). Added `endOfLine: auto` (the working tree is CRLF on Windows via autocrlf; repo content is LF) and `quoteProps: preserve` (see above).
- **No `eslint-plugin-import`:** a local rule using the shared decision function replaces `import/no-restricted-paths`, which cannot express per-module `importableBy` and `EXCEPTIONS`. Added `@eslint/js`, `typescript-eslint`, `eslint` 10, `jiti`, `prettier` as devDependencies.
- **Format scope:** `.ts` only (CSS, JSON, markdown excluded), so `prettier --write .` from the plan was narrowed.
- **Sweep size:** 98 files, 1463 insertions / 913 deletions (below the ~300-file split threshold).
- ESLint 10 needs Node 20.19+ or 22.13+; CONTRIBUTING still says "Node 20+". CI uses Node 22.

## Known limits

- The lint step in CI has not run on GitHub (DEFERRED-HUMAN).
- The ESLint layering rule checks edges; cycles and top-level side effects remain gated by the vitest gate only.

## Self-Check: PASSED

Commits 36c65e2 and 801eaef exist on the branch; `npm run lint`, `npm run format:check`, typecheck, tests and build re-run green after the last commit.
