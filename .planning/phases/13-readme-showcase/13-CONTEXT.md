---
phase: "13"
name: "README — recruiter showcase"
created: "2026-11-18"
updated: "2026-11-18"
---

# Phase 13: README — recruiter showcase — Context

The README is the single most-viewed file in a public portfolio repo, and the current one
fails twice: it is Polish (audience is English-speaking recruiters — the umbrella problem
Phase 12 solves for everything else), and it is **materially false** about the project's
state. This phase produces an English README that a reviewer can scan in 30 seconds and
trust on every line — with visual assets scheduled behind Phase 15 (light-theme fix) and
badge/demo slots wired for Phase 18.

Analysis is read-only; every claim below cites the evidence it was verified against on
2026-11-18.

---

## 1. Current-state audit of README.md

### 1.1 Shape

87 lines, Polish, five sections: *O Projekcie* (:3-9), *Stack technologiczny* (:13-24),
*Kluczowe Decyzje Architektoniczne* (:28-37), *Architektura* ASCII diagram (:41-64),
*Struktura Dokumentacji* table (:68-81), *Status projektu* (:84-87). Tone and content are
good — the stack table and decisions matrix are genuinely recruiter-legible. The problem
is language, staleness, and what's missing (visuals, quickstart, proof-of-life signals).

### 1.2 Truthfulness findings (the core problem)

| Line | Claim | Reality (verified) | Severity |
|---|---|---|---|
| :86 | "**Etap: dokumentacja** (brak kodu w repo)" — documentation stage, no code in repo | **78 source modules, 41 test files, 204 passing tests**, GSD phases 1–8 + 11 implemented; the app runs | CRITICAL — reads as "vaporware" exactly when the repo is full of working code |
| :87 | Prerequisites: "eksport modelu MetaPerson `.glb`" (you must export a model) | `public/models/avatar.glb` (**11.9 MB**) is committed — the avatar renders with zero setup after `npm install && npm run dev` (verified in 15-CONTEXT scoping) | HIGH — invents a barrier that doesn't exist |
| :74-80 | docs table lists pre-rename filenames | 12-01 renames 8 of 10 docs (canonical map, 12-CONTEXT §1.1) | MEDIUM — mechanical, 12-04's conditional step or this phase |
| :83 | Architecture section presents FaceController/AudioEngine as current | True and current (single-writer, one clock, epoch) — but lacks the studio/user layers, compare flow, A2F track added in F8/F11 | LOW — needs extension, not correction |
| — | No mention of tests/CI/gates | 204 tests + language/layering gates (12-01, 14-02) are the repo's best credibility signals | HIGH (omission) |
| — | No visual (screenshot/GIF), no quickstart, no license | The three things a 30-second reviewer looks for first | HIGH (omission) |

### 1.3 Verified quickstart facts (the README's backbone)

- **Commands:** `git clone https://github.com/kpulka/Avatar.git` → `npm install` →
  `npm run dev`. Dev server: **port 5310, `strictPort: true`** (vite.config.ts:6-7 — 3000
  is occupied by another project on the dev machine; document the URL as
  `http://localhost:5310`).
- **Zero setup for the visual:** the real MetaPerson avatar (`public/models/avatar.glb`,
  11.9 MB, in-repo) loads automatically at startup (`container.ts` `start()` →
  `loadDefaultAvatar()`); loader overlay hides on `avatar:loaded`.
- **To talk:** a **public `agent_id`** of an ElevenLabs Conversational AI agent in
  Settings + mic permission. Without it, everything else still works (below).
- **Works with no agent/backend at all:** demo speech (Animation panel → demo utterance),
  synthetic A2F frames demo (Animation panel), demo-avatar fallback (Scene panel),
  calibration/viseme tweaker studio (`?studio=1` or Ctrl+Shift+D), scene presets,
  presentation mode (H/Esc).
- **Node:** 20+ (Vite 6 requirement).

### 1.4 Dependencies on sibling phases (what gates what)

| Asset | Gated by | Why |
|---|---|---|
| Screenshots / GIF (hero) | **Phase 15** | Light theme is currently broken (150 raw hex colors, no token system — 15-CONTEXT); screenshots before 15 would showcase a broken light mode or an unpolished dark one |
| CI badge | **Phase 18 (18-03)** | Workflow must exist before the badge URL resolves |
| License badge + section | **Phase 18 (18-02)** | LICENSE file lands there |
| Live demo link (GitHub Pages) | **Phase 18 (18-05)** | Pages deploy + demo-mode |
| CMU dictionary numbers | **Phase 17 (17-01)** | Full dict (961 kB gzip lazy) → pruned lexicon; README should link ARCHITECTURE.md §8 instead of hardcoding sizes that drift |
| Deep-dive links | 16-07 / 17-06 (promotions) | `docs/animation-runtime.md` (from 16-DRAFT) and `docs/lipsync-deep-dive.md` (from 17-DRAFT) — README links them; if promotion hasn't landed, link the plan-checked target paths and mark "(landing in v1.1)" |

### 1.5 Audience model (drives structure)

A technical recruiter or senior engineer scanning a GitHub profile: (1) 30 seconds —
*what is it, does it work, does it look good*; (2) 2 minutes — *is the engineering
credible* (tests, CI, architecture doc, commit hygiene); (3) deep dive — docs links.
Structure therefore: hero line + visual FIRST, quickstart SECOND (proof it runs),
credibility signals (tests/gates/badges) visible without scrolling, everything else
linked, not inlined. Target: ≤ ~150 lines of body.

---

## 2. Problems & risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R-1 | New README goes stale the same way (claims rot as phases land) | HIGH | READ-02 rule: status table rows carry "verified YYYY-MM-DD" stamps; 13-04 retro adds a README-claims check to each sibling phase's close-out |
| R-2 | Visual assets block the whole phase on Phase 15 | MEDIUM | 13-01 ships the README with working text + placeholder slots; 13-03 is a separate, explicitly gated plan — the phase completes even if capture waits |
| R-3 | GIF/screenshot size bloats the repo | LOW | assets/ budget: hero screenshot ≤ 300 kB (PNG, optimized), GIF ≤ 3 MB / ≤ 6 s, or an external capture link if larger; social preview 1200×630 |
| R-4 | English polish (the README is also a writing sample) | MEDIUM | 13-01 requires one read-aloud pass + the 12-DRAFT glossary terms; native-tone check in UAT (13-VERIFICATION §3) |
| R-5 | Overclaiming experimental work (A2F local/cloud not yet running) | HIGH | READ-02: status table separates **Working / Experimental / In flight**; A2F rows say "designed, not yet wired" |
| R-6 | Collision with 12-04 (README filename-link repair) | LOW | 12-04's README step is conditional and skipped if 13 lands first (already flagged in 12-04); recommended order: 12 → 13 so the docs table starts from canonical names |

---

## 3. Scope decisions

**D1 — Rewrite in place, keep it one file.** No `docs/README-*.md` split, no landing-page
frameworks. GitHub renders README.md first; everything else is a link away. The current
file's good bones (stack table, decisions matrix) are translated and adapted, not
discarded — the decisions matrix becomes "Key decisions & rejected alternatives" (its
honest "odrzucona alternatywa" column is a differentiator worth keeping).

**D2 — Visuals are slots until Phase 15 lands.** The README ships with a documented
placeholder block (`<!-- 13-03: hero screenshot -->`) so the phase is not blocked; 13-03
executes after 15 and swaps slots for assets. Dark-theme-first capture (the product's
primary look), one light-theme shot when 15 makes it real.

**D3 — Truthfulness is a hard requirement, not a nicety.** Every factual claim in the
new README must be verifiable the day it's written (command output, file path, gate
result). The "documentation stage" lie gets replaced by an honest, dated status table.
Where a fact is volatile (chunk sizes, test counts), the README states the stable thing
("test suite + gates run on every push") or links the living source (ARCHITECTURE.md).

**D4 — The process IS a portfolio feature.** The GSD `.planning/` discipline (phases,
CONTEXT/PLAN/VERIFICATION artifacts, decision logs) is unusual and impressive — the README
gets a short "How this repo is run" section linking `.planning/README.md` (12-07), sized
at 5-6 lines, not a wall of process.

**D5 — No i18n of the README.** One language: English (the owner reads both; recruiters
read one). The Polish original lives in git history; no language switcher.

---

## 4. Proposed requirements

- **READ-01** — English README at repo root, recruiter-structured: hero (one-sentence
  value + visual slot), verified quickstart (≤ 4 commands + "what you'll see"), feature
  highlights (conversation, EN phoneme lip-sync, PL digraphs, barge-in, dual UI,
  A/B compare, studio), key decisions table (choice + rejected alternative + why),
  architecture summary (≤ 10 lines + link to ARCHITECTURE.md), docs index, honest status
  table (Working / Experimental / In flight, date-stamped), how-this-repo-is-run (GSD
  pointer), license. Body ≤ ~150 lines.
- **READ-02** — Truthfulness: zero stale claims (the "documentation stage" and
  "you must export a model" falsehoods are gone); every factual claim verified at
  writing; volatile facts linked to living sources instead of inlined; status rows
  date-stamped; experimental work (A2F local/cloud) labeled as designed-not-running.
- **READ-03** — Quickstart reproducibility: the printed commands executed from a **cold
  clone** (fresh directory, no prior install) and recorded (13-02); troubleshooting
  block covers the three real friction points (agent_id for conversation, mic permission,
  port 5310 busy → how to change it).
- **READ-04** — Docs index: all 10 canonical (post-12-01) doc names + one-line
  descriptions + the two deep dives (`docs/animation-runtime.md`,
  `docs/lipsync-deep-dive.md`, marked "landing in v1.1" until 16-07/17-06 promote them);
  link integrity covered by the 12-01 gate once README is in enforced scope.
- **READ-05** — Visual assets (after Phase 15): ≥ 1 hero screenshot (dark), ≥ 1 GIF of
  talking + barge-in (≤ 6 s), 1 light-theme shot, social preview card 1200×630; stored
  under `assets/`; sizes within budget (hero ≤ 300 kB, GIF ≤ 3 MB); alt text on every
  image.
- **READ-06** — Credibility wiring: badge slots for CI (18-03) and license (18-02) with
  exact URLs documented in the placeholder comments; demo-link slot (18-05); README
  linked from `.planning/README.md` and ARCHITECTURE.md; `lang` of the page implied EN
  throughout (headings, comments, alt text).

---

## 5. Plans & sequencing

| Plan | Wave | Owns | Requirements |
|---|---|---|---|
| 13-01 | 1 | README rewrite from 13-DRAFT (text + slots + canonical links) | READ-01, READ-02, READ-04, READ-06 |
| 13-02 | 1 | Cold-clone quickstart verification + troubleshooting block | READ-03 |
| 13-03 | 2 (gated on Phase 15) | Capture checklist: screenshots, GIF, social preview; swap slots for assets | READ-05 |
| 13-04 | 3 | Docs truthfulness sweep (docs/0 status claims, stale "Faza 2" phrasing) + retrospective & correction | READ-02 (docs side), process |

**Sequencing:** recommended order **12 → 13** (canonical doc names exist; the language
gate can then include README in enforced scope). 13-01 does not wait for 15/17/18 — slots
and links are designed to be filled without restructuring. 13-03 hard-depends on 15.
13-04 runs after 12's translation waves (it audits the translated docs' truthfulness).

---

## 6. Cross-area notes (for the orchestrator)

1. **12-04** — its README step (filename-link repair) is skipped if 13-01 lands first
   (already conditional in 12-04). If 12 lands first, 13-01 starts from the repaired
   table.
2. **14-05** — ARCHITECTURE.md links to README and vice versa; whichever lands second
   adds the reciprocal link (single line, no conflict).
3. **18-02/18-03/18-05** — fill the badge/demo slots; the placeholder comments carry the
   exact URLs so 18 tasks are mechanical.
4. **16-07 / 17-06** — doc promotions; README's deep-dive links target the final paths
   with a "(landing in v1.1)" marker removed by those plans.
5. **Language gate** — once 13-01 lands, README leaves the gate's temporary exemption
   list (12-01 design) and enters enforced scope.
