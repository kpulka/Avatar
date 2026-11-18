---
phase: 14-architecture-guards
type: verification
created: 2026-11-18
manual_uat: pending
---

# 14-VERIFICATION — Architecture: documentation, strictness, guards

> Execute for real; fill actual results. Human items stay PENDING — never confabulate.

## 1. Automated gates (final state)

| Gate | Evidence | Result |
|---|---|---|
| Typecheck | `npm run typecheck` (src+tests, `noUncheckedIndexedAccess`) exits 0 | ☐ |
| Zero `any` | `grep -rn "as any\|: any\|@ts-ignore" src/` → 0 matches | ☐ |
| Tests | `npm test` green (count recorded post-model-cache deletion; layering gate + dispose regression included) | ☐ |
| Build | `npm run build` green | ☐ |
| Layering gate | `tests/layering.test.ts` passes; negative self-test catches synthetic `features→ui`; exceptions list = the 3 documented groups | ☐ |
| Lifecycle | container dispose regression: `afterStart > 0` → `handlerCount() === 0`; second dispose no-throw | ☐ |
| Deletions | `Test-Path src/audio/eleven-client-smoke.ts, src/avatar/model-cache.ts, tests/model-cache.test.ts` → all False; importer greps → 0 | ☐ |
| Language gate | `ARCHITECTURE.md` in enforced scope; diacritics = 0 | ☐ |
| Cycles | no new import cycles (layering gate fails on one by construction) | ☐ |

## 2. Per-requirement acceptance

| Req | Check | Result |
|---|---|---|
| ARCH-01 | layer doc section matches `tests/layering-rules.ts` data; gate green; no undocumented exceptions | ☐ |
| ARCH-02 | typecheck script in package.json; flag on; D6 comment present; 3 casts typed (grep = 0) | ☐ |
| ARCH-03 | dispose regression test green; `handlerCount` unit-tested; Unsub pattern documented in ARCHITECTURE.md | ☐ |
| ARCH-04 | 16-event catalog in ARCHITECTURE.md, each producer backed by a fresh `emit(` grep (listed in 14-05 SUMMARY) | ☐ |
| ARCH-05 | modules deleted; legacy-bridge REMOVE WHEN/HOW block present; unused-export sweep findings dispositioned | ☐ |
| ARCH-06 | composition-root section exists; side-effect rule green; `main.ts` ≤ ~100 lines | ☐ |
| ARCH-07 | 5 extension recipes with file lists | ☐ |
| ARCH-08 | `ARCHITECTURE.md` at root, English, linked from `.planning/README.md` (README link per 13-01) | ☐ |

## 3. Manual UAT (human session — PENDING)

1. Cold-open review: 10 minutes with ARCHITECTURE.md + the repo — does a reader who
   hasn't built it understand layers, events, lifecycle, and where to add a panel?
   (The doc's real acceptance test.)
2. `npm run dev` after the deletions — app boots, avatar loads, conversation + demo
   animation unaffected (dead code really was dead).

## 4. Cross-phase handoffs verified

- 16-02/16-04: no file collisions (14 touched container only additively; audio-engine
  untouched) — confirm at 16's start.
- 18-04: `tests/layering-rules.ts` importable from an ESLint flat config (shape check).
- 13-01: README→ARCHITECTURE.md link slot filled.
- v1.2 backlog recorded: a2f-backend relocation, exactOptionalPropertyTypes re-eval.

## 5. Result

**Phase verdict:** ☐ PASS / PARTIAL / FAIL — filled at close with per-plan SUMMARY links.
