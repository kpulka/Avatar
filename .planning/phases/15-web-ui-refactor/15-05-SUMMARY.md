---
phase: 15-web-ui-refactor
plan: 05
subsystem: ui
tags: [states, recovery, compare, feedback]
key-files:
  created: [src/ui/user/connection-banner.ts, tests/compare-ui.test.ts, tests/states-recovery.test.ts]
  modified:
    - src/ui/user/{algorithm-switcher,captions,conversation-dock}.ts
    - src/ui/studio/panels/{visemes,session}-panel.ts
    - src/features/conversation-controller.ts
    - src/audio/speech-backend.ts
    - src/app/container.ts
    - src/app/copy.ts
    - src/style.css
    - tests/container.test.ts
    - tests/helpers/ui-fixtures.ts
status: complete
---

# Phase 15 Plan 05: States, error recovery, feedback hygiene, compare UX Summary

- Connection banner (`connection-banner.ts`, registered as a user-layer panel; container diff is 2 lines + loader wiring): consumes
  `voice:error` (also now emitted for runtime socket errors), `role=alert`, Try again calls `conversation.start()`, hides on a live session.
- Mic-denied: already honest after 11.2 (`MicAccessError`, state stays idle, `voice:error` carries the guidance); verified by test.
- Avatar double failure (S1): `avatar:error` -> `loaderUi.error(t('errors.avatarBody'))` with retry = `sceneController.loadDemo()`.
  The message is a copy slot in the container, so `scene-controller.ts` (Phase 16 territory) was NOT touched.
- Captions: 3-line clamp per line + `max-height: 7.2rem` + top fade mask; `agent_response_correction` wired
  (`onAgentCorrection` backend -> controller -> `transcript:agent`, replace semantics); `.caption-flash` on `speech:interruption`.
- De-spam: removed toasts for start/stop, mute/unmute, barge-in. PoC, compare and import/export toasts remain.
- Visemes "Reset all" uses a confirm modal (accept wipes, cancel leaves overrides). Inspector reset stays unconfirmed (session-only).
- Session panel: dead mic select + stale copy removed, one line points to Settings.
- Compare: chips A/B (per registry source) with `aria-current` live highlight, cancel button while running, blind-safe reveal (order and
  chip labels hidden until "Show order"), non-blind shows result immediately. Dock: interrupt/mute disabled at idle, mute `aria-pressed`.
- A2F gating (S13): local advisory `probeA2fAlive()` (HEAD `/status`, `no-cors`, 1500 ms) disables the A2F segment option with a reason
  tooltip when unreachable (never disables the currently active source; Compare is still attempted on click). Phase 16 has no
  `available()` yet in this branch; remove the local probe when it lands.

## Deviations from Plan
- [Drift] Plan text for mic order inversion / `avatar:error` emit was already implemented by 11.2; only the loader error surface was added.
- Slot IDs differ from the plan list where the semantics changed: `errors.connection.title` only (body = the message itself),
  `errors.avatarBody/avatarRetry`, `compare.trackA/B/cancel/reveal/blindDone/chipRevealed`, `algo.nameLive/nameA2f/a2fUnavailable`,
  `visemes.resetAllConfirm*`, `session.micInUserSettings` (replaces `session.micComingSoon`, removed). Unused-now toast slots
  (`toast.conversationEnded` etc.) stay in the registry because the Phase 15 contract test lists them.
- Test edits outside files_modified: `tests/container.test.ts` MetaPersonLoader mock gained a `__failAvatarLoad` switch (additive) plus one new
  case; shared fixture `tests/helpers/ui-fixtures.ts` extended.

## Cross-seams for Phase 14 review
`speech-backend.ts` (`onAgentCorrection`), `conversation-controller.ts` (voice:error on runtime errors, toast removals), `container.ts`
(banner registration, loader retry/avatar:error handler).

## DEFERRED-HUMAN
Offline start -> banner with retry; deny mic permission -> idle pill + guidance banner; delete `public/models/avatar.glb` temporarily ->
loader error with "Load demo avatar" (restore after); long transcript clamps/fades; barge-in flash (+ live correction text); compare with
blind on/off and cancel; stop A2F service and reload -> A2F segment option disabled with tooltip.

## Gate
`npm run build` OK; `npx vitest run --dir tests`: 57 files / 348 tests green.

## Self-Check: PASSED
