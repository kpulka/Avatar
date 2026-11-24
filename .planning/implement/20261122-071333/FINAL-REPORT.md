# FINAL REPORT — implement run 20261122-071333

Auditor: opus, read-only, 2026-11-24. Scope: `impl-baseline-20261122` (d08154c, 47 files / 245 tests) .. HEAD `b84f37e` on `implement/v1.1-refactor` (164 commits, 14 merge commits).

## Overall verdict: PASS at the automated level / PARTIAL overall

All automated gates are green, both in the working tree and in a **cold export of HEAD** (`git archive HEAD` → `npm ci` → `npm run verify`). No weakened tests found. Drift items were honored. The orchestrator's conflict resolutions lost no tests. Tracking is honest: it under-claims slightly in two places and does not over-claim. What remains is human-owned: visual and live UAT, recording and capture assets, the first CI run on GitHub, license wording, and hygiene decisions.

## 1. Gates measured by the auditor

| Gate | Working tree (HEAD b84f37e) | Cold export of HEAD (fresh `npm ci`, 202 packages) |
|---|---|---|
| `npm run typecheck` (tsc -p tsconfig.test.json, src+tests) | exit 0 | exit 0 |
| `npm test` (`vitest run --dir tests`) | **75 files / 706 tests passed** | 75 / 706 passed |
| `npm run build` | OK (1.62 s) | OK |
| `npm run lint` (`--max-warnings 0`) | 0 problems | 0 |
| `npm run format:check` | all files formatted | all files formatted |
| `npm run verify` | **EXIT 0** | **EXIT 0** |

Bundle (vite build):

| Chunk | Baseline | Now |
|---|---|---|
| main `index-*.js` | 3,923.77 kB / 961 kB gz (CMU dict inlined) | **197.19 kB / 60.21 kB gz** |
| `dict-en-pruned-*.js` (lazy) | (inlined in main) | 259.03 kB / 64.51 kB gz |
| `three-*.js` | (in main) | 594.04 kB / 151.79 kB gz |
| css | n/a | 27.85 kB / 5.38 kB gz |

Total JS is about 276.5 kB gzip, against about 1,162 kB at baseline. This matches the claim in RUN.md.

Noise: vitest workers print `Warning: --localstorage-file was provided without a valid path`. This comes from the local Node runtime, is harmless, and causes no failures.

## 2. Per-wave table

| Wave / track | Plans | Merge commit | Gate after merge (RUN.md) | Auditor check |
|---|---|---|---|---|
| A / lip11 | 11.2-07, 11.2-08 | 34a22e1 | 49 / 259 | SUMMARY 259 ✓ |
| A / render | 11.2-04, 05, 06 | ff17385 | 50 / 275 | plausible |
| B | 12-01 | a8c8dc1 | 51 / 281 | SUMMARY 281 ✓ |
| B | 12-02 | 87530d4 | 51 / 282 | ✓ |
| B | 12-03, 12-04 (PARTIAL) | a385f24 | 51 / 283 | ✓ |
| B | 12-05, 12-06 | 98802f5 (conflict) | 52 / 291 | SUMMARY says 52/290 before merge; +1 after the language.test resolution. Plausible |
| B | 12-07 | 3638304 | 52 / 293 | ✓ |
| C / anim | 16-01..07 | 23078ad (6 test conflicts) | 59 / 346 | worktree 59/344, plus the base delta. Plausible |
| C / ui | 15-01..07 | da72a3f (1 conflict) | 66 / 417 | worktree 59/362 from base 293 (+69). Merge adds 71. Plausible |
| D / readme | 13-01, 13-02 | 4fd5473 | 66 / 417 | ✓ |
| D / lip | 17-01..06 (17-05 PARTIAL) | 4a0e79e | 73 / 678 | SUMMARY 73/678 ✓ |
| E / docs | 13-04 (PARTIAL), 18-02 | bde1543 | 73 / 678 | ✓ |
| E / arch | 14-01..06 | 26d6ddd | 75 / 705 | SUMMARY 75/705 ✓. Inside the worktree the count dipped to 74/701 at 14-04 because `model-cache.test.ts` was deleted along with its module. Justified |
| F | 18-03 (P), 18-04, 18-07 (P) | 3a0690b | 75 / 706 | **auditor measured 75 / 706** ✓ |

The test count never dropped between merges: 245 → 259 → 275 → 281 → 282 → 283 → 291 → 293 → 346 → 417 → 417 → 678 → 678 → 705 → 706.

## 3. Verdict per phase

| Phase | Verdict | Evidence |
|---|---|---|
| **11.2** | **PARTIAL** | 04..08 have SUMMARYs (complete, code level). 03 and 09 are BLOCKED on the owner (real ElevenLabs recording, hero capture). Visual and GPU verification DEFERRED-HUMAN. ROADMAP says "7/9" ✓ |
| **12** | **COMPLETE (automated)**, manual UAT pending | All 5 enforced Gate A scopes are ON (`tests/language.test.ts:132-180`: docs/core, docs/all, src, tests, root). The `docs/renamed` scope is OFF but is a subset of docs/all. Gate B skip-list is empty. 12-04 was PARTIAL in isolation; its leftover (CCR A/B) was closed in 12-06/12-07 |
| **13** | **PARTIAL** | Every README relative link resolves to a tracked file with exact case (15/15 checked via `git ls-files`). Port 5310 matches `vite.config.ts:25`. The "Node 20.19" floor matches eslint 10.15 `engines`. Test counts on README lines 8 and 107 (706/75) match the measurement. Command list matches the package.json scripts. 13-03 is BLOCKED (visual assets). 13-04 is PARTIAL |
| **14** | **COMPLETE (automated)** | `tests/layering-rules.ts:94-103` holds exactly 1 EXCEPTION (a2f-backend → a2f-parser) with a reason. `tsconfig.test.json` includes `src` and `tests`, and `tsconfig.json:17` sets `noUncheckedIndexedAccess`. `src/core/model-cache.ts` is deleted. realism → lipsync was fixed by moving `anim-config` / `alloc-probe` to `src/realism/` (no shim). Cold-open doc and dev-boot UAT pending |
| **15** | **COMPLETE (automated)**, visual/keyboard/viewport matrix DEFERRED-HUMAN | Copy contract: `tests/copy.test.ts:74` checks that every `t('...')` resolves, `:265` that every Phase 15 slot exists, and `:275` that `src/ui` has no inline literals. Light theme: `src/style.css:142` (`body.theme-light` token swap). `tests/ui-tokens.test.ts` exists. style.css grew from 1229 to 1510 lines, against a plan that expected it to shrink (recorded) |
| **16** | **COMPLETE (automated)**, 5 behavior changes await sign-off | `tests/hot-path-allocations.test.ts:156-235` is meaningful. It replaces global Map/Set with counting subclasses and spies on Array.slice/filter/map/concat and Object.entries. It asserts 0 allocations over 120 SPEAKING frames for both sources. It includes a test that the probe really fires ("guards the guard") and a golden-weights test. `ANIM_DEFAULTS` is deep-frozen (`src/realism/anim-config.ts:13-21`) |
| **17** | **PARTIAL** (17-05 live UAT) | The lexicon hit-rate gate stays at ≥ 0.95 (`tests/g2p-en.test.ts:95-100`) with an explicit "never lower" comment. The corpus (`scripts/lipsync-corpus.mjs`) is documented as NOT an input to the pruning script. `src/lipsync/g2p/g2p-pl.ts` is rule-based with no lexicon (199 lines, header :5). Closure checks use the A1-corrected `<= 0.35` (`tests/phoneme-visemes.test.ts:47,161`) |
| **18** | **PARTIAL** | `.github/workflows/ci.yml`: Node 22, branch `master`, steps `npm ci`, typecheck, lint, format:check, test, build. These are the same commands as `verify`; only the order differs, which has no effect. ESLint layering rule: `eslint.config.ts:23` imports `violationOf` from `tests/layering-check`, which reads `tests/layering-rules.ts`, so the rule is single-sourced ✓. The CI workflow has never run on GitHub. 18-05 and 18-06 are BLOCKED. LICENSE is All Rights Reserved and the wording awaits the owner |

## 4. Test integrity

- **No** `.skip`, `.only` or `.todo` added. **No** `ts-ignore` or `ts-expect-error` added. **No** file-wide `eslint-disable`. The 49 `eslint-disable-next-line` lines all carry a reason, mostly `no-console` on trace logs and `require-await` on Promise contracts.
- `any`: 4 lines added and 4 removed, and the added hits are only the word "any" in comments. The net change in real `any` usage is ≤ 0.
- ESLint config relaxes only `require-await` for tests (`eslint.config.ts:89`).
- Deleted test file: `tests/model-cache.test.ts` (7 expects). Justified, because the module was deleted as dead code in 14-04 (zero production importers, DRIFT D2).
- Removed tests:
  - `telemetry.test.ts` "adaptive prebuffer jitter" (4 expects): the API (`bumpPrebufferForJitter` / `setAdaptivePrebuffer`) was deleted as dead in 16-04. The auditor confirmed it had **no production callers at baseline**. Its absence is now asserted (`tests/anim-config.test.ts:71`). Justified.
  - `viseme-overrides.test.ts` re-export identity test: the re-export was removed (16-04). Justified.
- Changed assertions:
  - `a2f-parser.test.ts`: assertions were rewritten (`defined()` wrapper for noUncheckedIndexedAccess, EN error messages). The `carriesEmotion` / `emotions` expectations are now inverted (absent). This change is documented in 16-02-SUMMARY ("one emotion mix"). Justified, but it is a product behavior change; see M-2.
  - `compare-controller`, `face-controller-state`, `a2f-backend`, `race-condition-epoch`, `calibration`: expect counts are identical to baseline. The diffs are translation or renaming only.
  - `phoneme-merge`, `phoneme-visemes`, `g2p-en`: expect counts rose (14→56, 20→47, 15→34).
- Thresholds: no threshold was lowered. The M/B/P closure pins moved from `>= 0.85/0.51` to `<= 0.35`. This change follows the authoritative 17-02 amendment (DRIFT A1 #1-4) and is not a weakening.

## 5. Orchestrator conflict resolutions

Per-file test-case counts were compared at the merge base, both parents and the merge result:

- **98802f5** `tests/language.test.ts`: 7 / 7 / 7 → 7. Both scope flags ON, as RUN.md states.
- **23078ad**: in all 12 overlapping test files the merge result equals the phase-16 parent count (e.g. animation-router 6/6/7 → 7, face-driver 2/2/3 → 3). The phase-16 removals (telemetry 3 → 2, viseme-overrides 8 → 7) were deliberate, see §4. Diffs against the second parent are EN renames from 12-07 (equal +/- line counts). No test was lost.
- **da72a3f**: container.test 4/4/7 → 7, copy.test 7/7/10 → 10. No test was lost.

The post-merge gate count rose every time. **No lost logic or tests found.**

## 6. Drift compliance (8 sampled, all honored)

| Item | Evidence |
|---|---|
| A1 #1-4: closure via `<= 0.35`, no 0.51/0.85 pins | `tests/phoneme-visemes.test.ts:47,161`, `tests/lipsync-corpus.test.ts:167`. `git grep` finds no `>=0.51` / `>=0.85` pin |
| A1 #6: `pressRef` key | `src/realism/anim-config.ts:49`, used at `src/lipsync/viseme-scheduler.ts:139` |
| A1 #7: `clockVersion` kept | `src/lipsync/calibration.ts:33,57` |
| A1 #9: no EXCEPTIONS entry for face-controller → audible-clock | only 1 exception exists, and it is not this one |
| B2 #9 / C1: `app/copy.ts` in MODULE_RULES | `tests/layering-rules.ts:59` |
| B2 #12: `docs/en-visemes.md` lowercase | tracked with exact case. No old names left outside `.planning` and RENAME_MAP |
| B2 #13: `chip.simplifiedLipsync` | `src/app/copy.ts:19` |
| C1 / D2: keep `voice:error`, delete `compare:disposed` | `voice:error` is live (`connection-banner.ts:39`). `compare:disposed` has 0 hits in src |
| D2 / 14-02: realism → lipsync fixed properly | `anim-config` and `alloc-probe` now live in `src/realism/`. No exception was added |
| D1 / D2: LICENSE All Rights Reserved, not MIT | README:115 and LICENSE |

## 7. Write-lock and scope

The edits outside `files_modified` are all recorded in RUN.md or the SUMMARYs:
- tests/calibration, viseme-overrides and container mocks (11.2)
- the 17 spill into migrate, app-types, animation-controller/panel, copy, status-pill, style.css and the vite warning limit
- orchestrator edits to README counts, the package.json test script, and STATE/ROADMAP/REQUIREMENTS

Each one follows from a dependent API change. None is gratuitous.

The product behavior changes that are not purely mechanical are:
- 16's five intentional changes, listed in 16-VERIFICATION and awaiting owner sign-off
- removal of the dead adaptive prebuffer, which had no runtime effect because there were no callers
- A2F clip emotions dropped in favor of one emotion mix (16-02)
- calibrator M preview now delegates to the pose table (17-02, accepted per A1 #5)

All of them are covered by a plan or SUMMARY. **No unplanned behavior change found.**

## 8. Tracking honesty

- ROADMAP: phases 11.2 to 18 are all unchecked `[ ]`, each with a PARTIAL or "automated PASS; UAT pending" note. No over-claim.
- STATE: `stopped_at` lists exactly the blocked plans (11.2-03, 11.2-09, 13-03, 18-05, 18-06) and the partial ones (13-04, 17-05, 18-03, 18-07). Accurate.
- REQUIREMENTS: ARCH and ANIM are marked "Complete (automated PASS; manual UAT pending)", which is acceptable because the qualifier is present. **Under-claim:** READ-02 is still marked "FAIL (stale test count)" and READ-06 "partial (ARCHITECTURE link)". Both are now fixed: README:8/107 says 706/75, and README:85 links ARCHITECTURE.md. See L-1.

## 9. Findings, ranked

**CRITICAL:** none.

**HIGH:** none.

**MEDIUM**
- **M-1** `.github/workflows/ci.yml` has never run on GitHub. The CI badge and QUAL-02 are unproven. The run was validated locally and in the auditor's cold export, so the risk is limited to GitHub-specific issues such as Linux case-sensitivity outside the README links, permissions, or the `npm ci` lockfile platform.
- **M-2** Product behavior deltas are awaiting owner sign-off: the 5 changes in 16-VERIFICATION, plus the A2F per-frame emotions dropped (`src/lipsync/a2f-parser.ts`, 16-02). Tests were changed to match. They are documented but have not been validated by a human watching the avatar.
- **M-3** `package.json` has no `engines` field, while README:19 claims a Node ≥ 20.19 floor. A fresh user on Node 18 gets an opaque ESLint or Vite error rather than an npm warning.

**LOW**
- **L-1** `.planning/REQUIREMENTS.md`: READ-02 FAIL and READ-06 partial are stale (now fixed). 13-VERIFICATION §READ-02 is stale too. This is an under-claim.
- **L-2** `tests/language.test.ts:134-136`: scope `docs/renamed` is still `enforced: false`, and its comment ("six of the eight renamed docs still contain Polish") is stale. It is harmless because `docs/all` is enforced.
- **L-3** The production CSP (`vite.config.ts` ~:15) has `connect-src 'self' blob: wss://api.elevenlabs.io`, so the A2F HTTP backend is blocked in a production build. This is pre-existing and unchanged in this run, but should be documented if the neural track is ever demoed from `dist/`.
- **L-4** `.gitignore` comments are still in Polish. The language gate does not cover it, and README claims English from Phase 12 onward.
- **L-5** Known gaps recorded by 14 are not closed:
  - EmbedBridge window listener
  - `AudioEngine.dispose`
  - vignette DOM teardown
  - `animation-sources.ts:72,79` Polish labels (a gate miss)
  - `@elevenlabs/client` unused dependency
  - 5 dev-only `npm audit` advisories
  - T-8 a2f-parser edge cases unowned (17)
- **L-6** 15: `style.css` grew (1229 → 1510 lines) against a plan that expected it to shrink. This is recorded and not a defect.
- **L-7** Local vitest prints `--localstorage-file` warnings from the Node runtime. Harmless, but CI will show the same noise on Node 22+.

No secrets were found in the run diff: no `.env` or key-like files, no `sk_` or xi-api-key literals. `.env` is gitignored.

## 10. Remaining steps for the owner

1. **11.2-03**: record the real ElevenLabs "Listen" clip. **11.2-09**: hero capture. Then visual UAT for 11.2-04..08 on a real GPU.
2. **12**: manual UI and console UAT in English.
3. **13-03**: README visual assets (hero image, screenshots from 15 §5). Then 13 manual UAT and READ-05.
4. **14**: cold-open read of ARCHITECTURE.md, and a dev-boot UAT.
5. **15**: VERIFICATION §2-5 (theme × state visual matrix, keyboard walk, failure injection, viewport tiers, screenshots).
6. **16**: 5 manual UAT items plus sign-off of the 5 intentional behavior changes, including the A2F emotion mix.
7. **17-05**: live lip-sync UAT (M/B/P closure, PL G2P by ear and eye).
8. **18-02**: approve the LICENSE (All Rights Reserved) wording. **18-03**: push and confirm the first green CI run, then enable the badge.
9. **18-05**: decide the offline Pages demo (needs `demo=1` / BASE_PATH and 11.2-03). **18-06**: hygiene dispositions for untracked `.claude/`, `scripts/make-demo-clip.mjs`, and `.planning/config.json.bak-*`.
10. Optional: add `"engines": { "node": ">=20.19" }`, refresh REQUIREMENTS READ-02 and READ-06, and remove the `docs/renamed` scope.

## Overall

**The automated work is complete and trustworthy.** Gates are green from a cold clone, there are 706 tests and none were weakened, the bundle is about 4× smaller, drift was honored, and the merges were lossless. Phases 12, 14, 15 and 16 are complete at the automated level. Phases 11.2, 13, 17 and 18 are PARTIAL, waiting only on owner and human steps. The milestone cannot be closed until the human UAT and owner decisions above are done.
