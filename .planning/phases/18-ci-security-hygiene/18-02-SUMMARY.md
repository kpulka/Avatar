---
phase: 18-ci-security-hygiene
plan: 02
status: complete
type: execute
requirements: [QUAL-03, QUAL-04]
commits: 2
plan_head_before: 0a04806
plan_head_after: aa616c9
created: 2026-11-24
human_pending:
  - "LICENSE final wording and copyright line: owner approval DEFERRED-HUMAN"
---

# Phase 18 Plan 02: All Rights Reserved LICENSE, third-party notices, CONTRIBUTING

**The project is All Rights Reserved, per the owner decision of 2026-11-19 (not MIT). LICENSE, THIRD-PARTY-NOTICES.md (every license checked against the installed package manifests) and CONTRIBUTING.md are committed, and the README license section is filled.**

## Scope notes

- The plan body still says MIT, and its header and the 18-CONTEXT D2 record say MIT. Both are superseded by the owner's recorded decision (plan header, 2026-11-19), which is followed here. No MIT text was written.
- The plan's task 1 ("confirm MIT with the owner") is therefore closed by the recorded decision and not asked again.
- The license wording and copyright line are drafted, not owner-signed. Per the orchestrator instruction, the approval is recorded as DEFERRED-HUMAN and the work continues.
- The README edits are limited to the license section, as coordinated with Phase 14.
- Gates after the plan: `npm run build` exit 0; `npx vitest run --dir tests` 73 files, 678 tests passed; language gate 11/11. The gate's link check covers README's `.md` links, which include THIRD-PARTY-NOTICES.md. CONTRIBUTING.md is outside the gate's scope; its links (`.planning/README.md`, `LICENSE`, `SECURITY.md`) were checked by hand and exist.

## Changes

| File | Change |
|---|---|
| `LICENSE` (new) | Copyright (c) 2026 kpulka. All rights reserved. No license granted; commercial use by written permission via github.com/kpulka; third-party components keep their own terms; no warranty |
| `THIRD-PARTY-NOTICES.md` (new) | Direct deps (versions and licenses from installed `package.json`), transitive license counts, data and asset provenance, re-audit command, and what the repo does not distribute |
| `CONTRIBUTING.md` (new) | Prerequisites (Node 20+), the commands that exist (`dev`, `test`, `build`), gates, language rule, process pointer, PR rules, what not to commit, pointer to SECURITY.md |
| `README.md` | License section replaced: All Rights Reserved statement, link to LICENSE, link to THIRD-PARTY-NOTICES. The MIT placeholder comments are removed. No license badge (an ARR project has no OSI badge) |

## License audit (verified, not copied from 18-CONTEXT)

Method: each package's `license` field in `node_modules/<name>/package.json` compared with `package-lock.json`.

- 157 lock entries; 107 installed and checked: **0 mismatches**. 50 optional platform binaries are not installed on this machine; all 50 declare MIT in the lock.
- Declared license counts: MIT 134, Apache-2.0 7, BSD-3-Clause 4, ISC 4, MIT-0 2, BSD-2-Clause 2, BlueOak-1.0.0 1, CC0-1.0 1, 0BSD 1, (Apache-2.0 AND BSD-3-Clause) 1. No copyleft.
- **Correction to 18-CONTEXT §1.2:** `cmu-pronouncing-dictionary` is **ISC** (its `package.json` and `license` file), not BSD-2-Clause as the context states. Its readme says the underlying CMU dictionary data is public domain. Recorded in THIRD-PARTY-NOTICES.md.
- Direct versions recorded: three 0.174.0 (MIT), @elevenlabs/client 1.23.0 (MIT), cmu-pronouncing-dictionary 3.0.0 (ISC), typescript 5.9.3 (Apache-2.0), vite 6.4.3 (MIT), vitest 4.1.11 (MIT), jsdom 29.1.1 (MIT), @types/three 0.174.0 (MIT).
- Observed in passing: `@elevenlabs/client` is a runtime dependency that no file under `src/` imports. THIRD-PARTY-NOTICES.md states this and does not claim use.

## Open items (not blockers for this plan)

1. **Owner approval of the final LICENSE wording and copyright line: DEFERRED-HUMAN.** The holder line uses the public GitHub handle `kpulka` from the README clone URL, not a legal name. The owner should confirm the holder name and the wording of the "commercial use" paragraph.
2. **Model license:** `public/models/avatar.glb` (MetaPerson) is a third-party asset whose terms are not verified in the repository. THIRD-PARTY-NOTICES.md says so. The owner accepted responsibility on 2026-11-19 (18-CONTEXT §5). Verifying the actual terms is a separate task.
3. **Upstream CMU dictionary data:** the package readme says public domain. The upstream license was not re-checked beyond that statement.
4. README does not link CONTRIBUTING.md (the README edit was restricted to the license section). The owner or Phase 14 can add the link.
5. The README test count (417 / 66 files) is still stale (measured 678 / 73). Reported in 13-04 and 13-VERIFICATION.

## Deviations from Plan

- **MIT replaced by All Rights Reserved** (owner decision, plan header). Plan tasks 1–2 and the "MIT" wording in task 3 and the README comments were not followed as written.
- **Badge:** the plan asked for a license badge. None was added, because an All Rights Reserved project has no standard license badge and GitHub shows no license for it. The plan's acceptance check ("GitHub shows MIT") does not apply.
- **Notice content corrected:** cmu-pronouncing-dictionary is ISC, not BSD-2 (see audit).
- **CONTRIBUTING commands:** the plan listed `typecheck` and `lint`. Neither script exists yet (14-01 and 18-04 are pending), so CONTRIBUTING lists `build` (which runs tsc) and states that CI is planned.

## Self-Check

- [x] `LICENSE` present, All Rights Reserved per owner decision; README license section live
- [x] `THIRD-PARTY-NOTICES.md` matches the 2026-11-24 audit (verified, with the cmu correction); re-audit command tested
- [x] `CONTRIBUTING.md` covers setup, gates, process pointer, PR rules
- [x] Language gate green (11/11); build green; vitest 73 / 678
- [ ] Owner approval of final LICENSE wording: DEFERRED-HUMAN
