# Contributing

Thanks for your interest. This project is **All Rights Reserved** (see [LICENSE](LICENSE)). Contributions are accepted at the owner's discretion, and no contributor license terms are defined yet, so open an issue before starting any larger change.

## Prerequisites

- Node.js 20 or newer (the test runner, vitest 4, sets that floor).
- A WebGL-capable browser for manual checks.

## Setup and commands

Run these from the repository root:

```bash
npm install          # or `npm ci` for a reproducible install from package-lock.json
npm run dev          # dev server on http://localhost:5310 (port pinned in vite.config.ts)
npm test             # vitest: unit tests plus the language gate
npm run build        # tsc (strict) followed by the Vite production build
```

`npm run build` runs `tsc` first, so it is the type check. There is no separate typecheck script yet.

## Gates a change must pass

Before you open a pull request, run locally:

1. `npm run build` exits 0.
2. `npm test` exits 0. This includes the language gate in `tests/language.test.ts`, which requires English text in the enforced scopes (README, `docs/`, root documents) and resolves relative `.md` links.

A CI workflow is planned but not in the repository yet. Until it lands, these local runs are the only gates.

## Language

All documentation, code comments, UI strings and test names are in English. Phases 1 to 11 are kept in Polish as a historical record. Do not translate them unless the owner asks for it.

## Process

The project is planned and tracked with GSD (Get Shit Done). The decision log and phase map are in [`.planning/README.md`](.planning/README.md). You do not need the planning tooling to contribute. If you change behaviour, say which phase or issue it relates to in the commit message.

## Pull request rules

- Keep each commit focused, and use the Conventional Commits style that the history uses, for example `fix(lipsync): ...` or `docs(readme): ...`.
- Write commit messages and pull request text in English.
- Keep the gates above green.
- Do not commit local-only or generated artifacts. The following are already ignored in `.gitignore` and must stay out of the repository: `a2f/sdk/` (the NVIDIA Audio2Face SDK clone), `a2f/.venv/`, `node_modules/`, `dist/`, and `.env*` files with secrets.
- Do not add model or binary assets (other than the committed `public/models/avatar.glb`) without discussing them first.

## Security

Report vulnerabilities as described in [SECURITY.md](SECURITY.md), not in a public issue.
