---
phase: 17-lipsync-phonemes-refactor
plan: 02
subsystem: lipsync
tags: [phoneme-merge, diphthong, phoneme-table, calibrator]
requirements: [LIP-03, LIP-04]
key-files:
  created:
    - tests/fixtures/phoneme-poses-snapshot.json
    - tests/face-controller-testphoneme.test.ts
  modified:
    - src/lipsync/g2p/phoneme-merge.ts
    - src/lipsync/g2p/phoneme-visemes.ts
    - src/lipsync/face-controller.ts
    - src/lipsync/viseme-scheduler.ts
    - tests/phoneme-merge.test.ts
    - tests/phoneme-visemes.test.ts
status: complete
commits: 3
plan_head_before: d03e3093e5ba2f9112adb892f910a146a4df61c9
plan_head_after: c99ac2cfd2f15e4df6a32b4dd01ec7a71434e41f
actuals:
  tasks: 6
  commits: 3
---

# Phase 17 Plan 02: Merge timing hardening + table/doc reconciliation Summary

Phoneme spans can no longer leave their word's time window (the 35 ms floor is now a soft minimum renormalized inside the word), AY and AW move (start pose then IH/UH glide) with zero scheduler changes, `PHONEME_POSES` is the one table every consumer reads, and the Calibrator preview no longer carries eight hand-written poses.

## What changed

- **Merge (LIP-03).** `distributeDurations(weights, spanMs)`: ideal proportional split; if the 35 ms floor would overflow the window the clamped durations are scaled into it, with a 17.5 ms hard floor (water filling) and an equal split when even that cannot fit. The last span of a word is pinned to the window end, so rounding cannot leak. Reproduced bug (arithmetic of the previous algorithm): "the" in a 50 ms window got DH 35 + AH 35 = 70 ms and bled 20 ms into the next word; the regression test pins the fixed behavior. Window invariant tested over five sentences at 100/55/30/12 ms per char.
- **Diphthongs (LIP-04).** `DIPHTHONG_END_POSES = { AY: 'IH', AW: 'UH' }`; `toUnits()` splits a diphthong's weight 60/40 into its own pose and the glide pose; the second span carries `glideOf`. EY/OW/OY stay single. Removing a map entry reverts that diphthong.
- **Table (LIP-04).** `phoneme-visemes.ts` exports `PHONEME_POSES` (39 keys; P/B/M share one object), `lipPoseToShapes`, `DIPHTHONG_END_POSES`; `mapPhonemeToShapes` reads the table (own-key guard, so `constructor` is unknown). The module doc now states the layering formula. Regression: a committed 39-key snapshot captured from the pre-extraction function (`tests/fixtures/phoneme-poses-snapshot.json`) - all values identical.
- **Layering (corrected).** effective = table value x profile scale, with mouthClose/mouthPress scaled by `min(closeScale, ANIM_DEFAULTS.common.mouthCloseCap)`. Cap limits the SCALE (0.85), not the value. Balanced: close 0.50 x 0.60 = 0.30, press 0.58 x 0.60 = 0.348, jaw 0.02. The computed test (reads the table, no hardcoded numbers) asserts the perceived-closure criterion `mouthClose <= 0.35 AND mouthPress >= 0.3 AND jawOpen <= 0.05` and cross-checks the computation against what the scheduler renders for all three presets.
- **testPhoneme (D-7).** The 8 literal blocks are gone (`grep setManualOverride('jawOpen', 0.` -> 0 hits). It now reads `defaultVisemeShapes(key)` (phoneme table first -> M and F; char table -> A, E, O, U, SZ) and multiplies by the scheduler's public `scaleForShape`. The SPEAKING guard and `resetFaceToNeutral()` from Phase 16 are untouched.

Gate after this plan: `npm run build` OK; 68 files / 498 tests (baseline 66 / 417).

## Deviations from Plan

**1. [Drift A1 #1/#4, C1] Closure criterion** uses the amended 17-02 numbers, not `mouthClose >= 0.85 / 0.51`; `CLOSE_SAFETY_CAP` -> `ANIM_DEFAULTS.common.mouthCloseCap`; the hardcoded `mouthClose === 0.8` assertion no longer existed - the existing SHOW-06 block in `tests/phoneme-visemes.test.ts` was extended, not duplicated. Doc/test wording of LIPS-06 / LIP-04 ("effective mouthClose >= 0.85") is replaced by the perceived-closure criterion.
**2. [Drift C1] `PHONEME_POSES` / `DIPHTHONG_END_POSES` did not exist** - the table was an inline switch; extraction was new work with identical values (snapshot-proven).
**3. [Drift A1 #5] Calibrator preview changes visually.** M now previews the SHOW-06 bilabial pose (the old "visually unchanged" criterion is dropped for M). A/E/O/U/SZ now read the char-table poses and F the phoneme-table pose, scaled like live speech (previously hand-tuned literals, e.g. E was jaw 0.16 / smile 0.35). The Calibrator visual check in the dev server is DEFERRED-HUMAN. Note: manual `mouthClose` still passes through `guardClose` (jaw + 0.2 margin), so the M preview shows close <= 0.22 while jaw is 0.02.
**4. [Rule 3] `VisemeScheduler.scaleForShape` made public** (was private) so the preview can apply the exact same scale policy instead of re-implementing it. One-word change in a Phase 16 file; no behavior change.
**5. Glide spans reuse the end pose's phoneme key** (`IH` / `UH`), so a user override of IH/UH in the Viseme Editor also shapes the glide end; `glideOf` marks them for tests/telemetry.
**6. Plan task 2 "zero-duration word" wording:** a word is skipped only when its window is zero (equal start times and zero durations); starts spaced apart with zero durations still give a window equal to the spacing. Pinned both ways.
**7. Docs not edited here** (docs sync is 17-06) - the exact edit list follows.

## Docs edit list for 17-06 (file: docs/en-visemes.md unless noted)

1. Section 3, "P / B / M": replace the base `mouthClose 1.0 / press .15` guidance with the SHOW-06 pose: jaw 0.02, close 0.50, press 0.58, rollLower 0.25, rollUpper 0.15; add the layering formula and the balanced numbers (0.50 x 0.60 = 0.30 close, 0.58 x 0.60 = 0.348 press); state that closure is perceived (press + roll), not mouthClose alone.
2. Section 4: add a status note above the table: "Column B/P are historical; v1.3 code (`PHONEME_POSES`) is the source of truth"; fix the MBP row to the SHOW-06 values.
3. Section 5.5: mark "option 2 implemented for AY and AW (17-02): AY -> IH, AW -> UH, 60/40 time split, EY/OW/OY static".
4. Section 8 changelog: new row for 17-02 (merge window invariant, diphthong glide, table extraction, closure criterion change from `mouthClose >= 0.85` to perceived closure).
5. docs/3-lip-sync-and-coarticulation.md: layering section with the corrected example; merge paragraph ("35 ms soft floor renormalized into the word window").

## Known Stubs

None.

## Self-Check: PASSED
