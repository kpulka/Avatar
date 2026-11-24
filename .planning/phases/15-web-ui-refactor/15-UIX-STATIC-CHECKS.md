---
phase: 15-web-ui-refactor
type: verification-note
requirements: [UIX-02, UIX-04, UIX-07]
status: static-parts-automated
created: 2026-11-24
---

# 15-UIX-STATIC-CHECKS — what is automated vs. what stays manual

Scope: the statically verifiable parts of UIX-02 (typography and targets) and UIX-04 (accessibility).
Everything below runs in `npm test` (and therefore in `npm run verify`). UIX-07 stays fully manual.

## 1. Automated now

| Requirement part | Gate | Test file |
|---|---|---|
| UIX-02: no text < 12px | Every `font-size` in `src/style.css` resolves (tokens via `var()`, rem base 16px) to a plain length >= 12px in dark and light theme; `font:` shorthand banned; no inline font sizes in `index.html` or `src/**/*.ts`; role tokens (28/18/14/12) pinned | `tests/ui-typography-targets.test.ts` (plus the older literal check in `tests/ui-tokens.test.ts`) |
| UIX-02: interactive targets >= 44px | 23 target selectors (buttons, chips, tabs, selects, inputs, toggles, sliders, accordion summaries, close buttons) must declare a height (and width for icon-only buttons) that resolves to >= 44px in both themes, including inside media queries; `--target-min` token is 44px; every control mounted by the real user layer, studio panels, settings form, modal, toast and loader is matched by one of those selectors | `tests/ui-typography-targets.test.ts` |
| UIX-04: aria-live polite | Every `role=status` / `role=log` region mounted by captions, status pill (label and lip-sync chip), algorithm status line, A2F status line, success toast and loader has an explicit `aria-live="polite"`; errors use `role=alert` (toast, connection banner) | `tests/ui-a11y-static.test.ts`, `tests/a11y-dom.test.ts` |
| UIX-04: modal focus management | Fallback path: focus moves into the dialog, Tab is trapped, Escape closes, focus returns to the trigger (`tests/shared-ui.test.ts`). Native `showModal` path (stubbed in jsdom): `aria-labelledby`, close button is first in focus order, focus returns to the trigger after close button, `close()` and a native Escape, and a removed trigger does not throw | `tests/shared-ui.test.ts`, `tests/ui-a11y-static.test.ts` |
| UIX-04: WCAG AA contrast of tokens | Contrast ratios computed from the CSS color tokens for both themes: 4.5:1 for text pairs (primary / ctrl / secondary / muted / accent / status / danger text, text on accent, danger and success fills) on page, glass, input, raised and control surfaces; 3:1 for the focus ring and the accent used as a UI indicator. Translucent layers are composited onto `--bg-page`; glass opacity is pinned >= 0.85 | `tests/ui-contrast.test.ts` (helpers: `tests/helpers/css-tokens.ts`) |

### Violations the new gates found (and that were fixed)

- Targets: all controls were 28/36/40px; now `--target-min: 44px` everywhere, plus new floors for the
  volume slider (`input[type="range"]`) and the inspector accordion `summary` that had none.
- Contrast: dark `--text-muted` 4.2:1 on raised surfaces; white on `--accent-strong` 4.10:1 in both
  themes; white on `--success` (hover fill) 2.5:1; white on `--danger` (loader icon) 3.76:1; light
  `--text-muted`, `--accent`, `--success`, `--warning` below 4.5:1 on glass/page.
  Fixes are token-only (new `--success-strong`, `--c-sky-900`; darker `--accent-strong`, light accent,
  success, warning, muted).
- Live regions: status pill (label and chip), A2F status line and success toast relied on the implicit
  live semantics of `role=status`; now explicitly `aria-live="polite"`.

## 2. Still manual (human UAT)

- **UIX-07 (zoom/responsive), fully manual:** 125% and 150% browser zoom at the 1152x648 minimum
  viewport; no overlap or clipping; 44px targets must not push the dock into the algorithm panel or
  captions at 1152px (the targets grew from 36/40px, so re-check the guard queries at 1280/1152).
- **Rendered contrast:** the test models glass over the page background. Spot-check real frames with a
  bright avatar/scene behind dock, captions and drawers (both themes), and `:hover`/`:disabled` states.
- **Disabled and placeholder text:** WCAG exempts disabled controls but placeholder text is judged
  visually; check light-theme placeholders.
- **Border-only boundaries:** input and button borders (`--border-ctrl`) are not asserted at 3:1; they
  are redundant with text and fill, but verify focus visibility and input discoverability by eye.
- **Screen-reader behavior:** that captions, status flips and compare progress are actually announced
  (NVDA/VoiceOver smoke); jsdom proves the attributes only.
- **Real-browser dialog focus:** `showModal()` initial focus and Escape in Chrome/Firefox/Safari
  (jsdom stubs the native dialog). Safari does not focus buttons on click, so check focus return there.
- **Visual density:** 44px targets in studio panels (chips, selects, tabs) are taller than the spec's
  36px; eyeball the drawers for acceptable density. `15-DRAFT-ui-spec.md` still says 36/40px and should
  be amended to 44px by the phase owner.
