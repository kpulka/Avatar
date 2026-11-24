---
phase: 17-lipsync-phonemes-refactor
plan: 04
subsystem: lipsync
tags: [polish, g2p, rules, settings-migration, language-dispatch]
requirements: [LIP-05]
key-files:
  created:
    - src/lipsync/g2p/g2p-pl.ts
    - src/lipsync/g2p/language.ts
    - src/lipsync/lipsync-engine.ts
    - tests/g2p-pl.test.ts
    - tests/face-controller-engines.test.ts
  modified:
    - src/lipsync/g2p/phoneme-merge.ts
    - src/lipsync/g2p/phoneme-visemes.ts
    - src/lipsync/viseme-mappings.ts
    - src/lipsync/face-controller.ts
    - src/app/store/settings-schema.ts
    - tests/viseme-mappings.test.ts
    - tests/settings-store.test.ts
  modified_outside_plan_files:
    - src/app/store/migrate.ts
    - src/app/app-types.ts
    - src/app/copy.ts
    - src/features/animation-controller.ts
    - src/ui/studio/panels/animation-panel.ts
status: complete
commits: 3
plan_head_before: 49a2c822a779cb5f4f064778f40362763a8339b7
plan_head_after: e0a2be6c048e2e37488522a57bd238f3d4ff359d
actuals:
  tasks: 6
  commits: 3
---

# Phase 17 Plan 04: Rule-based Polish G2P and per-language engine Summary

Polish now has a real phoneme path: a deterministic rules engine (no lexicon, works before the English dictionary loads) feeds the same merge/scheduler/pose pipeline, and the engine setting is per language (`phoneme-en` / `phoneme-pl` / `char`) with a lossless migration of the old `phoneme` value.

Gate after this plan: `npm run build` OK (main chunk 193.10 -> 196.34 kB, no new chunk); 72 files / 669 tests (baseline 66 / 417).

## What changed

- **`g2p-pl.ts`**: longest-match-first rules. Digraphs sz/cz/rz/ch/dz/dz-acute/dz-dot, single diacritics, softness-i consumed into c/n/s/z/dz ONLY before a vowel (a, e, o, u, ogonek vowels, o-acute), word-final nasal e spoken plain, final devoicing on the last token. All Polish letters are `\uXXXX` escapes, so no Gate A allowlist entry was needed.
- **Token contract (viseme classes, not IPA)**: shared ARPAbet keys where the pose coincides (AA EH IY AO UW IH SH ZH CH JH W Y L R ...), plus `PL_H`, `PL_SI/ZI/CI/DZI` (soft sibilants, one shared pose), `PL_NI`, `PL_TS`, `PL_DZ`, `PL_AN`, `PL_EN` in `PL_PHONEME_POSES` (kept separate from `PHONEME_POSES`, so the English snapshot and distinctness guards are untouched). The plan's `pl-phonemes.ts` / "PL_PHONEME_POSES in phoneme-visemes.ts" is the latter.
- **`language.ts`**: per-word dispatch. A word is Polish if it has a diacritic, or a Polish-only digraph (sz/cz/rz/dz) and the English lexicon does not know it; otherwise it follows the engine default. `charsLookPolish()` is the allocation-free chunk-level check for the char path.
- **Merge**: `mergeCharAlignmentToPhonemes(alignment, { defaultLanguage })`; the word-run regex now includes the Polish letters; PL nasal vowels carry the vowel weight; same span-sum / no-overflow invariant (tested for Polish sentences).
- **Char path**: `mapCharToShapes(chars, i, context?)`; in a Polish context `ch` is the velar fricative (open, no funnel), English `ch` unchanged. FaceController computes the context once per chunk (`phoneme-pl` engine or Polish evidence in the chunk).
- **Settings**: `LipSyncEngine = 'phoneme-en' | 'phoneme-pl' | 'char'` in `src/lipsync/lipsync-engine.ts` (re-exported by the schema), `parseLipSyncEngine`: legacy `phoneme` -> `phoneme-en`, unknown -> default. Schema version stays 1. Animation panel: checkbox became a three-option select with new `animation.engine*` copy slots.

## Control results (unit-tested, no model)

| Word | Tokens |
|---|---|
| szczypczyzna | SH CH IH P CH IH Z N AA |
| dziekuje (ogonek letters) | PL_DZI PL_EN K UW Y EH |
| chata | PL_H AA T AA |
| ziarno | PL_ZI AA R N AO |
| zima | Z IY M AA |
| trzeba | T ZH EH B AA |
| chleb | PL_H L EH P |
| kat / weze | K PL_AN T / V PL_EN ZH EH |

## Deviations from Plan

**1. [Drift] Files outside `files_modified`** (strictly required for the settings change to compile and be reachable): `migrate.ts` (legacy value mapping), `app-types.ts` and `animation-controller.ts` (engine type), `animation-panel.ts` + `copy.ts` (the engine select; a boolean toggle cannot express three engines), plus new `language.ts` and `lipsync-engine.ts`. No behavior change beyond the engine.
**2. Final devoicing includes g -> k** (the plan lists b/d/w/z only); it is correct Polish and costs one table entry. Note: with the current pose table the voiced/voiceless pairs share poses, so devoicing is visually a no-op today; it is pinned at token level so a future pose split is already right.
**3. Softness-i before a consonant stays a plain vowel everywhere**, including "dzi" (so "dzis" is PL_DZ IY ...). This is what the plan specifies for "zima"; linguistically "zi" is always soft, but the viseme difference is nil (the IY vowel already carries the smile).
**4. Engine default dispatch instead of pure auto-detect:** ASCII words with no Polish evidence follow the engine (`phoneme-pl` -> PL, `phoneme-en` -> EN). Mixed-language TURN detection stays deferred (documented limit: English words inside a `phoneme-pl` turn are read with Polish rules).
**5. Char-path fix scope:** only `ch` (the plan's task 4 "keep everything else"). The `dzi` / `zima` softness quirks of the fallback path are pinned as known limitations (T-6) rather than changed.
**6. Manual A/B acceptance item** (PL sentence on phoneme-pl vs char) is DEFERRED-HUMAN, folded into the 17-05 UAT protocol.

## Known Stubs

None.

## Self-Check: PASSED
