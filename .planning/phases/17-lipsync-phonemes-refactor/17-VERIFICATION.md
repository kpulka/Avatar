---
phase: 17-lipsync-phonemes-refactor
type: verification
created: 2026-11-18
updated: 2026-11-24
manual_uat: deferred-human
---

# 17-VERIFICATION - Lip-sync & phoneme pipeline refactor

> Automated rows below were EXECUTED in the worktree (evidence in the third column). Manual UAT rows were NOT
> executed: no person, microphone, agent or model was available to the executor. They are recorded as
> DEFERRED-HUMAN, never as PASS. Protocol: `17-UAT-PROTOCOL.md`.

Last executed gate (after plan 17-06): `npm run build` OK; `npx vitest run --dir tests` = 73 files / 678 tests
passed (baseline before Phase 17: 66 files / 417 tests).

## 1. Automated gates

| Gate | Evidence | Result |
|---|---|---|
| Full suite | `npx vitest run --dir tests`: 73 files / 678 tests (g2p-pl, lipsync-degradation-chip, speech-backend-alignment, lipsync-corpus, g2p-en OOV suites included) | PASS |
| Build | `npm run build` OK; the 3.92 MB / 961 kB gzip CMUdict chunk is gone, replaced by `dict-en-pruned-*.js` 259.03 kB / 64.51 kB gzip | PASS |
| Prune idempotency | `npm run build:dict` re-run at 17-05: output identical, `git status` clean (also checked at 17-01) | PASS |
| Corpus hit-rate | gate picked N=10,000: 96.4% on 1,010 corpus tokens (gate >= 95%); caveat: the curated core list's author had seen the corpus domain (17-01-SUMMARY deviation 3) | PASS (with disclosed caveat) |
| OOV coverage | island / listen / -tion / -sion / -stle / -ceipt and the `-ed` rule tests in `tests/g2p-en.test.ts` + `tests/fixtures/oov-wordlist.json` | PASS |
| Merge overflow fixed | soft 35 ms minimum renormalized inside the word, hard floor 17.5 ms; span-sum invariant in `tests/phoneme-merge.test.ts` and for all 20 golden cases | PASS |
| Closure computation | NOT the stale "mouthClose >= 0.85": perceived closure (close <= 0.35, press >= 0.3, jaw <= 0.05) computed in `tests/lipsync-corpus.test.ts`; balanced values 0.30 / 0.348 / 0.02 (DRIFT-A1 #1) | PASS (criterion corrected) |
| Diphthong split | AY -> AY+IH, AW -> AW+UH (60/40, `glideOf`), within the word window (`tests/phoneme-merge.test.ts`) | PASS |
| PL control set | szczypczyzna, dziekuje, chata, ziarno, zima, trzeba, chleb, kat, weze sequences in `tests/g2p-pl.test.ts` (no model) | PASS |
| testPhoneme delegation | `tests/face-controller-testphoneme.test.ts`: values read from the tables x profile scale, SPEAKING guard | PASS |
| a2f-parser contracts (T-8) | NOT COVERED: no Phase 17 plan owns it (P3 backlog in 17-CONTEXT); existing `tests/a2f-parser.test.ts` pins other contracts but not "empty frames / duplicate frame_time / fps default" | GAP (tracked, not in scope of plans 17-01..17-06) |
| Normalizer extraction | `tests/speech-backend-alignment.test.ts` matrix green; `speech-backend.ts` holds no inline normalization | PASS |
| Golden spans | `tests/lipsync-corpus.test.ts`: 20 cases, exact sequences + invariants; distinctness proxy with pinned near-twins | PASS |
| Settings migration | legacy `phoneme` -> `phoneme-en`, unknown -> default, pre-17-04 blob loads (`tests/settings-store.test.ts`) | PASS |
| Language gate | `tests/language.test.ts` Gate A / B green with NO new allowlist entry (Polish letters are `\uXXXX` escapes; docs use ASCII letter names) | PASS |
| Degradation chip | `tests/lipsync-degradation-chip.test.ts`: pure state machine + status-pill wiring (appears on fallback, clears after 2 clean chunks and on idle) | PASS |

## 2. UAT results (17-05 protocol)

None of the sections was executed. All are DEFERRED-HUMAN until a person runs `17-UAT-PROTOCOL.md`.

| Section | Criterion | Result |
|---|---|---|
| 1 EN closures | bilabials visibly close, no lip-on-nose artifact | PENDING (DEFERRED-HUMAN) |
| 2 Silent letters | know / though / listen / island / question - no phantom motion | PENDING (DEFERRED-HUMAN) |
| 3 Twin distinctness | S/SH, O/U, A/E distinguishable; EH/AE smile verdict recorded (computed baseline: closest non-twin pair 0.18; pinned twins ER-R 0.02, AY-EH 0.08, AH-K/G 0.12) | PENDING (DEFERRED-HUMAN) |
| 4 PL digraphs | SZ/CZ sharp, DZI soft, ch = [x], no false softness; A/B vs char path | PENDING (DEFERRED-HUMAN) |
| 5 30 s drift | pre-rescale `raw=` ratio within +/-10%, no cumulative offset | PENDING (DEFERRED-HUMAN, needs live agent) |
| 6 Barge-in x10 | face neutral < 300 ms, 10/10 | PENDING (DEFERRED-HUMAN, needs live agent) |
| 7 Fallback honesty | jaw-only, ALIGN badge, user-mode chip visible and clears | PENDING (DEFERRED-HUMAN); the chip is implemented (17-06) and DOM-tested, the eyes-on check is the open part |
| 8 FPS | >= 60 during speech | PENDING (DEFERRED-HUMAN) |

07-VERIFICATION pending items cross-referenced: `07-VERIFICATION.md` does not exist (07-04 stopped at status
`pending-uat`); the mapping of its nine checklist items to protocol sections is in `17-UAT-PROTOCOL.md`
section 9. None is closed yet. `07-04-SUMMARY.md` remains `pending-uat`.

## 3. Bundle impact (the L-2 win)

| Metric | Before | After |
|---|---|---|
| Largest lazy chunk | 3.92 MB raw / 961 kB gzip (CMUdict) | 259.03 kB raw / 64.51 kB gzip (`dict-en-pruned-*.js`) |
| First render (main chunk) | 190.97 kB raw / 57.18 kB gzip | 196.34 kB raw / 59.85 kB gzip (+5.4 kB for PL G2P, language dispatch, normalization, engine select) |
| Lexicon artifact | - | 269.0 kB raw / 64.7 kB gzip-9 (`dict-en-pruned.json`, 10,000 entries) |
| Lexicon parse + table build | ~286 ms | ~14.5 ms (Node measurement, 17-01) |
| `chunkSizeWarningLimit` | 4000 (hid the dictionary) | 700 (warns if the full dictionary returns) |

## 4. Docs sync checklist (17-06)

- [x] docs/3: pipeline diagram incl. pruned lexicon + PL path; effective-value layering section with the corrected worked example (0.50 x 0.60 = 0.30 close, 0.58 x 0.60 = 0.348 press)
- [x] en-visemes: section 3 M/B/P and the section 4 MBP row = code values, section 4 status note, section 5.5 status (AY/AW glide implemented), changelog rows
- [x] docs/4: `agent_response_correction` semantics paragraph (captions + emotion analysis only; audio/visemes are epoch-invalidated)
- [ ] 17-DRAFT-lipsync-deep-dive.md linked from README (Phase 13): NOT in this phase's scope (README is out of bounds for this run)

## 5. Cross-phase handoffs verified

- Phase 16: `testPhoneme` delegation is covered (17-02); MIN_SPAN constants are exported from `phoneme-merge.ts`.
- Phase 12: Gate A allowlist paths unchanged; no allowlist entry added by 17-01..17-04.
- Phase 18: `build:dict` idempotency and the golden-span tests are CI-promotion candidates.

## 6. Result

**Phase verdict:** PARTIAL. All six plans are implemented and every automated gate passes except the unowned
T-8 gap; every manual UAT section is DEFERRED-HUMAN and no UAT claim is made, so the phase cannot close as
PASS until a person runs `17-UAT-PROTOCOL.md`. Per-plan summaries: `17-01-SUMMARY.md` to `17-06-SUMMARY.md`.

No FAIL findings exist because nothing was run live; the first human session may produce them.

## Addendum 2026-11-24 (post-audit)

The T-8 gap is closed by commit 03bd9da. `tests/a2f-parser.test.ts` now pins empty frames, duplicate `frame_time`, absent `fps` (defaults to 60) and non-numeric `fps` (60). The parser needed no change. 17-05 live UAT remains DEFERRED-HUMAN.
