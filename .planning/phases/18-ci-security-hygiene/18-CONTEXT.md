---
phase: "18"
name: "CI, security, license, deploy, hygiene"
created: "2026-11-18"
updated: "2026-11-18"
---

# Phase 18: CI, security, license, deploy, hygiene — Context

The catch-all phase ("co jeszcze"): everything a public portfolio repo needs to be
**credible at a glance and safe by construction** — and none of which exists today.
Verified on 2026-11-18: no `.github/` (zero CI), no `LICENSE`, no `CONTRIBUTING.md`, no
`SECURITY.md`, no lint/format tooling, no deployed demo, and two working-tree hygiene
items predating this milestone. The README (13) has placeholder slots waiting on this
phase; the gates from 12/14 are designed to be picked up here.

**Priority order is deliberate: secrets first** (the repo is public — a scan is worth
more than a badge), then CI (makes every later claim verifiable), then license (a repo
without one is legally "all rights reserved" — the opposite of the portfolio intent),
then the rest.

---

## 1. Current-state inventory

### 1.1 What's missing (all verified absent at repo root)

| Item | Evidence | Consequence |
|---|---|---|
| CI | no `.github/` directory | no green check on any commit; "204 tests" is an unverifiable claim from a stranger's machine |
| LICENSE | not in root file list | default copyright = nobody may legally use the code; license badge/section in README impossible |
| CONTRIBUTING.md / SECURITY.md | absent | no disclosure policy; no dev-setup pointer for contributors |
| Lint/format | `package.json` scripts: `dev/build/preview/test` only | style consistency is manual; 14's layering contract has no editor feedback |
| Deployed demo | none | the strongest portfolio proof (a link) is missing |
| `.gitignore` completeness | exists; must be audited (dist/, .env, a2f/.venv, a2f/sdk coverage) | TBD in 18-06 |

### 1.2 Dependency license audit (DONE — evidence for 18-02)

`package-lock.json` license fields, all unique values: **MIT, Apache-2.0, BSD-2-Clause,
BSD-3-Clause, ISC, CC0-1.0, BlueOak-1.0.0, 0BSD, MIT-0, (Apache-2.0 AND BSD-3-Clause)**.
Zero copyleft (no GPL/AGPL/LGPL anywhere in the tree). Direct dependencies: runtime —
`three` (MIT), `@elevenlabs/client` (MIT), `cmu-pronouncing-dictionary` (BSD-2);
dev — `typescript` (Apache-2.0), `vite` (MIT), `vitest` (MIT), `jsdom` (MIT),
`@types/three` (MIT). **An MIT LICENSE for the project is compatible with everything it
ships.** (Owner decision D2 confirms the choice.)

### 1.3 Secrets & attack surface (scan targets for 18-01)

What legitimately lives in this repo vs. what must never:

| Kind | Policy |
|---|---|
| Public `agent_id` | **By design public** (ElevenLabs public agents; used in the Settings UI and `?agent_id=`; the embed-bridge allowlist holds *origins*, not agent ids). Documented as such — not a secret, but quota-relevant (see 1.4); restrict allowed domains/quotas in the ElevenLabs dashboard (amended 2026-11-19) |
| `xi-api-key` / any API key | NEVER in client code (ROB-03; signed-URL design). Scan must cover full **git history**, not just HEAD |
| Signed-URL backend endpoints | Must not appear hardcoded |
| `?parent_origin=` allowlist, `?allow_any_origin=1` | Hardened in 11.1-01: framed-parent source check, no referrer trust, `set_agent` removed, `allow_any_origin` dev-only. 18-01 verifies 11.1-01 shipped + documents it in SECURITY.md (amended 2026-11-19 — see 11.1/11.2) |
| `.env` files | Must not exist committed (scan + .gitignore) |

### 1.4 GitHub Pages demo — feasibility & the one open decision

Technically straightforward: `vite build` emits a static bundle; the demo-able surface
needs no backend (avatar renders from the GLB committed in 11.2 (SHOW-09); the SHOW-01 "Listen"
demo + synthetic A2F frames work offline). Owner takes responsibility for the model license
(2026-11-19), so the Pages demo ships the real avatar (amended 2026-11-19 — see 11.1/11.2). Constraints:

- **Base path**: Pages serves at `/Avatar/` → set `base: './'` (relative) or
  `/Avatar/` for the demo build only — keep the main build unchanged.
- **Size**: `avatar.glb` 11.9 MB (committed in 11.2, SHOW-09; possibly smaller if SHOW-09 compresses textures) in Pages is fine (limit 1 GB); CMU dictionary chunk is
  lazy — and Phase 17 replaces it with a pruned lexicon anyway.
- **The decision (owner)**: does the deployed demo expose a *live* conversation with the
  owner's public agent? A public agent on a public page = anyone can talk = **quota/cost
  exposure** (ElevenLabs Conversational AI is billed per usage). Recommendation
  (D4): **demo mode ships without conversation** — avatar + demo speech + synthetic A2F
  + a "bring your own agent_id" field (the user pastes *their* public agent_id; stored
  client-side only). Zero cost exposure, full feature demo. If the owner wants a live
  talk-to-it demo, they accept the quota risk explicitly and 18-05 wires a demo agent.

### 1.5 Hygiene inventory (working tree, 2026-11-18)

| Item | State | Disposition |
|---|---|---|
| `.planning/config.json` | modified (pre-session, model-override experiment) | Owner decision: commit as-is (it's the current tool config) or revert; 18-06 asks, doesn't decide |
| `.planning/config.json.bak-modeloverrides-20261109-020002` | untracked | Recommend delete after the config.json decision — a `.bak` in a public repo reads as noise |
| `TODO_humanInTheLoop.md` | root, translated by 12-07 | Stays at root (12-CONTEXT D4); 18-06 checks its header explains what it is for visitors |
| `.planning/phases/01–11` archives | Polish, historical | Stay (12-CONTEXT D2); v1.1 completion archives 12–18 the same way |
| Repo metadata (description/topics/social preview) | unset/unknown | 18-06 checklist: description, topics (`threejs`, `webgl`, `avatar`, `lipsync`, `elevenlabs`, `typescript`, `audio2face`, `real-time`), social card from 13-03 |

### 1.6 Size audit (repo footprint)

Tracked-size drivers: `public/models/avatar.glb` 11.9 MB, committed in 11.2 (SHOW-09) (accepted — it IS the zero-setup
quickstart; amended 2026-11-19), `package-lock.json`, docs (small), `.planning` (small text). Untracked-by-
design: `a2f/sdk/` (2 GB) and `a2f/.venv/` — must never enter git (verify
`git ls-files a2f/` shows only scripts/docs/README, not sdk/.venv). Fresh clone ≈ 13 MB —
fine.

---

## 2. Problems & risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R-1 | A secret already sits in git **history** (past commit, since removed) | HIGH | 18-01 scans full history, not just HEAD; if found: rotate the credential FIRST, then decide on history rewrite (breaking decision — owner) |
| R-2 | Public demo burns ElevenLabs quota | HIGH | D4 default: no conversation in demo mode; live-agent variant only on explicit owner opt-in |
| R-3 | CI flakes on Windows-vs-Linux path separators in fs-based tests (language/layering gates) | MEDIUM | 18-03 runs ubuntu-latest; gates must use path-join/normalize (verify in 18-03's first run — a red first run is a finding, not a failure) |
| R-4 | ESLint adoption produces a giant reformat commit that pollutes blame | MEDIUM | Two commits: (1) lint config + rule violations fixed, (2) Prettier one-shot format sweep — clearly labeled, never mixed with logic changes |
| R-5 | `typescript-eslint` strict-type-checked conflicts with `noUncheckedIndexedAccess` etc. | LOW | 14-01 already made the codebase pass the strictest flags; start with recommended + type-checked, dial to zero errors in-plan |
| R-6 | Pages demo drifts from the main build (two configs) | MEDIUM | Demo build = same code + `?demo=1` runtime flag + `base` override in a dedicated workflow step; no source forks |
| R-7 | Badge URLs in README (13) rot if workflow filename changes | LOW | 13-01 documented the exact URL in the slot comment; this phase uses it verbatim |
| R-8 | CI minutes wasted on a2f/ or asset uploads | LOW | CI runs only npm pipeline (no GPU tests — a2f is out of scope by design); artifact upload limited to dist |

---

## 3. Scope decisions

**D1 — Security before shine.** The phase's first plan is the secrets scan; nothing else
ships before it's clean (a public repo with a shiny badge over a leaked key is worse than
one without either).

**D2 — Project license: MIT** (recommended, pending owner confirmation in 18-02).
Rationale: matches the whole dependency tree (all permissive, audited in §1.2), minimal
friction for portfolio reuse, recognized at a glance. THIRD-PARTY-NOTICES.md carries the
dependency table from §1.2 with the audit date.

**D3 — CI is boring on purpose.** One workflow, ubuntu-latest, Node 22 (LTS), steps:
checkout → setup-node with npm cache → `npm ci` → `npm run typecheck` → `npm test` →
`npm run build` → dist artifact upload. No matrix gymnastics, no Docker, no GPU jobs (a2f
is explicitly out of CI scope — it needs an RTX 3090 and 2 GB of vendored SDK, which is
the opposite of a fast public CI).

**D4 — Demo mode: no live conversation by default.** The Pages deployment ships avatar +
demo speech + synthetic A2F + bring-your-own-agent_id field. A live talk-to-it demo
requires the owner's explicit quota-cost acceptance (recorded in the plan at execution
time).

**D5 — ESLint mirrors the existing gates; Prettier formats once.** The layering rule
imports `tests/layering-rules.ts` (14-02's data contract) — one source of truth. Prettier
config matches current style (printWidth 100, single quotes) so the one-shot sweep is
small. Both land as devDependencies with `npm run lint` / `npm run format:check`, wired
into CI.

**D6 — Hygiene asks, never assumes.** The `.bak` file and the modified `config.json` are
owner property; 18-06 records the decision, and only executes what the owner chose.

---

## 4. Proposed requirements

- **QUAL-01 Secrets & security**: full git-history scan (gitleaks or equivalent patterns
  for `xi-api-key`, `sk-`, API-key shapes, `.env` contents) → zero findings; `.env`
  gitignored; `SECURITY.md` published (disclosure contact, scope, the public-agent-id
  policy); no credentials in client code (re-verified).
- **QUAL-02 CI**: `.github/workflows/ci.yml` — `npm ci` → typecheck → test → build on
  push + PR (ubuntu, Node 22, npm cache); green on main; badge URL in README slot; total
  runtime budget ≤ ~3 min.
- **QUAL-03 License**: `LICENSE` (MIT, owner-confirmed) + `THIRD-PARTY-NOTICES.md`
  (dependency license table, audit date 2026-11-18, all-permissive statement) + README
  license section filled.
- **QUAL-04 CONTRIBUTING**: dev setup (Node 20+, install, the four commands), gates
  overview (tests/language/layering/typecheck), GSD process pointer, PR expectations
  (green CI, focused commits).
- **QUAL-05 Lint/format**: ESLint (flat config, typescript-eslint) with the layering rule
  sourced from `tests/layering-rules.ts`; Prettier; `npm run lint` / `format:check`
  green; two labeled commits (violations-fix, one-shot format); CI runs both.
- **QUAL-06 Pages demo**: demo build (`?demo=1` behavior + base-path override) deployed
  on every push to main via a dedicated workflow; demo = avatar + demo speech +
  synthetic A2F + bring-your-own agent_id (no live conversation unless owner opted in);
  linked from README slot.
- **QUAL-07 Hygiene & metadata**: `.bak` resolved per owner decision; `.gitignore`
  audited (dist, .env, a2f/.venv, a2f/sdk — `git ls-files a2f/` shows no sdk/.venv
  files); repo description + topics + social preview set (from 13-03's card);
  `TODO_humanInTheLoop.md` header explains itself to visitors.
- **QUAL-08 Anyone-can-verify**: `npm run verify` umbrella (typecheck + test + build +
  lint) documented in README §Verification; a fresh clone with only Node.js passes it
  (proven by 13-02's cold run + first CI run on a clean checkout).

---

## 5. Plans & sequencing

| Plan | Wave | Owns | Requirements |
|---|---|---|---|
| 18-01 | 1 | Secrets scan + SECURITY.md | QUAL-01 |
| 18-02 | 1 | LICENSE (MIT) + THIRD-PARTY-NOTICES + CONTRIBUTING | QUAL-03, QUAL-04 |
| 18-03 | 2 | CI workflow + badge | QUAL-02 |
| 18-04 | 2 | ESLint + Prettier (imports 14-02 rule data) | QUAL-05 |
| 18-05 | 3 | Pages demo (demo mode + deploy) | QUAL-06 |
| 18-06 | 3 | Hygiene, metadata, size audit | QUAL-07 |
| 18-07 | 4 | `npm run verify` umbrella + retrospective & milestone close-out prep | QUAL-08, process |

Sequencing: 18-01 before everything (D1); 18-03 needs 14-01's `typecheck` script to
exist (14 in flight — the workflow file can land with typecheck commented as
`TODO(14-01)` if 14 lags; recommended: 14-01 first). 18-04 needs 14-02's rule data.
18-05 needs 13-01's demo slot + D4 decision recorded. 18-07 is the milestone's last
executable plan and hands off to `/gsd-complete-milestone`.

---

## 6. Cross-area notes (for the orchestrator)

1. **14-01/14-02 dependencies** — CI and ESLint consume their outputs; if Phase 14 hasn't
   landed when 18 starts, sequence 18-03/18-04 behind it (the workflow without typecheck
   is a wasted badge).
2. **13-01 slots** — every slot this phase fills has its exact URL/text documented in the
   README placeholder comments; filling is mechanical.
3. **12-01 language gate** — CI just runs `npm test`; the gate is already inside. The
   "English ✓" badge idea (12-CONTEXT §6.3) is optional shine — only if free.
4. **17-01** — if the pruned lexicon landed, the Pages demo size note in the README
   updates automatically via ARCHITECTURE.md link (no action here).
5. **Human-in-the-loop items** — quota decision (D4), license confirmation (D2),
   `.bak`/config.json disposition (D6): collect all three in ONE ask at phase start, not
   three interruptions.
