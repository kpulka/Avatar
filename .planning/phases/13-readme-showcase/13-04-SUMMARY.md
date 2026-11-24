---
phase: 13-readme-showcase
plan: 04
status: partial
type: execute
requirements: [READ-02]
commits: 2
plan_head_before: 0a04806
plan_head_after: eb8e993
created: 2026-11-24
---

# Phase 13 Plan 04: Docs truthfulness sweep and retrospective

**Sweep of the docs a reviewer opens next: four factual status fixes applied (docs/0, en-visemes, a2f-local-setup, a2f/README), one stale README count found and handed to the owner, and 13-VERIFICATION executed with a PARTIAL verdict. Staleness hooks and ROADMAP/STATE updates are orchestrator-level and are listed below, not applied.**

## Scope notes

- Base: `0a04806` (`implement/v1.1-refactor`, fast-forwarded from `d05a18b`; includes drift D2).
- Phase 12 docs waves had landed, so `docs/` is English and enforced by the language gate (`docs/all`). Every edit was checked by that gate.
- `README.md` was not edited. Coordination restricted README edits to the license slots (18-02) during this run, so the README count defect is handed over (see findings row 8).
- `.planning/ROADMAP.md` and `.planning/STATE.md` were not edited, as instructed. Intended updates are in "Handoffs".
- Gates: `npm run build` exit 0; `npx vitest run --dir tests` → 73 files, 678 tests passed (baseline unchanged); `npm test` exit 0; language gate 11/11.

## Sweep findings (claim → reality → disposition)

| # | Claim in doc | Reality (checked 2026-11-24) | Disposition |
|---|---|---|---|
| 1 | `docs/0`: plan-shaped, no status | PoC phases 1–4 and MVP phases 5–6 marked `[x]` in ROADMAP (2026-09-01); `04-VERIFICATION.md` and `06-VERIFICATION.md` both `status: passed`. Acceptance checkboxes in the doc were never ticked | **Fixed:** dated status preamble added, citing both VERIFICATION files |
| 2 | `docs/0`, `docs/2`, `docs/1`, `docs/6`: "Phase 2" | Used as the docs' own Stage-2 / directions label. Not framed as the current milestone. The name collides with GSD Phase 2 | No change. Backlog: rename to "Stage 2" for clarity (stylistic) |
| 3 | `docs/en-visemes` header: "right now some visemes are twin-like" | Phase 17 reworked the table; section 5 and the Phase 17 status notes record it | **Fixed:** past-tense pointer to section 5 and the Phase 17 notes |
| 4 | `docs/a2f-local-setup` §1: TensorRT "❌ missing" | §4 of the same doc and STATE (2026-09-12) say TensorRT 10.13.3.9 is installed via pip | **Fixed:** row now ✅ with source |
| 5 | `docs/a2f-local-setup` §2.1 "Current blocker (2026-09-11)" | STATE (2026-11-18) still lists the OOM blocker as open, pending owner consent | **Fixed:** relabelled "Last recorded blocker", states STATE's current status |
| 6 | `a2f/README` environment table: TensorRT missing; "Key blocker: CUDA 13.2 vs <13.0" | SDK built on CUDA 13.2 with a local workaround (`build-sdk.ps1`, docs §4) | **Fixed:** TensorRT row ✅; CUDA paragraph marked historical; current blocker stated |
| 7 | `a2f/README` steps status "Missing: TensorRT, HF login" (2026-09-11) | Superseded by STATE 2026-09-12: TRT, SDK build, A2F models (no token) done; A2E still gated | **Fixed:** status line updated (2026-11-24) |
| 8 | `README.md` lines 8 and 98: "417 tests in 66 files (measured 2026-11-24)" | Measured at HEAD `0a04806`: **73 files, 678 tests** | **NOT fixed here.** README edits restricted (coordination). Owner to apply after Phase 14 lands |
| 9 | `docs/3`: `src/audio/energy-fallback.ts`, "ALIGN: EL ✓ / FALLBACK ⚠", chip "Simplified lip-sync" | All three exist (`src/audio/energy-fallback.ts`; `src/app/copy.ts` strings) | Verified, no change |
| 10 | `docs/en-visemes` Phase 17 symbols: `PHONEME_POSES`, `PL_PHONEME_POSES`, `DIPHTHONG_END_POSES`, `tests/lipsync-corpus.test.ts` | All present in `src/lipsync/g2p/phoneme-visemes.ts` and `tests/` | Verified, no change |
| 11 | Repo paths cited in `docs/` and `a2f/README` | All exist except `a2f/fixtures/predict.sample.json` and `a2f/tools/extract_rig.py`. Both are future steps (09-01 dump; extract_rig postponed per STATE) | No change; a2f/README already labels the layout as "Target structure" |
| 12 | `docs/a2f-local-setup` has two sections numbered "5" | Cosmetic | Backlog (not a status claim) |
| 13 | `README` "Verification" section says `npm run build` runs `tsc` first | `package.json` build script: `tsc && vite build` (confirmed by a green build) | Verified, no change |

## Task 3: Retrospective (goal-backward)

Goal: "a README a reviewer can scan in 30 seconds and trust on every line."

Read cold, the README has these sentence classes:

- **Stamped and live:** status table rows (`Verified 2026-11-24`), the test count line, the port, the Node floor. The stamp lets a reader see when each claim was true.
- **Stable by nature:** project description, decision table, architecture paragraph (these describe design, not counts).
- **Could rot (residual risk):** the test count (already stale again today: 417/66 in the text vs 678/73 measured, so the count is the first thing that drifted), the status rows, the "Phase 1–11 Polish, 12+ English" statement, and the A2F status. The 30-second scan test is still pending a human.

Honest residual risk: the README is accurate on every claim checked by the 13-01 truthfulness checklist, but one number has already drifted within the same day it was written. Prevention is the orchestrator's staleness hook (task 2) plus a re-measure at each phase close. Those are process controls, not automated tests.

## Task 2: Staleness hooks (orchestrator-level, not applied)

Retro line to add to phases 15, 16, 17 and 18 (by the orchestrator, not by editing their files): "README rows affected by this phase? If yes, update the row and its Verified date. If the README test count changed, re-measure with `npx vitest run --dir tests`." Phases 15–18 each have at least one README row or slot. **Not confirmed by this executor.**

## Task 4: 13-VERIFICATION

Executed at `0a04806`: automated gates green except the README count (finding 8). Verdict **PARTIAL**. Manual UAT (30-second scan, visual pass, tone read-aloud) and all 13-03 asset items are PENDING, not confabulated. Details in `13-VERIFICATION.md`.

## Handoffs (not applied in this run)

- **ROADMAP.md, phase 13 block:** mark 13-04 as partial (task 2 and the ROADMAP/STATE updates open); phase verdict PARTIAL; 13-03 remains `blocked (human)`; 13-VERIFICATION manual UAT pending.
- **STATE.md:** record 13-04 partial; decisions: "docs/0 preamble cites phases 04/06 VERIFICATION; A2F status follows STATE, not the 2026-09-11 docs"; blocker: "13-03 visual assets blocked on human"; "README test count 417/66 stale vs 678/73, owner to apply after Phase 14".
- **Owner:** apply finding 8 (README lines 8 and 98) after Phase 14 lands; run the 30-second scan and the visual pass.

## Deviations from Plan

- **Task 1 (status):** plan said "PoC + MVP complete (2026-09)". The preamble states the verified facts instead (phases 1–6 complete 2026-09-01, with links), because the docs' own acceptance checkboxes were never ticked.
- **Task 1 (sweep):** plan named `a2f/README.md` status; the TensorRT and CUDA claims in `docs/a2f-local-setup.md` §1 were corrected too, because they contradicted the same doc's §4.
- **Task 4:** ROADMAP and STATE updates not applied (explicit instruction). Staleness hooks not applied (orchestrator-level).
- **Gate:** the README count was not corrected (coordination restriction). Recorded as a finding.

## Self-Check

- [x] `docs/0-roadmap-poc-mvp.md` status preamble present (commit `385c319`)
- [x] Sweep findings table with dispositions (above)
- [ ] Staleness hooks for phases 15–18 recorded (orchestrator to confirm)
- [x] 13-VERIFICATION executed; human items PENDING (commit `eb8e993`)
- [ ] ROADMAP/STATE updated (handed off by instruction)
