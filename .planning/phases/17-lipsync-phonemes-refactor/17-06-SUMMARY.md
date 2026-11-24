---
phase: 17-lipsync-phonemes-refactor
plan: 06
subsystem: ui-docs
tags: [fallback-chip, docs-sync]
requirements: [LIP-06]
key-files:
  created:
    - src/ui/user/lipsync-degradation.ts
    - tests/lipsync-degradation-chip.test.ts
  modified:
    - src/ui/user/status-pill.ts
    - src/app/copy.ts
    - src/style.css
    - docs/3-lip-sync-and-coarticulation.md
    - docs/en-visemes.md
    - docs/4-audio-and-barge-in.md
    - .planning/phases/17-lipsync-phonemes-refactor/17-VERIFICATION.md
status: complete
commits: 3
plan_head_before: 45533fff8fc516df1c537625bc9dda32278f1a18
plan_head_after: b47d4bac786ecd038f75d6b1e7df257a8722583b
actuals:
  tasks: 3
  commits: 3
---

# Phase 17 Plan 06: Fallback honesty chip and docs sync Summary

User mode now tells the truth when lip-sync degrades to the acoustic fallback, and the three lip-sync docs describe the code as it is after Phase 17.

Gate after this plan: `npm run build` OK; 73 files / 678 tests (baseline 66 / 417).

## What changed

- **Chip (task 3).** `chip.simplifiedLipsync` = "Simplified lip-sync" (copy.ts), rendered next to the status pill, hidden by default, `role=status`. Seam choice: the existing `audio:chunk` event already carries `alignment.source`, so there is NO new event and no new telemetry counter; the pure state machine `nextDegradationState` (src/ui/user/lipsync-degradation.ts) shows the chip on the first `energy-fallback` chunk and clears it after 2 consecutive chunks with real alignment (a fallback chunk in between resets the streak, so a flaky stream does not flicker). It also clears when the voice state returns to `idle`, so a finished session leaves no stale chip. Studio's ALIGN badge is unchanged. Tests: pure state matrix and the DOM wiring (appears on forced fallback, clears on recovery and on idle).
- **Docs (task 4).** docs/3: pipeline diagram (normalizer, speech-anchored rescale, per-word language dispatch, pruned lexicon, PL rules, soft-minimum window invariant, diphthong glide), components table, new "PL phoneme layer" section, operating rules (three engines), effective-value layering with the corrected worked example, fallback/chip paragraph, stale char-table M/B/P row. docs/en-visemes: M/B/P parameters = SHOW-06 values, section 4 status note and MBP row, section 5.5 status (AY/AW implemented, tuned-by-harness), two changelog rows. docs/4: `agent_response_correction` semantics (captions and emotion analysis only; audio/visemes are epoch-invalidated).
- **Task 1 (verify extraction).** 17-03 landed `normalizeAlignmentPayload` and `speech-backend.ts` calls it (no inline normalization); `tests/speech-backend-alignment.test.ts` is the canonical matrix, so there is no `tests/alignment-normalize.test.ts` (plan amendment honored).

## Deviations from Plan

**1. Chip placement:** `status-pill.ts` (+ `style.css` one rule) instead of `conversation-dock.ts` - the plan text says "near the status pill"; the dock holds buttons, not status. Both are outside the listed `files_modified` strictly for that reason. Phase 15 primitives were not needed (a plain `span` reusing `.status-pill`); no TODO(15) marker required.
**2. Copy language:** the plan's PL variant ("Uproszczony lip-sync") is not added; the UI is English-only since Phase 12 and Polish UI strings are out of the language gate.
**3. [Drift A1] Worked example in docs/3** uses the real numbers (0.50 x 0.60 = 0.30 close, 0.58 x 0.60 = 0.348 press), not the plan's stale "0.8 x 0.6 = 0.48"; the doc states the perceived-closure criterion instead of "mouthClose >= 0.85".
**4. docs/3 stale presets text** ("balanced 1.00 ... M/B/P reaches ~1.0") corrected: closeScale is 0.50 / 0.60 / 0.70 and capped at 0.85 (found while writing the layering section).
**5. docs/4 sequencing vs 16-07:** one paragraph inserted before "Transition rules"; no conflict with Phase 16 text in this branch.
**6. Docs language:** English (Phase 12 landed); Polish letters appear as ASCII names, per each document's header convention (language gate Gate A/B green, no allowlist entry).
**7. README link to the deep-dive draft** left undone (README is out of bounds for this run); recorded unchecked-by-design in 17-VERIFICATION section 4.
**8. Manual acceptance item** "chip appears on forced fallback" is covered by the DOM test; the eyes-on check is part of UAT section 7 (DEFERRED-HUMAN).

## Known Stubs

None.

## Self-Check: PASSED
