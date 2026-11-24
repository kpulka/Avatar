# Contributing

Thanks for your interest. This project is **All Rights Reserved** (see [LICENSE](LICENSE)). Contributions are accepted at the owner's discretion, and no contributor license terms are defined yet, so open an issue before starting any larger change.

## Prerequisites

- Node.js 20.19 or newer (ESLint 10 sets that floor; CI runs Node 22).
- A WebGL-capable browser for manual checks.

## Setup and commands

Run these from the repository root:

```bash
npm install          # or `npm ci` for a reproducible install from package-lock.json
npm run dev          # dev server on http://localhost:5310 (port pinned in vite.config.ts)
npm test             # vitest: unit tests plus the language gate
npm run build        # tsc (strict) followed by the Vite production build
npm run typecheck    # tsc over src AND tests (tsconfig.test.json)
npm run lint         # ESLint, zero warnings, includes the import-layer rule
npm run format:check # Prettier (npm run format rewrites)
npm run verify       # all of the above in one chain
```

The build runs `tsc` over `src` only; `npm run typecheck` also covers the tests.

## Gates a change must pass

Before you open a pull request, run locally:

1. `npm run verify` exits 0 (typecheck, tests, build, lint, format check).
2. Within it, `npm test` exits 0. This includes the language gate in `tests/language.test.ts`, which requires English text in the enforced scopes (README, `docs/`, root documents) and resolves relative `.md` links.

CI (`.github/workflows/ci.yml`) runs `npm ci`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` and `npm run build` on every push to `master` and every pull request. Run the same commands locally before you push.

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
