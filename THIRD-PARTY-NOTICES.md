# Third-party notices

This file lists the third-party software that this project depends on, with the license each one declares. The project's own license is in [LICENSE](LICENSE) (All Rights Reserved). Third-party components keep their own licenses.

## How the licenses were verified

- Audit date: 2026-11-24, at commit `0a04806` (`implement/v1.1-refactor`).
- Source of truth: the `license` field in each package's own `package.json` under `node_modules/`, compared with the `license` field recorded in `package-lock.json` (lockfileVersion 3).
- Result: all 107 installed packages match their lockfile entry. No mismatches.

Re-audit the counts (Node.js, from the repository root; prints the count per declared license):

```bash
node -e "const l=require('./package-lock.json');const c={};for(const[k,m]of Object.entries(l.packages)){if(!k)continue;const v=typeof m.license==='string'?m.license:JSON.stringify(m.license);c[v]=(c[v]||0)+1}console.log(c)"
```

## Direct dependencies

| Package | Version | Scope | License | Declared in |
|---|---|---|---|---|
| `three` | 0.174.0 | runtime | MIT | `dependencies` |
| `cmu-pronouncing-dictionary` | 3.0.0 | build time and tests | ISC | `devDependencies` (data is used to build `src/lipsync/g2p/dict-en-pruned.json`) |
| `@types/three` | 0.174.0 | development | MIT | `devDependencies` |
| `typescript` | 5.9.3 | development | Apache-2.0 | `devDependencies` |
| `vite` | 6.4.6 | development | MIT | `devDependencies` |
| `vitest` | 4.1.12 | development | MIT | `devDependencies` |
| `jsdom` | 29.1.1 | development | MIT | `devDependencies` |

## Transitive dependencies

`package-lock.json` has 157 package entries, with these declared licenses:

| License | Entries |
|---|---|
| MIT | 134 |
| Apache-2.0 | 7 |
| BSD-3-Clause | 4 |
| ISC | 4 |
| MIT-0 | 2 |
| BSD-2-Clause | 2 |
| BlueOak-1.0.0 | 1 |
| CC0-1.0 | 1 |
| 0BSD | 1 |
| (Apache-2.0 AND BSD-3-Clause) | 1 |

- 107 entries were installed and checked against their own `package.json`.
- 50 entries are platform-specific optional binaries (for example `@esbuild/*`, `@rollup/rollup-*`, `fsevents`) that were not installed on the audit machine. Their licenses were checked against the lockfile only (all MIT).
- No copyleft license (GPL, LGPL, AGPL, MPL, EPL, or similar) appears in the lockfile.

## Data and assets

| Item | Origin | License and status |
|---|---|---|
| `src/lipsync/g2p/dict-en-pruned.json` | Derived by `scripts/build-dict-en.mjs` from the `cmu-pronouncing-dictionary` package | The npm package is ISC. Its readme states that the underlying CMU Pronouncing Dictionary is public domain, created by Carnegie Mellon University. The upstream data license was not re-checked beyond that readme. |
| `public/models/avatar.glb` | MetaPerson avatar model, committed in the repository | Third-party asset. The terms of use were not verified in this repository. The owner accepted responsibility for the model license on 2026-11-19 (recorded in `.planning/phases/18-ci-security-hygiene/18-CONTEXT.md`). |

## Not distributed by this repository

These are used for local experiments only. They are gitignored and not part of the shipped project.

| Item | Location | Terms (from `a2f/README.md`) |
|---|---|---|
| NVIDIA Audio2Face-3D SDK | `a2f/sdk/` (cloned locally) | MIT for the SDK code |
| Audio2Face-3D model weights | downloaded locally into the SDK tree | NVIDIA Open Model License |
| Audio2Emotion v2.2 (A2E) | downloaded locally, gated | Click-through license from the model provider |
| Python virtual environment | `a2f/.venv/` | Depends on the installed packages |

NIM and NGC (NVIDIA AI Enterprise EULA) are not used.
