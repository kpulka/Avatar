---
phase: 17-lipsync-phonemes-refactor
plan: 03
subsystem: audio
tags: [alignment, normalization, rescale, energy-fallback, golden-spans]
requirements: [LIP-03, LIP-06, LIP-07]
key-files:
  created:
    - src/audio/alignment-normalize.ts
    - tests/speech-backend-alignment.test.ts
    - tests/lipsync-corpus.test.ts
    - tests/fixtures/lipsync-corpus.json
  modified:
    - src/audio/alignment-rescale.ts
    - src/audio/energy-fallback.ts
    - src/audio/speech-backend.ts
    - src/lipsync/g2p/phoneme-merge.ts
    - tests/alignment-rescale.test.ts
    - tests/energy-fallback.test.ts
    - tests/speech-backend.test.ts
    - tests/phoneme-merge.test.ts
status: complete
commits: 3
plan_head_before: 92dd8dc1d7fe4903778e1d7f13e2735d25b179b1
plan_head_after: 444e25706869c87f0bce402a99ddcc3451b6cdbc
actuals:
  tasks: 7
  commits: 3
---

# Phase 17 Plan 03: Alignment normalization extraction + golden-span corpus Summary

The input side of the pipeline is now as tested as the G2P side: `normalizeAlignmentPayload()` is a pure function with a full unit matrix, the rescale anchors on detected speech onset/offset, the energy fallback has defined edge behavior, and a 20-case golden-span corpus pins the end-to-end data result with computed closure-presence and distinctness proxies.

Gate after this plan: `npm run build` OK; 70 files / 626 tests (baseline 66 / 417).

## Behavior decisions pinned (input for the 17-06 docs sync)

| Decision | Pinned value | Where |
|---|---|---|
| Negative start/duration times | clamped to 0 (a negative time cannot precede its audio) | normalize, rescale |
| NaN / Infinity in starts or a full-length duration array | whole alignment dropped -> null -> energy fallback | normalize; rescale returns the input unchanged |
| Duration array of the wrong length | ignored, flat 50 ms per char | normalize |
| Derived duration (end - start seconds) | floor 25 ms | normalize |
| Container aliases | `alignment` > `normalized_alignment` > `alignments` > bare object | normalize |
| Rescale factor clamp | [0.5, 2.5] (was 2.0) | rescale |
| Speech-bounds anchoring | 70 ms RMS windows, threshold 0.02; onset = start of first loud window, offset = end of last; used only when span >= 100 ms | energy-fallback, rescale |
| Energy window count | `Math.round` (a tail of >= half a window becomes a slice) | energy-fallback |
| Invalid sample rate | throws `energy-fallback: invalid sample rate`; `pcm_0` metadata is ignored | energy-fallback, speech-backend |
| Odd `byteOffset` PCM view | copied (Int16Array view would throw) | energy-fallback |
| Diagnostics | `[AlignDiag]` line now carries `raw=<ratio>` measured BEFORE the rescale; flagged when outside [0.5, 2.5]; 17-05 section 5 must read `raw=` (the post-rescale ratio is ~1.0 by construction) | speech-backend |

## Computed proxy metrics

- **Closure presence:** every M/B/P in the corpus (>= 15 spans) has a span >= 17.5 ms and the perceived-closure criterion holds under balanced (close 0.30 <= 0.35, press 0.348 >= 0.3, jaw 0.02 <= 0.05). Replaces the stale `mouthClose x closeScale >= 0.51` (Drift A1 #1).
- **Distinctness proxy (honest result):** the table has 29 distinct poses (8 groups of poses identical by design: B/M/P, CH/JH, D/N/T, DH/TH, F/V, G/K, S/Z, SH/ZH - frozen by a test). Minimum pairwise L1 distance between distinct poses is **0.02 (ER vs R)**, so the plan's 0.15 threshold does NOT hold for every pair, and "lower to measured - 0.03" would give a negative number. Instead the threshold stays 0.15 (not lowered) with the near-twins pinned explicitly: ER|R 0.02, AY|EH 0.08, AH|G/K 0.12 (floor of each pinned at value - 0.005). The closest NON-twin pair is **0.18** (L vs NG, AH vs NG). Findings for the UAT section 3: EH vs the AY start pose, ER vs R, AH vs K/G are the twin candidates to judge by eye.

## What changed

- `normalizeAlignmentPayload()` (src/audio/alignment-normalize.ts) - transcription of the old inline block plus the explicit negative clamp and finite-number guards; `speech-backend.ts` holds no inline normalization any more (two `as any` casts gone). Unit matrix in `tests/speech-backend-alignment.test.ts` (canonical; 17-06 task 1 is satisfied by it).
- Rescale: edge guards, onset/offset anchoring, MAX_FACTOR 2.5, corrected header comment (out-of-range factors are clamped, not left uncorrected). Tests: leading 300 ms silence -> first char >= 280 ms; trailing silence -> last end <= offset + 30 ms.
- `tests/fixtures/lipsync-corpus.json` (20 cases: 7 control sentences verbatim, 6 conversational excerpts, know-what, question, bilabial closure, 3 OOV-rules sentences, 1 Polish char-path case) + `tests/lipsync-corpus.test.ts` (exact phoneme sequences, per-word sum / no-overflow invariant, glide ordering, char-path tokens, closure presence, distinctness).
- Integration tests in `tests/speech-backend.test.ts`: a live chunk with 300 ms leading silence is anchored on the speech (first char >= 280 ms, last end 1000 ms); malformed alignment falls back to the energy source; `pcm_0` is ignored.

## Deviations from Plan

**1. [Drift A1 #1] Closure criterion** is perceived closure, not `>= 0.51`.
**2. Distinctness threshold handling** as described above (twin registry instead of lowering the threshold).
**3. [Rule 1 - Bug] `phoneme-merge.ts` (a 17-02 file):** a lone `-` or `'` between spaces became a word whose rules returned `['']`, i.e. a silent empty-phoneme span that ate part of the window; such runs are now skipped (found while building the corpus; tested).
**4. [Rule 2] Extra hardening beyond the plan:** `pcm_0` metadata guard in `speech-backend.ts` (a zero sample rate would now throw in the analysis), odd `byteOffset` PCM views in the energy fallback.
**5. Plan said `tests/lipsync-corpus.json`** in one acceptance line and `tests/fixtures/lipsync-corpus.json` elsewhere; the fixtures path is used. The fixture field is `msPerChar` (the plan called it `charsPerMs`, but the number is milliseconds per character).
**6. Whether the golden sequence includes diphthong glide spans:** no - `phonemeSequence` is the G2P-level sequence; glide spans (`glideOf`) are tested separately, so a diphthong table tweak does not rewrite every fixture.
**7. Behavior change on the live path** (needs the real-session UAT, DEFERRED-HUMAN): speech-bounds anchoring changes where the first/last characters land in chunks with leading/trailing silence. It degrades to the previous whole-chunk behavior when no speech is detected.

## Known Stubs

None.

## Self-Check: PASSED
