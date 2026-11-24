---
phase: 14-architecture-guards
plan: 03
subsystem: lifecycle
tags: [dispose, event-bus, regression]
requirements: [ARCH-03, ARCH-04]
key-files:
  created:
    - tests/conversation-dispose.test.ts
  modified:
    - src/app/events.ts
    - src/app/container.ts
    - src/features/conversation-controller.ts
    - tests/events.test.ts
    - tests/container.test.ts
status: complete
commits: 1
plan_head_before: b97d5be5f52ffe8d3739140c2d13578398414cd8
plan_head_after: 3a58c2d
actuals:
  tasks: 5
  commits: 1
---

# Phase 14 Plan 03: Lifecycle guarantee Summary

After `createApp().dispose()` the event bus holds zero handlers, and the resources that leak if forgotten (speech session, renderer, AudioContext) are released exactly once; both are asserted in `tests/container.test.ts`.

Gate after this plan: `npm run typecheck` exit 0; `npm run build` OK; `npx vitest run --dir tests` 75 files / 704 tests (baseline after 14-02: 74 / 696; +3 handlerCount, +2 container regression, +3 new `conversation-dispose.test.ts`).

## What changed

- **`TypedEventBus.handlerCount()`** (src/app/events.ts, next to `clear()`), commented as test/debug only. `tests/events.test.ts`: follows `on`/`off`/Unsub across events, an idempotent Unsub never decrements twice, `clear()` returns it to 0.
- **Container regression** (tests/container.test.ts): the bus instance is captured by wrapping `TypedEventBus` in a `vi.mock` of `../src/app/events` (a subclass that records itself), so the container's public surface did not widen. The test asserts `afterStart > 0` first (cannot pass on an empty bus), `handlerCount() === 0` after `dispose()`, `speechBackend.stop`, `renderer.dispose` and `audioContext.close` called once each, and that a second `dispose()` neither throws nor releases anything again. A second test proves the detector: a subscription added without collecting its Unsub leaves `handlerCount() === 1` after dispose. Mutation checks: dropping one `unsub*()` call, or the new `conversationController.dispose()` call, fails the regression.
- **Container dispose gaps found by 4a and fixed** (the task said to fix `container.ts` if missing; all four were missing): `conversationController.dispose()` (new; ends the session via `speechBackend.stop()` = WSS closed, mic tracks stopped, audio hard-stopped, then detaches every backend callback and the embed-bridge commands so nothing emits on, or starts a session for, a disposed app), `renderer.dispose()`, `audioEngine.ctx.close()` (rejection swallowed - already-closed context), and an idempotence flag.
- The bus-level invariant needed no other source change: every existing `events.on` in `app/` and in the controllers was already collected (the P11 review fix), so the count was already 0 once the new test looked.

## Deviations from Plan

**1. [Rule 2 - missing critical functionality] `ConversationController.dispose()`** (src/features/conversation-controller.ts, outside `files_modified`) - the plan's task 4a requires "conversationController teardown" and the class had none.
**2. Bus exposure via test-side mock instead of a container field.** Plan allowed a minimal readonly field; a subclass in `vi.mock` keeps `AppHandle` unchanged (the layering gate keeps `container.ts` importable by `main.ts` only).
**3. Deferred (not fixed, outside scope):** `EmbedBridge` registers an anonymous `window` `message` listener in its constructor (`src/prod/embed-bridge.ts`, `setupMessageListener`) that has no removal path, and `AudioEngine` has no `dispose()` of its own (the container closes the context directly). Neither is covered by the bus invariant; both are recorded here and in `14-VERIFICATION.md` as follow-ups. Dispose after this plan is therefore "all bus subscriptions, store subscriptions, DOM listeners owned by the container, session, renderer, AudioContext" - not "every global listener in the process".

## Known Stubs

None.

## Self-Check: PASSED

`tests/conversation-dispose.test.ts` exists; commit 3a58c2d is an ancestor of HEAD; `handlerCount` present in `src/app/events.ts`.
