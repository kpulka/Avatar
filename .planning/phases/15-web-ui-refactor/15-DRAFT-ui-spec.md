---
phase: 15-web-ui-refactor
type: draft-spec
status: execution-reference
created: 2026-11-18
---

# 15-DRAFT-UI-SPEC — Target UI Specification

> The execution reference for Phase 15 plans. Every value below is derived 1:1 from the
> current `src/style.css` literals catalogued in `15-CONTEXT.md` §3.1 (V1) and the
> decisions in §5 — **consolidation, not invention**. Where a value had to be chosen
> (light-theme derivations, token names), the rationale is stated inline.

---

## 1. Design language

A **calm glass surface over a living 3D scene**: dark translucent panels (glass),
one accent (sky), restrained radii, generous 4px-grid spacing, motion that whispers
(150–280 ms). The UI never competes with the face. Light theme is a true second
skin (same tokens, swapped values), not a partial override.

Principles: tokens only · 12px floor · ≥36px targets · calm feedback (inline over
toast) · honest states · keyboard parity.

---

## 2. Design tokens

### 2.1 Token sheet (`:root` block, top of `style.css`, TOC section 0)

**Color primitives** (raw palette — the only place raw values exist):

```
--c-sky-300:#38bdf8  --c-sky-500:#0ea5e9  --c-sky-700:#0284c7
--c-slate-950:#0f172a  --c-slate-900:#1e293b  --c-slate-800:#1e2330
--c-slate-700:#334155  --c-slate-600:#475569  --c-slate-500:#64748b
--c-slate-400:#94a3b8  --c-slate-300:#cbd5e1  --c-slate-200:#e2e8f0  --c-slate-100:#f1f5f9
--c-white:#ffffff
--c-green-500:#10b981  --c-red-500:#ef4444
```

(Counts from 15-CONTEXT V1: `#38bdf8`×19 → sky-300; `rgba(15,23,42,…)`×12 → slate-950 with alpha steps; `rgba(255,255,255,…)`×19 → white-alpha; `#475569`×11, `#334155`×6, `#0284c7`×7, `#10b981`×7, `#ef4444`×6.)

**Semantic tokens — dark (default)**:

| Token | Value | Usage (current literal) |
|---|---|---|
| `--bg-page` | `#0f172a` | app background (slate-950) |
| `--glass-bg` | `rgba(15,23,42,.72)` | panels, dock, drawers, toasts |
| `--glass-border` | `rgba(255,255,255,.08)` | panel borders |
| `--surface-input` | `#1e2330` | inputs, selects, chips bg (V2 finding) |
| `--text-primary` | `#f1f5f9` | headings, body |
| `--text-secondary` | `#94a3b8` | hints, subtitles |
| `--text-muted` | `#64748b` | meta, disabled |
| `--accent` | `#38bdf8` | active tab, focus ring, primary CTA text |
| `--accent-strong` | `#0284c7` | primary button bg |
| `--success` | `#10b981` | status ok, "speaking" dot |
| `--danger` | `#ef4444` | errors, destructive |
| `--danger-text` | `#fecaca` | text on danger tint (replaces `#f0c` typo, V5) |
| `--focus-ring` | `0 0 0 2px #38bdf8` | global `:focus-visible` |

**Semantic tokens — light** (`body.theme-light` overrides ONLY these):

| Token | Value | Rationale |
|---|---|---|
| `--bg-page` | `#f1f5f9` | slate-100 |
| `--glass-bg` | `rgba(255,255,255,.82)` | white glass |
| `--glass-border` | `rgba(15,23,42,.10)` | slate-950 @10% |
| `--surface-input` | `#ffffff` | V2: inputs were dark-on-dark; now white-on-white-glass with border |
| `--text-primary` | `#0f172a` | slate-950 |
| `--text-secondary` | `#475569` | slate-600 (≥4.5:1 on white) |
| `--text-muted` | `#64748b` | slate-500 |
| `--accent` | `#0284c7` | sky-700 (contrast on white) |
| `--accent-strong` | `#0369a1` | darker sky for CTA |
| `--success` | `#059669` · `--danger` `#dc2626` · `--danger-text` `#991b1b` | darkened for white bg |

**Typography**:

```
--font-sans: system stack (unchanged)
--fs-display:28px  --fs-heading:18px  --fs-body:14px  --fs-label:12px   (11-UI-SPEC roles; 12px = FLOOR, V3)
--fw-regular:400   --fw-semibold:600
--lh-body:1.5
```

All 23 sub-12px declarations (V3: 9px×1, 10px×9, 11px×13) map UP: 9px `.fps-unit`→12px (dead anyway, C1), 10px meta→12px label, 11px→12px label or 14px body if interactive text (`.search-input`, `.text-input` values).

**Spacing** (4px grid): `--sp-1:4px --sp-2:8px --sp-3:12px --sp-4:16px --sp-5:20px --sp-6:24px --sp-8:32px`. Current ad-hoc 6/13/9/10/11px paddings snap to grid (V4 targets).

**Radii**: `--r-sm:6px` (chips, inputs) · `--r-md:8px` (buttons, `.btn` current) · `--r-lg:12px` (panels, dock, drawers) · `--r-pill:9999px` (status pill, dots).

**Shadows**: `--shadow-panel` (glass depth, current heavy shadow softened) · `--shadow-overlay` (dialogs) · `--shadow-toast`.

**Z-index scale** (documented, replaces ad-hoc C2 list):

```
--z-canvas:0  --z-vignette:25  --z-captions:30  --z-dock:40
--z-drawers:50  --z-studio:45→50 (merge)  --z-overlay:100  --z-toast:200
--z-loader:45  (S2 fix: loader ABOVE dock+drawers, clear of captions)
```

**Motion**: `--motion-fast:150ms` (hovers) · `--motion-med:280ms` (presets, drawers) · `--ease:cubic-bezier(.2,.8,.2,1)`; reduced-motion → 0ms (A9 extends to `.pulse-border`, `.spinner`).

### 2.2 Light-theme override table (the ONLY `body.theme-light` block)

Complete surface list (fixes V2 — children included, not just 6 containers):

| # | Surface | Selector | Fix |
|---|---|---|---|
| 1 | user dock | `.user-dock` | glass tokens auto-flip |
| 2 | dock buttons | `.dock-btn`, `.dock-icon-btn` | color → `--text-secondary`, hover bg → white@60% |
| 3 | status pill | `.user-status` | glass flip + text tokens |
| 4 | captions | `.captions`, `.ty-line/.agent-line` | glass flip; agent name → accent-strong |
| 5 | algo panel | `.user-algo` | glass flip |
| 6 | engine-select / viseme-chip | `.engine-select`, `.viseme-chip` | bg → `--surface-input` (white), text primary |
| 7 | search/text inputs | `.search-input`, `.text-input` | bg white, border slate-200, placeholder slate-500 |
| 8 | toast | `.toast` | glass flip, error tint visible |
| 9 | modal/dialog | `.modal`, dialog body | white surface, overlay keeps dark scrim |
| 10 | settings rows | `.settings-row`, selects | label secondary, value primary |
| 11 | studio tabs | `.studio-tab` | inactive secondary; active accent-strong underline |
| 12 | drawers | `.drawer` | glass flip |

Every other selector uses semantic tokens exclusively → flips for free. Acceptance:
15-01 walks all 12 in light mode (its checklist); screenshot pair in 15-VERIFICATION.

---

## 3. Component contracts (target)

| Component | Contract |
|---|---|
| **Toast** | `role=status` (success/info) / `role=alert` (error); single-slot REPLACED only by equal-or-higher severity; error toasts get visible × close button and persist until closed; routine events (mute, barge-in, agent change) DO NOT toast — inline only (S6 policy in §4) |
| **Modal** | visible × close button (top-right, 36px); `aria-labelledby` → title id; native Esc closes and does NOT double-fire presentation toggle (A10: global handler skips when `dialog[open]`); fallback path (no `<dialog>)` gets focus trap + Esc |
| **Loader** | `role=status`; z=45 (above dock 40, below overlay 100); positioned top-center (clear of bottom dock, S2); removed on success AND on `avatar:error` (S1) |
| **Dock** | 40px min height; Interrupt disabled when idle (S12); Mute disabled pre-session; SVG icons + text (M4) |
| **Captions** | 3-line clamp + fade (S3); `aria-live=polite` (A1); applies `agent_response_correction` replacing stale text (S4); unselectable→selectable (V7 opt-out on captions only) |
| **Status pill** | 4 states + `error` state (consumes `voice:error`, A3); `aria-live=polite`; decorative dot `aria-hidden` (A11) |
| **Algo switcher / compare** | A/B chips with active-track highlight; blind mode hides order until reveal button; cancel affordance while running (S8); A2F-unavailable → disabled option with tooltip reason (S13) |
| **Studio toggle** | Settings modal footer row: switch + "Ctrl+Shift+D" hint, routed via `AppServices.uiMode`, lock-respecting (§5.2 decision) |
| **WebGL fallback** | module-rendered (M3), honest copy, canvas hidden while overlay shows (S9) |

---

## 4. States matrix (target — resolves 15-CONTEXT §4.2 ❌/⚠️)

| Component | loading | empty | error | ok |
|---|---|---|---|---|
| Dock | disabled states | — | banner above dock w/ "Try again" | ✅ |
| Captions | '—' placeholders | ✓ | correction replace + "interrupted" flash (S4) | streaming |
| Status pill | 4 states | — | **error state** | ✅ |
| Algo/compare | 'A2F: processing…' | empty-compare copy | A2F-down inline chip disabled + reason | chips + reveal |
| Settings | async devices | defaults | store defensive | locks |
| Panels (studio) | per-panel | ✓ | error boundary + retry | ✓ |
| Toast | — | — | close + alert role | ✓ |
| Loader | pill top-center | — | **error surfaced, cleared** | removed |
| Modal | — | — | — | × + Esc + labelled |
| WebGL fallback | — | — | card, canvas hidden | — |

Feedback policy (S6): toasts reserved for session lifecycle (start/stop), compare failure, import/export. Mute/interrupt/agent-change/barge-in → inline (status pill, dock state, caption flash).

---

## 5. Copy mechanism

`src/app/copy.ts` — pure module, no DOM imports:

```ts
export type CopyParams = Record<string, string | number>;
export const COPY: Record<string, string> = { 'status.idle': 'Gotowy', /* …~120 slots, 15-CONTEXT §4.3 */ };
export function t(slot: string, params?: CopyParams): string; // {x} interpolation, fallback → slot id
```

Slot IDs are the Phase 12 contract (stable forever; values PL today → EN in Phase 12).
Boundary: PanelDefinition titles stay in panel files (documented exception); everything
else user-visible flows through slots. WebGL card strings move from index.html into
`webgl-fallback.ts` and slot (M3).

---

## 6. Responsive rules

Min supported viewport: **1152×648** (§5.3). Tiers verified: 1920×1080, 1440×900,
1280×720, 1152×648.

```css
@media (max-width: 1440px) { /* dock labels → icon+short; algo max-width 240px */ }
@media (max-width: 1280px) { /* captions max-width 560px; studio tabs narrower */ }
@media (max-width: 1152px) { /* algo panel → icon-only column; dock labels stay; drawers overlay full */ }
```

Invariants at every tier: dock ≠ algo overlap; captions never under dock; drawers
never clipped; studio shell scrollable.

---

## 7. A11y contract

- **Live regions**: `aria-live=polite` on captions container, status pill, algo status line, toast (`status`/`alert` roles).
- **Keyboard map**: studio tablist = roving tabindex + ArrowLeft/Right/Home/End + `tabpanel` `aria-controls`; modal = focus in, Esc out, focus restore; scene file upload = visible focusable label-button (`tabindex=0` + key handler) or styled input; all icon-only buttons have aria-label (exists) + visible focus ring.
- **Associations**: every `<label for>`↔id; a2f URL input labelled; volume slider labelled.
- **Reduced motion**: single guard block covers ALL animations incl. `.pulse-border` (A9) and `.spinner`.
- **Esc semantics**: closes topmost dialog first; presentation toggle only when no dialog open.
- **Targets**: ≥36px all interactive (dock 40px).
- Acceptance = keyboard-only pass checklist in 15-VERIFICATION §4.

---

## 8. Icon set (user layer, M4)

Inline SVG (Lucide-style paths, MIT), `aria-hidden=true` + adjacent text/aria-label:
mic, mic-off, phone (start), phone-off (end), stop-square (interrupt), settings gear,
x (close), eye (presentation), dot (status, aria-hidden). Studio panel titles keep emoji
(spec-tolerated). No icon dependency added.