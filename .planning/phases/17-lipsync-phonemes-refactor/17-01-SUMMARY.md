---
phase: 17-lipsync-phonemes-refactor
plan: 01
subsystem: lipsync
tags: [g2p, lexicon, bundle-size, oov-rules]
requirements: [LIP-01, LIP-02]
key-files:
  created:
    - scripts/build-dict-en.mjs
    - scripts/build-word-frequency.mjs
    - scripts/lipsync-corpus.mjs
    - scripts/data/en-core-vocabulary.txt
    - scripts/data/en-prose-frequency.txt
    - src/lipsync/g2p/dict-en-pruned.json
    - tests/fixtures/oov-wordlist.json
    - tests/char-engine-digraph.test.ts
  modified:
    - src/lipsync/g2p/g2p-en.ts
    - src/lipsync/viseme-mappings.ts
    - src/lipsync/face-controller.ts
    - package.json
    - package-lock.json
    - vite.config.ts
    - tests/g2p-en.test.ts
    - tests/viseme-mappings.test.ts
status: complete
commits: 2
plan_head_before: e22cb82c338a1f3cd1f27638011e54bc0f396244
plan_head_after: badcce1d8803705f251d4de0ad212cdb797a29b0
actuals:
  tasks: 7
  commits: 2
---

# Phase 17 Plan 01: Pruned EN lexicon + hardened OOV rules Summary

The browser no longer downloads the full 135k-word CMU dictionary: `g2p-en.ts` lazy-loads a committed, build-time-pruned 10,000-word artifact (`dict-en-pruned.json`) chosen by a measured, non-circular >=95% corpus hit-rate gate, and the letter-to-sound rules now handle silent letters, `-tion/-sion` and the broken `-ed` case.

## Measurement (closes the STATE.md blocker "dictionary pruning")

Output of `npm run build:dict` (corpus = 1,010 tokens of control + conversational sentences, gate >= 95%):

| N | hit-rate | raw kB | gzip-9 kB |
|---|---|---|---|
| 5,000 | 93.0% | 123.6 | 29.3 |
| **10,000 (chosen)** | **96.4%** | 269.0 | 64.7 |
| 20,000 | 97.3% | 462.2 | 114.4 |
| 50,000 | 98.0% | 1167.2 | 285.2 |
| full (126,046 base entries) | 100.0% | 3650.9 | 839.4 |

The gate picked N=10,000 automatically (smallest N >= 95%). The 36 missed tokens (3.6%) fall to the letter rules: mop ship bayed bead coat coot noisy ruin honestly patience pleasant basil forecast umbrella frustrating breath quarter jazz melody piano browse appointment confirmed insurance medicines comfort bakery crowded appreciate hesitate overnight incredible stadium librarian recap. The deliberately OOV-flavored sentences (technical loanwords, rare words) hit 59/74 and are excluded from the gate by design.

Idempotency: `npm run build:dict` run twice -> byte-identical, `git diff --exit-code` clean after commit.

## Bundle size (`npm run build`)

| Chunk | Before | After |
|---|---|---|
| CMU dictionary chunk | 3,923.77 kB / 961.14 kB gzip | **259.03 kB / 64.51 kB gzip** (`dict-en-pruned-*.js`) |
| main `index-*.js` | 190.97 kB / 57.18 kB gzip | 192.77 kB / 57.85 kB gzip (first render unchanged) |
| `three-*.js` | 595.84 kB / 152.53 kB gzip | unchanged |

Largest non-three chunk is now 259 kB (limit in the plan: < 500 kB; g2p chunk <= 150 kB gzip: 64.5 kB). Lexicon parse + table build measured in Node: ~14.5 ms (was ~286 ms for the full dictionary). `cmu-pronouncing-dictionary` is a devDependency only; no `src/` import remains (test-enforced).

## What changed

- **Selection pipeline (no frequency data exists in CMUdict).** `scripts/build-dict-en.mjs` ranks words in three tiers: (1) hand-curated core vocabulary (`scripts/data/en-core-vocabulary.txt`) plus its regular inflections/derivations that exist in CMUdict plus contractions of those words, (2) an independent prose-frequency list (`scripts/data/en-prose-frequency.txt`, produced once by `scripts/build-word-frequency.mjs` from the English prose in the dependency tree; committed so the build is reproducible across platforms), (3) remaining plain words by length. The evaluation corpus is NOT an input of the selection.
- **`g2p-en.ts`:** loader imports the committed JSON; new `wordInLexicon()`; `rulesFallback()` exported for tests; shared `lookupLexicon()` ladder (direct -> apostrophes removed -> all hyphen parts) used by both `wordToPhonemesSync` and `wordInLexicon`. Public API otherwise identical, no caller changes.
- **OOV rules (LIP-02):** capped `OOV_EXCEPTIONS` (island, listen, castle, receipt, wednesday, sandwich, hour, honest, honor, heir), suffix classes `-sten`, `-stle`, `-ceipt`, `-tion`/`-stion`/`-sion` (SH/CH/ZH + AH N, long a/o/u before -tion, doubled-S collapse), silent S in `isl-`, silent B before T (doubt/subtle), doubled consonant letters collapse to one phoneme, and the `-ed` rule fixed (after t/d -> IH D, after voiceless -> T, else D; only fires when the stem has a vowel).
- **Char engine digraph skip (R2 B8):** new `charPathSpan()` in `viseme-mappings.ts`; the char loop in `FaceController.onAudioChunk` enqueues one viseme per consonant digraph (duration spans both letters). "the" -> exactly 2 visemes.
- **Tests:** `tests/g2p-en.test.ts` extended (OOV fixture matrix, corpus hit-rate >= 95% gate, artifact integrity, no-full-dictionary-import guard); `tests/fixtures/oov-wordlist.json`; `tests/char-engine-digraph.test.ts`; `charPathSpan` cases in `tests/viseme-mappings.test.ts`. Gate: build OK, 67 files / 462 tests (baseline 66 / 417).

## Deviations from Plan

**1. [Rule 1 - Honesty] Selection does not include corpus tokens.** The plan said "include (i) all corpus tokens" and fill alphabetically; that makes the hit-rate 100% by construction and alphabetical fill covers only the start of the alphabet. Replaced by the three-tier ranking above and a gate measured on text that was not used for selection.
**2. [Rule 3 - Blocking] Extra files for the ranking signal:** `scripts/build-word-frequency.mjs`, `scripts/data/en-core-vocabulary.txt`, `scripts/data/en-prose-frequency.txt` (the plan lists only two scripts). CMUdict is alphabetical with no frequency data and `node_modules` prose alone covers only ~7.4k CMU words and lacks everyday words ("she", "her" were missing in the first experiment).
**3. Honest caveat on the gate:** the curated core vocabulary was written by the same author who had read the corpus, with generic categories (food, weather, family, time ...). The 96.4% is therefore mildly optimistic for unseen conversation; mitigations: corpus words are not listed explicitly (36 tokens still miss), and the fallback ladder degrades to rules, never to nothing.
**4. Artifact format:** no `generated` date (it would break byte-identical re-runs); stress digits stripped in the artifact (never used downstream; ~20% smaller). `buildTable` still strips digits defensively.
**5. Plan said `island` -> "IH-S-L-AH-N-D (drop S)"; the correct phonemes are AY L AH N D** - implemented and pinned that way.
**6. Plan test "every corpus token >= 3 letters present or known-OOV (fixture)"** replaced by an artifact-integrity test (count, sorted keys, ARPAbet-only, no stress) plus the hit-rate gate; the original wording is unsatisfiable with an honest 96.4%.
**7. [Rule 1 - Bug] U+2019 apostrophe:** `don’t` never matched the lexicon (keys use U+0027). `normalizeWord` now folds it; `wordInLexicon` test pins parity.
**8. Digraph skip scope:** `si/zi/ni/ci` (vowel-second soft digraphs) keep their vowel viseme; skipping it would drop the I of "nice"/"silly". Plan text only named th/sh/ch/...
**9. Edits outside `files_modified`:** `vite.config.ts` (stale 3.92 MB comments; `chunkSizeWarningLimit` 4000 -> 700 so the warning guards against the full dictionary returning), `src/lipsync/viseme-mappings.ts` + `src/lipsync/face-controller.ts` (digraph skip, as the plan's task 5 prescribes), `package-lock.json` (dev flag), `tests/viseme-mappings.test.ts`, `tests/char-engine-digraph.test.ts`.
**10. Drift items applied:** DRIFT-A1 #10 / C1: `face-controller.ts` has no `wordToPhonemesSync` import, only `phoneme-merge.ts` calls it - nothing to change there; docs path is `docs/en-visemes.md` (lowercase); anchors located by symbol. `docs/3-lip-sync-and-coarticulation.md` line 47 still describes the full dictionary - docs sync is owned by 17-06.

## Known Stubs

None.

## Self-Check: PASSED
