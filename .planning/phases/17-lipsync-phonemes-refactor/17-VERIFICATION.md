---
phase: 17-lipsync-phonemes-refactor
type: verification
created: 2026-11-18
manual_uat: pending
---

# 17-VERIFICATION — Lip-sync & phoneme pipeline refactor

> Execute for real; fill actual results. Manual UAT items run via 17-UAT-PROTOCOL.md
> (17-05) — never confabulate outcomes.

## 1. Automated gates

| Gate | Evidence | Result |
|---|---|---|
| Full suite | `npm test` (incl. g2p-pl, alignment-normalize, golden-span, OOV suites) | ☐ |
| Build | `npm run build`; dist no longer contains the ~961 kB dict chunk; pruned artifact ≤ target gzip | ☐ |
| Prune idempotency | `npm run build:dict` twice → byte-identical artifact (17-01) | ☐ |
| Corpus hit-rate | measure script output: chosen N, hit-rate ≥ 95% (gate: 10k → else 20k) | ☐ |
| OOV coverage | island/listen/-tion/-sion/-stle/-ceipt tests green (LIP-02) | ☐ |
| Merge overflow fixed | MIN_SPAN renormalization tests + golden-span fixtures green (LIP-03) | ☐ |
| Closure computation | M/B/P effective mouthClose ≥ 0.85 @ balanced profile — computed test (LIP-04/T-10) | ☐ |
| Diphthong split | AY/AW → 2 spans each, timing within word window (LIP-04) | ☐ |
| PL control set | szczypczyzna/dziękuję/chata/ziarno/trzeba/chleb sequences green (LIP-05) | ☐ |
| testPhoneme delegation | poses read from tables, no duplicated literals (L-12/T-12) | ☐ |
| a2f-parser contracts | empty frames / dup frame_time / fps-default pinned (T-8) | ☐ |
| Normalizer extraction | T-1 matrix green; speech-backend holds no inline logic (LIP-06) | ☐ |

## 2. UAT results (17-05 protocol — fill from the real session)

| Section | Criterion | Result |
|---|---|---|
| §1 EN closures | bilabials fully close ×all sentences | ☐ PASS/FAIL |
| §2 Silent letters | know/though/listen/island/question — no phantom motion | ☐ |
| §3 Twin distinctness | S/SH, O/U, A/E distinguishable; EH/AE smile verdict recorded | ☐ |
| §4 PL digraphs | SZ/CZ sharp, DŹ soft, CH=[x], no false softness | ☐ |
| §5 30 s drift | ratio ±10%, no cumulative offset | ☐ |
| §6 Barge-in ×10 | neutral < 300 ms, 10/10 | ☐ |
| §7 Fallback honesty | jaw-only, chip visible, clears on recovery | ☐ |
| §8 FPS | ≥ 60 during speech | ☐ |

07-VERIFICATION pending items cross-referenced: ☐ (list which closed).

## 3. Bundle impact (the L-2 win)

| Metric | Before | After |
|---|---|---|
| Largest lazy chunk | 3.92 MB raw / 961 kB gzip (CMUdict) | ☐ |
| First render | ~750 kB | ☐ (unchanged expected) |
| Lexicon artifact | — | ☐ (raw/gzip of dict-en-pruned.json) |
| Parse time to first phoneme | ~286 ms | ☐ |

## 4. Docs sync checklist (17-06)

- [ ] docs/3: pipeline diagram incl. pruned lexicon + PL path; effective-value layering section
- [ ] en-visemes: §4 numbers = code reality; §5.5 status updated
- [ ] docs/4: correction-semantics paragraph
- [ ] 17-DRAFT-lipsync-deep-dive.md linked from README (Phase 13) once translated (Phase 12)

## 5. Cross-phase handoffs verified

- Phase 16: MIN_SPAN constants re-anchored if 16-04 landed first; testPhoneme delegation
  tested jointly.
- Phase 12: language gate allowlist paths updated if files relocated (g2p/* split).
- Phase 18: build:dict idempotency + golden-span tests are CI-promotion candidates.

## 6. Result

**Phase verdict:** ☐ PASS / PARTIAL / FAIL — filled at close, with per-plan SUMMARY links
and any FAIL findings tracked (severity + suspected module).
