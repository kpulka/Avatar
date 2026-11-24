---
phase: 13-readme-showcase
plan: 02
status: complete
type: execute
requirements: [READ-03]
commits: 0
plan_head_before: b5bf761
plan_head_after: b5bf761
created: 2026-11-24
---

# Phase 13 Plan 02: Cold-clone quickstart verification

**The README quickstart was run from a fresh clone with no node_modules: install, dev server, browser check, the conversation error path, the sample-speech demo, test and build. Everything matched the README text, so no README amendment was needed.**

## Method

- Cold clone: `git clone` of the worktree branch (`worktree-agent-af76c220b737b8b0f` at `b5bf761`) into `L:/tmp/claude/avatar-coldstart`. Checked: no `node_modules`, no `dist`.
- Browser checks: headless Chrome (installed Chrome, not a new download). Screenshots and console read from `--enable-logging=stderr`. Interactions driven over the Chrome DevTools Protocol with `userGesture: true`, so AudioContext unlock behaves as it would for a real click.
- Dev server processes were stopped after each check; ports 5310 and 9333 are free.
- Worktree dev server (`/d/Projects/Avatar/.claude/worktrees/agent-af76c220b737b8b0f`) was used for the first pass, then stopped before the cold clone started, so port 5310 was never shared.

## Cold-clone run

| Step | Command (as README) | Result |
|---|---|---|
| 1 | `git clone` (local path to the worktree branch; GitHub not reachable from this run, see notes) | ok; no node_modules, no dist |
| 2 | `npm install` | exit 0, 107 packages, 6 s (warm npm cache). No peer or engine warnings. `npm audit` reports 5 advisories (2 moderate, 3 high), all in dev dependencies (vitest, jsdom/undici, source-map-js). `npm audit --omit=dev`: 0 |
| 3 | `npm run dev` | `VITE v6.4.3 ready in 310 ms`, `Local: http://localhost:5310/`. First HTTP 200 after about 1.2 s. `avatar.glb` 200, 11,964,392 bytes |
| 4a | Avatar renders with no config | Screenshot shows the rigged avatar, LIVE/A2F switch, dock (Start conversation / Mute / Interrupt). Console: `Avatar application initialized successfully.` and `Successfully loaded the rigged MetaPerson avatar.glb model`. No uncaught errors |
| 4b | Studio `?studio=1` opens the six panels | Screenshot: Animation, A2F, Session, Scene tabs plus floating Visemes and Inspector |
| 4c | Sample speech (EN) plays with lip-sync and captions | Press with user gesture: status `Speaking…`, captions `YOU: [Calibration test EN]` and `AGENT: Hello! I am delighted to speak with you and assist you today.`; status back to `Ready` after about 5.5 s |
| 4d | Conversation without a usable agent gives a readable error (not a crash) | Press Start conversation with user gesture (headless, no microphone, mic permission denied): banner visible, title `The conversation could not start`, body `Microphone access is blocked. Allow it via the icon in the address bar, then press Start again.`; status `Ready`. The agent-connection step is never reached in this run (see notes) |
| 5 | `npm test` | exit 0 in 6 s: `Test Files 66 passed (66)`, `Tests 417 passed (417)` |
| 5 | `npm run build` | exit 0: `tsc && vite build`, built in 2.36 s |
| 5 | `npm run typecheck` | not run; no such script exists in `package.json` (README says so) |

## Checks against README text

- Quickstart commands: match. No amendment needed.
- Port 5310 and the URL: match (`strictPort` confirmed; nothing else on that port).
- Node 20 or newer: stated as the vitest floor. Verified on Node v25.6.1 only. Node 20 was not tested here.
- Troubleshooting "The conversation does not start" -> banner with error text: matches (4d). The wording in the README is generic and still correct.
- Troubleshooting "Mic blocked": matches (4d, the microphone message appears in the banner).
- Troubleshooting "No WebGL": the fallback card path is in `src/main.ts` and `copy.ts` (`webgl.title`). Not exercised here, as this machine has WebGL.
- Presentation mode H / Esc and Ctrl+Shift+D: code-verified only (`container.ts`, `ui-mode.ts`). Not exercised in the browser run.

## README deltas

None. The README text matched reality for every step run. The one caveat below is about where the clone URL points, not about the text.

## Notes and follow-ups (not changed in this plan)

1. **Clone URL vs. branch.** The README quickstart clones `https://github.com/kpulka/Avatar.git`, which gives GitHub's default branch. This work lives on `worktree-agent-af76c220b737b8b0f` (based on `implement/v1.1-refactor`), not pushed. The quickstart is verified against this branch's contents only. It becomes true for a reader of GitHub after the branch is merged and pushed.
2. **Default agent path.** The "no agent" branch in the draft does not exist. `src/audio/agent-config.ts` bundles a default agent ID, so the app always attempts a conversation. This run did not reach the WebSocket connect step (mic denied first). Whether the bundled agent accepts unauthenticated connections is unverified from here (requires network to ElevenLabs).
3. **`@elevenlabs/client` is a dependency but unused in `src/`.** The README does not claim it is used. Removing it is a `package.json` change outside this phase.
4. **Dev-dependency advisories.** `npm audit` shows 5 advisories in dev dependencies; production dependencies show 0. Not addressed here.
5. **Polish lip-sync has no dedicated test.** The README status row says "no dedicated Polish test yet". This is the only status row without an automated test.

## Gates

- `npm run build` (cold clone): exit 0.
- `npm test` (cold clone): 66 files, 417 tests passed.
- Worktree: `npm run build` and `npx vitest run --dir tests` re-run after 13-01 with the same result (see 13-01-SUMMARY).

## Self-Check: PASSED

- Cold clone at `/l/tmp/claude/avatar-coldstart` is a scratch copy; nothing outside the worktree was modified.
- Browser artefacts (screenshots, logs) are in `/l/tmp/claude/shots/` and are not committed.
