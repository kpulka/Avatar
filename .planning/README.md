# Planning index

This directory is the project's planning record. It is written and maintained with the
GSD (Get Shit Done) workflow: every phase is discussed, planned, executed in small atomic
commits, and then verified. This page is the English entry point to that record.

## How the process works

Each roadmap phase lives in `phases/NN-name/` and moves through the same artifacts:

| Artifact | File pattern | What it is |
|---|---|---|
| Context | `NN-CONTEXT.md` | Decisions and scope agreed before planning: what the phase must deliver, the constraints, and the open questions. |
| Research | `NN-RESEARCH.md` | Findings gathered before planning (libraries, prior art, risks). Present only for some phases. |
| Patterns | `NN-PATTERNS.md` | Existing code patterns the phase should follow. Present only for some phases. |
| Draft | `NN-DRAFT-*.md` | Normative drafts a phase relies on, for example a glossary. |
| Plan | `NN-MM-PLAN.md` | An executable plan: frontmatter, ordered tasks, acceptance criteria, and the list of files it may touch. |
| Summary | `NN-MM-SUMMARY.md` | What was actually executed: commits, deviations from the plan, gate results. |
| Verification | `NN-VERIFICATION.md` | The verification checklist with recorded results. Human (manual) checks are listed separately and stay pending until someone performs them. |

`NN` is the phase number and `MM` the plan number within the phase. Decimal phases
(for example `11.1`) are urgent insertions made after the original roadmap was written.

Three living documents sit at this level:

- [ROADMAP.md](ROADMAP.md): the living plan. Phase list, progress table, execution order.
- [STATE.md](STATE.md): the current position, decisions, blockers, and pending todos.
- [REQUIREMENTS.md](REQUIREMENTS.md): requirement IDs and their status.
- [PROJECT.md](PROJECT.md): the project scope and constraints.

The repository also has [TODO_humanInTheLoop.md](../TODO_humanInTheLoop.md) at its root. It is
the checklist of tasks that only a person can do (installs, accounts, visual review, go/no-go
decisions), so it is kept where the owner will see it.

## Phase map

Status is taken from the progress table in [ROADMAP.md](ROADMAP.md).

| Phase | Title | Status |
|---|---|---|
| 1 | 3D foundation (Three.js scene, MetaPerson GLB, studio lighting) | Complete (2026-09-01) |
| 2 | Voice channel with ElevenAgents (raw WSS, microphone, gapless PCM playback) | Complete (2026-09-01) |
| 3 | Lip-sync and FaceController (alignment to ARKit visemes, coarticulation, blinking) | Complete (2026-09-01) |
| 4 | Barge-in and PoC polish (interruptions, robustness, metrics, acceptance criteria) | Complete (2026-09-01) |
| 5 | Realism and liveliness (pre-integrated SSS, PL lip-sync, procedural idle motion) | Complete (2026-09-01) |
| 6 | MVP productization (emotions, agent as code, signed URLs, UI, MVP criteria) | Complete (2026-09-01) |
| 7 | English phonetic lip-sync: flatness fix | Paused (UAT deferred until after Phase 10) |
| 8 | Unified animation track and barge-in (core, no GPU) | Code complete; UAT (08-04) pending |
| 9 | Local NVIDIA Audio2Face PoC (RTX 3090) | Not started (waiting for the CUDA/TensorRT environment) |
| 10 | A2F in the cloud: Cloud Run MVP (L4) | Not started (after the Phase 9 go/no-go) |
| 11 | UI with dual persona and a modular frontend (user/studio, scene presets) | Code complete (7/7); manual UAT pending |
| 11.1 | Hardening and bugfix pack (inserted) | Automated gates passed; manual UAT pending |
| 11.2 | Showcase pack (inserted) | In progress (wave 1 verified) |
| 12 | English language (i18n): docs, UI strings, comments, tests, language gate | Plans 12-01 to 12-07 executed; manual UAT pending |
| 13 | README for recruiters | Planned |
| 14 | Architecture: documentation, strictness, guards | Planned |
| 15 | Web UI refactor: design tokens, light theme, states, accessibility | Planned |
| 16 | Animation mechanics refactor: state machine, single writer, timebase | Planned |
| 17 | Lip-sync phoneme refactor: pruned CMU lexicon, PL G2P, quality harness | Planned |
| 18 | CI, security, license, deploy, hygiene | Planned |

Phases 01 to 11 have Polish folder names and Polish plan text. The phase numbers, the
requirement IDs, and the commit history are the reliable references for them.

## Language policy

The repository is English from Phase 12 onward. The planning record for phases 01 to 11
was written in Polish, and it stays that way on purpose:

- Phases 01 to 11 are a Polish historical record. They are kept as written, which is an
  accurate account of how the project was built.
- From Phase 12 (this phase) onward, new artifacts, code, comments, UI strings, tests, and
  documentation are in English.
- Translating the 01 to 11 archives would cost days of work, would destroy `git blame` on
  those files, and would risk semantic drift in normative requirement texts. A careless
  re-translation could silently change what was built.
- The living documents (ROADMAP, STATE, PROJECT, REQUIREMENTS) keep their existing Polish
  prose, and they converge to English as new phases are appended.
- Polish phonetic data is an exception everywhere: the Polish phoneme tokens that the lip-sync
  engine matches on, the sentiment keywords, and the Polish calibration sentence are functional
  data, not prose. The language gate allowlists them explicitly.

The language gate is `tests/language.test.ts`. It runs with `npm test` and checks two things:
no Polish diacritics outside the functional allowlist, and every relative `.md` link resolves.

## Document rename map (phase 12)

Phase 12 renamed the eight `docs/` files to English filenames with `git mv`, so their history
is preserved (`git log --follow` reaches the old names). Older phase archives still use the old
names. Use this map to resolve them:

| Old filename | Current filename |
|---|---|
| `docs/1-architektura-i-modele-3d.md` | `docs/1-architecture-and-3d-models.md` |
| `docs/2-integracja-elevenlabs-wss.md` | `docs/2-elevenlabs-wss-integration.md` |
| `docs/3-lip-sync-i-koartykulacja.md` | `docs/3-lip-sync-and-coarticulation.md` |
| `docs/4-audio-i-obsluga-przerwan.md` | `docs/4-audio-and-barge-in.md` |
| `docs/5-shadery-i-realizm.md` | `docs/5-shaders-and-realism.md` |
| `docs/6-analiza-opensource-i-rozwoj.md` | `docs/6-opensource-analysis-and-future.md` |
| `docs/A2F-LOCAL.md` | `docs/a2f-local-setup.md` |
| `docs/EN-visemes.md` | `docs/en-visemes.md` |

`docs/0-roadmap-poc-mvp.md` and `docs/7-audio2face-cloudrun.md` kept their names.

## Where to start

- To see what the project is and where it stands: [ROADMAP.md](ROADMAP.md), then [STATE.md](STATE.md).
- To see how the code is put together (layers, events, lifecycle, extension seams): [ARCHITECTURE.md](../ARCHITECTURE.md).
- To see how a phase was decided and checked: its `NN-CONTEXT.md` and `NN-VERIFICATION.md`.
  The English example is [phases/12-english-language/12-CONTEXT.md](phases/12-english-language/12-CONTEXT.md)
  and [phases/12-english-language/12-VERIFICATION.md](phases/12-english-language/12-VERIFICATION.md).
- For the normative English-to-Polish term list used in Phase 12: [phases/12-english-language/12-DRAFT-glossary.md](phases/12-english-language/12-DRAFT-glossary.md).
- Archives of phases 01 to 11 are read-only history. Do not rewrite them to match a newer convention.
