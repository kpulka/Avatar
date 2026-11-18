---
phase: 15
status: pending
created: "2026-11-17"
updated: "2026-11-17"
---

# Phase 15 — VERIFICATION (end-of-phase checklist)

> Run after 15-01..15-07 complete. Automated gates first, then the manual protocol.
> Update this file as gates land; the phase closes when §1 + §2 + §3 are fully checked and
> the owner has signed §4/§5.

## 1. Automated gates (must be green)

- [ ] `npm test` — full regression; baseline 41 files / 204 tests; record final count:
      ____ files / ____ tests. New suites this phase: `ui-tokens`, `copy`, `shared-ui`,
      `a11y-dom`, `compare-ui`, `states-recovery`, `ui-discoverability`, `responsive-layout`.
- [ ] `npm run build` — `tsc && vite build` passes.
- [ ] `tests/ui-tokens.test.ts` — tokens only in `:root`/`body.theme-light`; ≥30 tokens;
      no font-size < 12px; dead selectors absent.
- [ ] `tests/copy.test.ts` — all slots resolve; interpolation works; zero Polish
      diacritics outside `src/app/copy.ts` in `src/ui/**`, `src/features/**`,
      `src/app/container.ts`, `index.html`.
- [ ] `tests/shared-ui.test.ts` — toast stack (3 max, roles, dismiss), modal
      (aria-labelledby, close, focus return), loader (role, error+retry).
- [ ] `tests/a11y-dom.test.ts` — tablist keyboard + ids, form label association, upload
      button, SVG icons in dock.
- [ ] `tests/compare-ui.test.ts` — chips/cancel/blind reveal logic.
- [ ] `tests/states-recovery.test.ts` — voice:error banner, mic-denied honesty,
      avatar:error loader retry, correction wiring, dock disabled logic.
- [ ] `tests/ui-discoverability.test.ts` — studio toggle + lock respect.
- [ ] `tests/responsive-layout.test.ts` — guard queries, `.sr-only`, aria-label survival.
- [ ] Grep gates: no `keydown` listeners outside `src/app/`; no `getElementById` in
      `src/ui/user/`; no emoji icons in `src/ui/user/` or presentation button.
- [ ] `style.css` metrics recorded: lines ______ (baseline 1,229), raw hex outside token
      blocks ______ (target 0), `var(--…)` usages ______ (baseline 0).

## 2. Accessibility manual pass (keyboard + reader, both themes)

- [ ] **Keyboard-only walkthrough (user layer):** Tab order logical (status → dock →
      segment → compare → blind → gear); Enter/Space activate; focus-visible ring on every
      control; no keyboard trap; Backtab returns out.
- [ ] **Dialog:** settings opens from gear, Esc and the X button close it, focus returns
      to gear.
- [ ] **Tablist (studio):** Arrow keys / Home / End switch tabs; only one
      `aria-selected="true"`; tabpanel labelled.
- [ ] **Live regions:** captions update announces (NVDA/VoiceOver smoke); status changes
      announce; compare progress announces via the status line.
- [ ] **Reduced motion** (OS setting or DevTools emulation): pulse-dot, pulse-border,
      spinner, toast/panel transitions all static; scene preset crossfade instant.
- [ ] **Contrast spot-checks (4.5:1 text, 3:1 UI):** dock labels on glass (dark + light),
      status pill colors, toast text, section titles, `.btn-danger-subtle` label,
      lock-tooltip text, light-theme selects (`--surface-ctrl` pairing from UI-SPEC §2.2).
      Record pairs checked: ______.
- [ ] **Target sizes:** dock buttons ≥40px, segment 40px, studio tabs ≥36px, all inputs
      ≥36px (ruler check in devtools).

## 3. States & recovery manual walkthrough (failure injection)

| Scenario | How to simulate | Expected |
|---|---|---|
| Connection lost | DevTools → Offline → Start conversation | Error banner with retry; no fake "Słucham…"; retry works when online |
| Mic denied | Block permission (site settings) → Start | Status stays idle, mic guidance shown, no dead-listening |
| Model missing | Temporarily rename `public/models/avatar.glb` (dev only) → reload | Loader error state with working demo retry; no infinite pill |
| WebGL off (optional) | Browser flag / software-render env | Fallback card, copy-slotted, canvas hidden after choice |
| Interrupted turn | Talk over the agent (barge-in) | Caption flash; corrected transcript replaces stale text |
| Long transcript | Ask for a long answer | Captions clamp 3 lines + fade; full text in Studio → Sesja |
| Destructive reset | Studio → Wizemy → reset-all | Confirm modal; Cancel preserves overrides |
| Compare blind | One turn → blind → compare | Order hidden until reveal; reveal shows order + stats |
| Compare cancel | Compare → click cancel | Playback stops, status resets, dock usable |
| Locked uiMode | Studio → Sesja → lock `uiMode` → Settings | Studio row disabled with tooltip; `?studio=1` doesn't persist |

## 4. Responsive & layout verification

- [ ] 1920×1080: intended layout, algo panel clear of captions.
- [ ] 1440×900: drawers 340px, captions 640px — no overlap.
- [ ] 1280×720: compact algo row, captions re-anchored, everything operable.
- [ ] 1152×648: icon-only dock (aria-labels intact), compact compare, no clipping.
- [ ] Both themes × user+studio at 1280×720 — screenshot set captured.

## 5. Screenshots for Phase 13 (coordinate slot)

Deliver to Phase 13 (README) after this phase closes — light theme only became
screenshot-worthy here:

- [ ] User mode, dark (`studio-dark` preset) — full frame with avatar + dock + captions.
- [ ] User mode, light theme (`light` preset) — same framing.
- [ ] Studio mode overview — right drawer (Animation tab) + left drawer (Inspector).
- [ ] Compare A/B mid-playback — chips highlighted.
- [ ] Presentation mode (H key) — clean cinema frame.
- [ ] Settings modal (light) — showing the Studio-mode row (the discoverability win).
- Suggested path: `docs/img/ui/` (Phase 13 decides final home).

## 6. Handoffs & cross-area restatements (for the orchestrator)

- **Phase 12 (EN):** edit values in `src/app/copy.ts` only; then `index.html lang="en"`.
  Slot table = 15-CONTEXT §4.3 + `copy.ts`. Panel titles/icons are data in
  `PanelDefinition` (not copy slots) — decide there. The diacritics gate
  (`tests/copy.test.ts`) keeps translation from leaking inline.
- **Phase 13 (README):** screenshots from §5; mention `?studio=1` + Ctrl+Shift+D in the
  feature list (the UI-SPEC decision: settings toggle primary, URL param documented
  backdoor). Quickstart facts: `public/models/avatar.glb` ships in-repo (real avatar, no
  setup); conversation needs mic + a public agent; demo avatar via Studio → Scena.
- **Phase 14 (architecture) cross-seams to bless:** mic-error rethrow +
  `onAgentCorrection` wiring (`speech-backend.ts`), `avatar:error` event
  (`scene-controller.ts` + `app-types.ts`), toast de-spam (`conversation-controller.ts`),
  `AppServices.uiMode` (`app-types.ts`, `container.ts`), `copy.ts` module home
  (`src/app/`), volume-slider write-per-drag (optional debounce — not done here).
- **Phase 16/17:** A2F segment gating currently uses a local `probeA2fAlive()` in the
  switcher (advisory, 1500 ms) — replace with a registry `available()` capability API when
  one exists; compare chips already consume only `compare:state/result/cancelled`.
- **Phase 18 (CI):** worth adopting as gates: `ui-tokens` (CSS regression), `copy`
  (diacritics/a11y-of-translation), and the grep rules in §1.

## 7. Deferred (explicit, not silent)

- Mobile/small-phone support — out of declared scope (min 1152×648).
- Custom scene-preset JSON for tweakers — deferred in Phase 11, unchanged.
- Blind-compare result persistence into telemetry — deferred in Phase 11, unchanged.
- `<kbd>`-styled shortcut hints, onboarding tour/first-visit coach marks — candidate for
  v1.2 backlog.
