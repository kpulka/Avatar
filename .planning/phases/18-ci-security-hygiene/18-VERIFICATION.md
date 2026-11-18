---
phase: 18-ci-security-hygiene
type: verification
created: 2026-11-18
manual_uat: pending
---

# 18-VERIFICATION — CI, security, license, deploy, hygiene

> Execute for real; fill actual results. Human items stay PENDING — never confabulate.

## 1. Automated gates

| Gate | Evidence | Result |
|---|---|---|
| Secrets | scan record (18-01 SUMMARY): tool + HEAD + full history → 0 findings | ☐ |
| `xi-api-key` policy | `grep -rn "xi-api-key" src/` → policy comments only | ☐ |
| CI green | first (and current) green run URL on main; runtime ≤ ~3 min | ☐ |
| Lint/format | `npm run lint` + `npm run format:check` green; layering rule = same data as the test | ☐ |
| Verify umbrella | `npm run verify` green; duration recorded | ☐ |
| Tracked-tree hygiene | `git ls-files a2f/` → scripts/docs only; no dist/.env/.pem/.key tracked | ☐ |
| Demo | Pages URL responds; cold-profile checklist green (render, demo speech, interrupt, studio) | ☐ |
| Suite | `npm test` green throughout (no lint adoption regressions) | ☐ |

## 2. Per-requirement acceptance

| Req | Check | Result |
|---|---|---|
| QUAL-01 | SECURITY.md live; .env ignored; scan documented | ☐ |
| QUAL-02 | badge in README + green workflow | ☐ |
| QUAL-03 | LICENSE (owner-confirmed) detected by GitHub; THIRD-PARTY-NOTICES matches audit | ☐ |
| QUAL-04 | CONTRIBUTING complete (setup, gates, process, PR rules) | ☐ |
| QUAL-05 | two labeled commits; single-source layering rule proven (negative test) | ☐ |
| QUAL-06 | demo live; no owner credential in demo build (or D4 variant recorded) | ☐ |
| QUAL-07 | dispositions executed; metadata checklist delivered; size table recorded | ☐ |
| QUAL-08 | cold clone (13-02) + first CI run prove fresh-clone verifiability | ☐ |

## 3. Manual UAT (human session — PENDING)

1. Repo page as a stranger: badge green, license detected, social preview set, demo link
   works — the "credible at a glance" pass.
2. Demo on a phone/second machine: avatar renders, demo speech plays (Pages performance
   sanity).
3. Owner: metadata items executed (description, topics, preview) — the checklist from
   18-06 SUMMARY.
4. Owner: quota decision (D4) and hygiene dispositions (D6) recorded as actually theirs.

## 4. Cross-phase handoffs verified

- 14-01/14-02 outputs consumed (typecheck step, layering rule data) — single source held
- 13-01 slots all filled: CI badge, license, demo link (social preview via 18-06)
- 12-01 language gate running inside CI; link gate green with skip-lists consumed
- Milestone close-out prep (18-07 task 6) delivered to `/gsd-complete-milestone`

## 5. Result

**Phase verdict:** ☐ PASS / PARTIAL / FAIL — filled at close with per-plan SUMMARY links.
