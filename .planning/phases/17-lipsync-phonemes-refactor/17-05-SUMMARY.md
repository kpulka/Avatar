---
phase: 17-lipsync-phonemes-refactor
plan: 05
subsystem: verification
tags: [uat, protocol, deferred-human]
requirements: [LIP-07]
key-files:
  created:
    - .planning/phases/17-lipsync-phonemes-refactor/17-UAT-PROTOCOL.md
  modified:
    - .planning/phases/17-lipsync-phonemes-refactor/17-VERIFICATION.md
status: partial
commits: 2
plan_head_before: d25321e
actuals:
  tasks: 2
  commits: 2
---

# Phase 17 Plan 05: Live UAT protocol Summary

The scripted protocol exists and the verification document carries the real automated evidence; the live listening/viewing session itself is DEFERRED-HUMAN and no UAT result is claimed.

## What was done

- `17-UAT-PROTOCOL.md`: setup, sections 1 to 8 (EN closures, silent letters, twin distinctness, PL digraphs, 30 s drift, barge-in x10, fallback honesty, FPS) each with trigger data, observation, binary PASS/FAIL, suspected module; section 9 maps the nine 07-04 checklist items; section 10 is the finding-triage evidence map. Control text is shared with the committed fixture `tests/fixtures/lipsync-corpus.json`.
- `17-VERIFICATION.md`: automated gates executed and recorded (suite 72 files / 669 tests, build and bundle numbers, `build:dict` idempotency re-run, hit-rate 96.4% with the disclosed caveat, PL control set, closure and distinctness proxies, settings migration, language gate). UAT table: every row PENDING (DEFERRED-HUMAN). Verdict PARTIAL (provisional until 17-06).

## Deviations from Plan

**1. Task 3 (execute the protocol live) not performed:** requires a human, a microphone, an EN agent and the MetaPerson model. Recorded as DEFERRED-HUMAN in every UAT row; nothing was confabulated, and the 07-04 items stay open (`07-04-SUMMARY.md` untouched, still `pending-uat`).
**2. Task 2 (cross-references in 07-VERIFICATION.md):** that file does not exist (07-04 never produced it); the mapping lives in protocol section 9 instead. Editing the Phase 07 artifacts was out of scope for this plan's `files_modified`.
**3. [Drift A1 #1] Section 1 criterion** is perceived closure (mouthClose <= 0.35, press >= 0.3, jaw <= 0.05; Balanced effective 0.30 / 0.348 / 0.02) instead of the stale "mouthClose >= 0.85".
**4. Section 5 reads the pre-rescale `raw=` ratio** added in 17-03; the post-rescale ratio is about 1.0 by construction.
**5. Gap found while filling the table:** the 17-CONTEXT T-8 item (a2f-parser: empty frames / duplicate frame_time / fps default) is owned by no Phase 17 plan; recorded as GAP in 17-VERIFICATION rather than silently ticked.
**6. Section 7 chip** depends on 17-06 (user-mode degradation chip).

## Known Stubs

None.

## Self-Check: PASSED
