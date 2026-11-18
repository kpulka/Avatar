---
phase: 13-readme-showcase
type: verification
created: 2026-11-18
manual_uat: pending
---

# 13-VERIFICATION — README recruiter showcase

> Execute for real; fill actual results. Human items stay PENDING — never confabulate.

## 1. Automated gates

| Gate | Evidence | Result |
|---|---|---|
| Language gate | README in enforced scope; diacritics = 0; link check green (skip-list = deep-dive TODOs only, or empty if 16-07/17-06 landed) | ☐ |
| Old falsehoods gone | `grep -n "dokumentacja (brak kodu)\|Etap: dokumentacja\|eksport modelu" README.md` → 0 | ☐ |
| Links | every README link resolves at HEAD (except documented slots) | ☐ |
| Assets (if 13-03 landed) | `assets/` present; hero ≤ 300 kB; GIF ≤ 3 MB; alt text on every image | ☐ |
| Suite | `npm test` green (gate scope change included) | ☐ |

## 2. Per-requirement acceptance

| Req | Check | Result |
|---|---|---|
| READ-01 | structure walk: hero → quickstart → status → decisions → architecture → docs → process → verification; body ≤ ~150 lines | ☐ |
| READ-02 | truthfulness checklist (13-01 SUMMARY) all green; status rows date-stamped; A2F rows labeled designed-not-running | ☐ |
| READ-03 | cold-clone record (13-02 SUMMARY): commands ran, avatar rendered, gates green; troubleshooting matches real error wording | ☐ |
| READ-04 | docs table = 10 canonical names + 2 deep dives (marked or live) | ☐ |
| READ-05 | assets within budget; GIF shows talk + barge-in; social card handed to 18-06 | ☐ |
| READ-06 | badge/demo slots present with exact URLs in comments; README ↔ ARCHITECTURE.md ↔ .planning/README.md links live | ☐ |

## 3. Manual UAT (human session — PENDING)

1. **30-second scan test**: show the README to someone (or self, cold) — can they say
   what the project is, that it works, and how to run it, in 30 seconds?
2. Visual pass (if assets landed): hero/GIF render correctly on github.com; light-theme
   shot matches the product.
3. English tone read-aloud (13-01 task 5 output) — writing-sample quality.

## 4. Cross-phase handoffs verified

- 12-04's conditional README step skipped/consumed (no double edit).
- 15→13-03 gate respected (assets captured only after 15 landed).
- 18-02/03/05 slot URLs documented and actionable.
- 16-07/17-06 deep-dive markers consumed when promotions land.

## 5. Result

**Phase verdict:** ☐ PASS / PARTIAL / FAIL — filled at close with per-plan SUMMARY links.
