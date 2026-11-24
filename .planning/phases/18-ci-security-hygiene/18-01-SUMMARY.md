# 18-01 Security hygiene summary

## Changes

- Added a security policy covering private reporting, public agent IDs, credential handling, quota restrictions, and the current embed bridge limitations. The 11.1-01 hardening is explicitly pending.
- Ignored PEM and key files; `.env` and `.env.*` were already ignored.
- Added the planned Content Security Policy to production HTML through a Vite build-only transform; development HTML remains unrestricted by this policy.

## Verification and limits

- 2026-11-19: gitleaks was unavailable. Used Python 3.14.2 `re` over tracked working-tree files and `git log -p --all --no-ext-diff --no-color` as the plan's documented fallback, with Git 2.53.0.windows.2. The history scope is all commits reachable from local refs, not unreachable objects or remote-only refs. This is a pattern scan, not proof of absence of all possible credentials.
- Pattern counts for tracked working tree / full history patches: `xi-api-key` or `xi_api_key` references 17 / 21; key-shaped `sk-` values 0 / 0; quoted API key assignments 0 / 0; bearer token shapes 0 / 0; quoted long hexadecimal literals 0 / 0; quoted long base64 literals 0 / 0. The xi references describe the key name, not a matching key assignment. No xi references appeared in `src`.
- An additional scan of 21 untracked, nonignored files found zero matches for the credential-shaped patterns above. No tracked environment files were found; a working-tree enumeration excluding dependency, SDK, virtualenv, Git, and build directories found none. No secret values were printed.
- `npm run build` passed. The built HTML contains the expected CSP meta tag; Vite's development HTML transform contains none. Browser console and audio playback were not verified. The Listen demo is planned for 11.2-03 and cannot be verified at this baseline. The policy's connectivity requirements need a browser check against actual deployed integrations.
- `git check-ignore` confirmed `.env`, `.env.local`, `test.pem`, and `test.key` are ignored; `git diff --check` passed.
- 11.1-01 has not shipped: the current bridge uses `document.referrer`, supports `avatar:set_agent`, and does not restrict `allow_any_origin` to development. Its framed-parent checks and associated tests remain pending; no 11.1 behavior is claimed as implemented here.


- Production preview CSP divergence: added `blob:` to `connect-src` alongside `'self'` and `wss://api.elevenlabs.io`. Before this change, headless Chromium reported 30 `connect-src` violations for same-app blob texture reads while a canvas was present. Other directives are unchanged. The showcase GLB has no Draco extensions, so this observation does not establish Draco decoder behavior.
- 2026-11-19: `npm run build` passed. The rebuilt HTML contains the revised policy. On `http://localhost:5427/`, cached Chromium headless shell logged successful initialization and successful loading of `avatar.glb`, with no CSP violation in the captured console output. It also logged a Three.js warning that a material `map` was undefined, a GPU overlay diagnostic, and unsupported media-access diagnostics. This smoke check does not verify audio playback, live ElevenLabs connectivity, other models, or deployed integrations.
