---
phase: "15"
name: "Web UI refactor — portfolio-grade UX pass"
created: "2026-11-17"
---

# Phase 15: Web UI Refactor — Context (Audit & Plan Basis)

> Analyst+planner audit of the presentation layer as a **product surface** (the part every
> recruiter sees first). Milestone: v1.1 "Portfolio Polish". Siblings: 12 English-ization
> (fills EN into the slots defined here), 13 README (screenshots of this UI), 14 architecture
> refactor (wiring), 16 animation mechanics, 17 lip-sync pipeline, 18 CI/deploy.
>
> Method: full read of every file under `src/ui/**`, `src/app/{container,ui-mode}.ts`,
> `src/style.css`, `index.html`, the UI-facing `src/features/*` controllers, plus the
> first-run path (`scene-controller.ts`, `speech-backend.ts`, `agent-config.ts`,
> `test-avatar-generator.ts`, `model-cache.ts`, `public/`). Evidence is `file:line`.
> Baseline assumed green: 41 test files / 204 tests + build (STATE.md 2026-09-12).

---

## 1. Phase goal

Raise the existing dual-persona frontend (Phase 11, code-done) from "functional dev HUD
refactored into modules" to a **portfolio-grade product surface**: a coherent design-token
system, complete dark/light theming, a11y that survives a keyboard-only pass, honest state
coverage (loading/empty/error/ok) with recovery actions, calm feedback (no toast spam),
responsive integrity at common viewports, discoverable studio mode, and a microcopy slot
registry that Phase 12 can English-ize mechanically.

**Scope**: `src/ui/**`, `src/app/{ui-mode,container}.ts` (UI surfaces only),
`src/style.css`, `index.html` shell, and UI-facing copy. **Not in scope**: service wiring
(Phase 14), animation/lip-sync internals (16/17), README (13), CI (18). Where a fix requires
a minimal seam outside the UI layer (e.g. surfacing a swallowed mic error), the plan marks it
explicitly as a **cross-seam** and lists it for Phase 14 review.

---

## 2. What Phase 11 already solved — credited, NOT re-planned

1. **Dual-persona architecture** — PanelRegistry (`{id,title,icon,mount,visibleIn,region}`),
   lazy tab mounting, left drawers on demand; moving a feature = changing one field
   (`src/ui/studio/panel-registry.ts`, `studio-shell.ts`).
2. **SettingsStore** — single schema v1, defaults→tweaker→user precedence, locks
   (freeze current value — review A1 P1), export/import JSON, legacy key migration
   (`src/app/store/settings-store.ts`, `settings-schema.ts`).
3. **UiMode** — `?studio=1` + Ctrl+Shift+D + persisted `body[data-mode]`, lock-respected
   (`src/app/ui-mode.ts`).
4. **Scene presets** — 4 presets, 280 ms tween, reduced-motion instant, gradient dispose,
   theme↔preset sync that respects manual choice (`src/features/scene-preset-controller.ts`,
   `scene-presets.ts`).
5. **Shared primitives exist** — toast/loader/modal/dom with `textContent`-only XSS
   discipline (`src/ui/shared/*`).
6. **Per-panel error boundary** with retry button (`renderPanelError`).
7. **index.html is a 34-line shell**; all markup in modules (UI-04 satisfied).
8. **A11y seeds**: global `:focus-visible` ring (style.css:1210), aria-labels on icon-only
   controls, `role=tablist/tab` + `aria-selected`, `aria-label` groups.
9. **Compare fairness core** — same PCM both tracks, `rmsDiff` backstop, cancel semantics,
   blind order randomization (`src/features/compare-controller.ts`); mic `deviceId` end-to-end.
10. **Dead-code purge** — `hud.ts`, `settings-modal.ts`, `micSensitivity` all gone;
    `main.ts` is 24 lines.

This phase polishes what sits **on top of** these foundations; it must not redesign registries,
store semantics, or the composition-root pattern.

---

## 3. Audit findings

Severity: **H** = recruiter-visible breakage or a11y blocker · **M** = portfolio-polish gap ·
**L** = nice-to-have. Cost: S < 1 h · M ≈ half day · L ≈ day+.

### 3.1 Visual design system

| # | Finding | Evidence | Sev | Cost |
|---|---------|----------|-----|------|
| V1 | **No design tokens.** `src/style.css` (1,229 lines, 25 KB, single file) contains **0** `var(--…)` usages and **150** raw hex literals: `#38bdf8`×19, `rgba(255,255,255,…)`×19, `#475569`×11, `rgba(15,23,42,…)`×12, `#0284c7`×7, `#10b981`×7, `#334155`×6, `#ef4444`×6, `rgba(30,41,59,…)`×8. Every theme change is a find-replace. | style.css (whole file) | H | M |
| V2 | **Light theme incomplete → broken contrast.** `body.theme-light` overrides only 6 container surfaces (style.css:879-896, 1043-1052, 1182-1191) but not their children: dock buttons keep `#cbd5e1` text on now-white glass; `.engine-select`/`.viseme-chip` hardcode `#1e2330` bg (style.css:901-914); `.search-input` (416-425), `.text-input` (762-770), toast (784-797), dialog body stay dark-on-dark or dark-component-on-light-surface. | style.css:879-896, 901-914, 762-797 | H | M |
| V3 | **Typography below the 12px floor in 23 declarations** (11-UI-SPEC promised normalization "at touch"; every file is now touched). `9px`: `.fps-unit`:264. `10px`: `.status-pill`:96, `.drawer-subtitle`:387, `.btn-tiny`:284, `.viseme-detail-state`:919, `.viseme-hint`:925, `.mirror-hint`:928, plus dead `.pill-label`:241, `.pill-meta`:271, `.align-badge`:307. `11px`: `.dock-icon-btn`:184, `.search-input`:423, `.section-title`:447, `.studio-tab`:958, `.speaker-tag`:632, `.viseme-chip`:911, etc. | style.css (grep `font-size:\s*(9|10|11)px` → 23) | M | S |
| V4 | **Interactive targets below spec.** `.dock-btn` ≈29 px tall (padding 6px 13px + 12px font, style.css:111-123), `.dock-icon-btn` ≈27 px (175-188); `min-height:36px` exists only on `.studio-tab`:962 and `.segment-btn`:1124. 11-UI-SPEC promised 40px dock / 36px minimum. | style.css:111-123, 175-188 | M | S |
| V5 | **`#f0c` magenta on `.btn-danger`** (style.css:924) — a near-certain typo (`color: #f0c` ≈ pink), ≈3.0:1 contrast on panel bg, below 4.5:1. This styles the visemes "Reset WSZYSTKICH głosek" button. | style.css:924 | M | S |
| V6 | Ad-hoc radius/border idioms: pill buttons `9999px` vs `.btn` 8px; six near-identical button recipes. Fold into tokens. | style.css:111, 697-725 | L | S |
| V7 | `user-select: none` on `body` (style.css:14) with no opt-out — visitors cannot copy caption/model text. | style.css:14 | L | S |
| V8 | `.engine-toggle` (base) and `.icon-label` (studio-shell.ts:113) have **no styles at all** — checkbox rows render as default browser controls inside glass panels. | studio-shell.ts:113; grep style.css | L | S |

### 3.2 Accessibility

| # | Finding | Evidence | Sev | Cost |
|---|---------|----------|-----|------|
| A1 | **Zero `aria-live` regions in the whole app** (grep across `src/` → 0 matches). Captions (`captions.ts:18`), status pill (`status-pill.ts:22`), algo status line (`algorithm-switcher.ts:56`), toast (`toast.ts:14`), loader (`loader.ts:14`) all mutate silently — screen readers announce nothing. This is the single biggest a11y gap. | grep `aria-live` in src → 0 | H | M |
| A2 | **Mic-denied is swallowed.** `speech-backend.ts:167-169` catches getUserMedia failure with `console.warn`, then sets `isRunning=true` and state `'listening'` (171-172). UI shows "Słucham…" with a dead microphone. No guidance, no retry, no permission hint. Worst-case recruiter demo path. | speech-backend.ts:160-172 | H | M |
| A3 | **`voice:error` has no consumer.** Emitted by conversation-controller:108 on connection failure; grep finds only the type definition (app-types.ts:53) and the emit. The UI-SPEC's promised error state with "Spróbuj ponownie" retry button (11-UI-SPEC §Copywriting) **was never built** — errors surface only as a transient toast. | conversation-controller.ts:106-110; app-types.ts:53 | H | S |
| A4 | **Toast cannot be dismissed and is invisible to AT.** Spec says errors "stay until closed" but `toast.ts` has no close button (13-47); a new toast replaces the previous message (single node, :28) so an error can be overwritten by a success toast mid-reading. No `role=status/alert`. | toast.ts:13-47 | H | S |
| A5 | **Modal lacks visible close + labelling.** `modal.ts:13-43` — no X button (Esc-only via `<dialog>`), title not associated (`aria-labelledby` missing), fallback `open`-attribute path (27) has neither focus trap nor Esc. | modal.ts:13-43 | M | S |
| A6 | **Studio tablist not keyboard-operable per WAI-ARIA Tabs.** `studio-shell.ts:38,70-82` maintains `role=tab`/`aria-selected` but has no arrow-key navigation / roving tabindex; panels have no `role=tabpanel`/`aria-controls`/`id` wiring. Left-drawer toggles are ordinary buttons (fine). | studio-shell.ts:55-82 | M | S |
| A7 | **Form labels not associated.** `user-settings.ts:92-106` — mic/theme/preset `<select>`s are siblings of their `<label>`s (not wrapping), so no programmatic association; volume slider labelled only by wrapping. `a2f-panel.ts:19-23` URL input has no label at all (placeholder only). Session panel same pattern (134-143). | user-settings.ts:89-108; a2f-panel.ts:19-23; session-panel.ts:133-143 | M | S |
| A8 | **File upload unreachable by keyboard.** `scene-panel.ts:39-44` — "Wybierz .GLB" is a `<label class="btn">` wrapping a `display:none` input; labels are not focusable and the hidden input is removed from the a11y tree. | scene-panel.ts:39-44 | M | S |
| A9 | **`prefers-reduced-motion` coverage is partial.** style.css:1215-1228 covers user-layer transitions + `.pulse-dot`, but NOT `.btn-call.active` `pulse-border` infinite animation (147-150) and NOT the `.spinner` (820-827). Scene-preset tween does respect reduced-motion in JS (scene-preset-controller.ts:77-83) ✓. | style.css:147-150, 820-827 vs 1215-1228 | M | S |
| A10 | **Esc double-behaviour.** Global keydown toggles presentation mode on `Escape`/`h`/`H` (container.ts:263-272) and only skips form-field targets — pressing Esc to close the settings `<dialog>` also flips presentation mode. | container.ts:263-272 | M | S |
| A11 | Decorative `pulse-dot` not `aria-hidden` (status-pill.ts:24); captions container is `pointer-events:none` (fine) but text is unselectable (V7). | status-pill.ts:24 | L | S |

### 3.3 States, feedback & first-run

| # | Finding | Evidence | Sev | Cost |
|---|---------|----------|-----|------|
| S1 | **First-run double-failure dead-ends.** If `/models/avatar.glb` fails AND the demo-avatar fallback throws, only `console.error` fires (scene-controller.ts:64-71); `avatar:loaded` never emits, so the loader pill "Ładowanie zrigowanego modelu MetaPerson 3D…" hangs forever with no error surface. Note: `public/models/avatar.glb` (11.9 MB) is committed in 11.2 (SHOW-09) — not yet as of 2026-11-19 (gitignored); after SHOW-09 the normal first-run shows the real MetaPerson avatar and this path covers partial checkouts. 11.2 SHOW-02 already hides the loader on fallback failure — 15 builds the full error state on top (amended 2026-11-19 — see 11.1/11.2). | scene-controller.ts:57-72; container.ts:105 | H | S |
| S2 | **Loader collides with the dock and hides under it.** `.loader-overlay` is bottom-center at `z-index:20` (style.css:804-818); `.user-dock` is bottom-center at `z-index:40` (1062-1078). The loading indicator renders behind the dock in the same spot. Also contradicts 11-UI-SPEC "loader blocks CTA" — it blocks nothing. | style.css:804-818 vs 1062-1078 | H | S |
| S3 | **Captions are unbounded.** `captions.ts:3` claims "wraps to 3 lines (CSS)"; grep finds **no line-clamp anywhere** in style.css. Long transcripts grow the box over the avatar indefinitely. 11-UI-SPEC marked this "covered". | captions.ts:1-4; grep `line-clamp` → 0 | M | S |
| S4 | **Interrupted-turn feedback lost.** `agent_response_correction` is parsed by raw-wss-client (152-155) but `onAgentCorrection` is never wired in speech-backend → corrected transcript never replaces the stale one after barge-in; captions show outdated text. No visual "interrupted" cue either. (Phase 4 ROB-02 had this in the old HUD.) | raw-wss-client.ts:152-155; speech-backend.ts (no `onAgentCorrection`) | H | M |
| S5 | **Destructive reset without confirmation.** "✖ Reset WSZYSTKICH głosek" wipes all persisted viseme overrides instantly (visemes-panel.ts:179-186). 11-UI-SPEC §Copywriting promised a confirm modal ("Reset wszystkich nadpisań wizemów… Kontynuować?"). Inspector "Resetuj wszystko" (inspector-panel.ts:196-202) is non-persisted, lower risk. | visemes-panel.ts:179-186 | H | S |
| S6 | **Toast spam.** Success toasts fire for: conversation start/stop (conversation-controller.ts:100,103), every mute/unmute (117-120), **every barge-in** (135-138), agent change (147), and 7 toasts across a PoC stress run (159-185). Each auto-hides after 5 s and overwrites any previous toast (A4). During a demo this is constant noise; barge-in feedback should be the face relaxing, not a popup. | conversation-controller.ts:100-185 | M | S |
| S7 | **Stale session panel.** Mic select permanently `disabled` with copy "Wybór urządzenia mikrofonu dostępny po 11-06." (session-panel.ts:45-47,143) — 11-06 shipped; the device picker lives in user settings. Dead control + false copy in the tweaker surface. | session-panel.ts:45-47,143 | M | S |
| S8 | **Blind mode leaks the answer; compare UI is a text line.** Result line always renders "kolejność: LIVE → A2F / A2F → LIVE" even in blind runs (`result.blind` is ignored, algorithm-switcher.ts:78); 11-UI-SPEC's A/B chips, track labels and "który lepszy?" reveal don't exist — the whole ComparePanel collapsed to a `<p>`. No cancel affordance although `CompareService.cancel()` exists (app-types.ts:96). Status pill stays "Gotowy" during compare replay (compare never emits `voice:state`). | algorithm-switcher.ts:56-95; app-types.ts:94-99 | M | M |
| S9 | WebGL fallback card is dev-speak ("Przejdź do trybu Audio 2D (Graceful Degradation)") and the canvas stays visible behind the overlay until the button is clicked (webgl-fallback.ts:26-31). Copy slots for Phase 12; hide canvas when the overlay shows. | index.html:14-27; webgl-fallback.ts:19-35 | L | S |
| S10 | **Studio is undiscoverable.** Entry is only `?studio=1` / Ctrl+Shift+D (ui-mode.ts:49,80-92); nothing in the user UI hints it exists. Review A1 open item: "document `?studio=1`". Decision needed — see §5.2. | ui-mode.ts:48-53,80-92 | M | S |
| S11 | Lock tooltip exposes internal key names to end users: `Zablokowane przez studio (volume)` (user-settings.ts:85). | user-settings.ts:82-87 | L | S |
| S12 | Interrupt button always enabled even when idle (conversation-dock.ts:32-40) — clicking it with nothing playing fires a pointless hardStop + barge-in toast (S6). Mute is likewise active before a session starts. | conversation-dock.ts:26-40 | L | S |
| S13 | A2F availability is not reflected in the segment: 11-UI-SPEC promised "A2F offline → option B disabled with reason tooltip"; the switcher builds buttons from the registry unconditionally (algorithm-switcher.ts:22-34); A2F-down surfaces only at compare time as a toast (compare-controller.ts:211-220). | algorithm-switcher.ts:22-34 | L | S |

### 3.4 Responsive / adaptive

| # | Finding | Evidence | Sev | Cost |
|---|---------|----------|-----|------|
| R1 | **No responsive breakpoints at all.** The only `@media` in 1,229 lines is `prefers-reduced-motion` (style.css:1215). Fixed-position chrome: `.user-dock` bottom-center (1062), `.user-algo` right-bottom `max-width:280px` (1096-1113), captions `max-width:720px` bottom 92 (596-607, 1168-1170), `.studio-left-toggles` mid-left column (983-992), `.telemetry` right drawer 380px (337-341). Below ~1024px width the dock (~450px with labels) and the algo panel begin to overlap each other and the captions. No minimum viewport is declared anywhere. | style.css (whole file) | H | M |
| R2 | `#app` is `100vw/100vh` with `overflow:hidden` (style.css:7-21); canvas resize is handled (container.ts:241-245) ✓. Declaring a min viewport + 2-3 guard queries closes the gap; desktop-first remains fine. | style.css:7-21 | L | S |

### 3.5 CSS architecture

| # | Finding | Evidence | Sev | Cost |
|---|---------|----------|-----|------|
| C1 | **~120 lines of dead CSS.** Zero TS/HTML references (verified per-class grep) for: `.top-dock` (36-56), `.dock-left/.dock-center/.dock-right` (58-64), `.brand` (67-71), `.telemetry-pill-card` + `.pill-header/.pill-label/.pill-val/.pill-fps-badge/.fps-unit/.pill-meta/.pill-buttons` (213-279), `.status-idle/.status-loading/.status-ready/.status-error` (300-303), `.align-badge/.align-el/.align-fallback` (305-315), `.modal-buttons` (776-781), `.select-input` (762), `.btn-presentation:hover` (205-208), plus presentation-mode rules targeting the dead top-dock/pill (681-688, 883-889 partially). | per-class grep vs src/**/*.ts + index.html | M | S |
| C2 | **Ad-hoc z-index scale**: 20 (loader) < 25 (vignette) < 30 (captions) < 35 (dead pill) < 40 (dock/status/algo) < 44 (left toggles) < 45 (studio shell) < 50 (drawers) < 100 (overlay, presentation exit) < 200 (toast). Toast(200) floats above the WebGL overlay(100); the loader(20) sits below captions(30) and dock(40) (see S2). No documentation. | style.css:817, 1203, 601, 217, 1077, 991, 939, 324, 850/657, 795 | M | S |
| C3 | Duplication: glass-panel recipe repeated 6× (`.top-dock`, `.telemetry-pill-card`, `.transcript-box`, `.user-dock`, `.user-status`, `.user-algo`); `transition: all 0.15s ease` on 15+ selectors (also a perf smell — `transition: all`); button recipe ×6. | style.css:36-56, 213-231, 609-621, 1062-1113 | M | S |
| C4 | One 1,229-line file with mixed-era sections (PoC HUD → F11 additions appended), Polish section comments, one mojibake comment ("Edytor Wizem�w", style.css:898). Keep single-file (no build changes) but with a documented TOC. | style.css:898 | L | S |

### 3.6 Microcopy

| # | Finding | Evidence | Sev | Cost |
|---|---------|----------|-----|------|
| M1 | **Strings are hardcoded inline across 18 modules** (~120 user-visible strings). Phase 12 (EN) would have to hunt Polish in every file. A slot registry (one pure module + `t()` helper) makes the translation mechanical and gives a single inventory. | all files in §6.3 | H (blocks Phase 12) | M |
| M2 | Copy inconsistencies: barge-in toast uses internal jargon ("Barge-in: Natychmiastowe przerwanie mowy agenta", conversation-controller.ts:136); mixed-language options ("Dark (ciemny)" / "Light (jasny)", user-settings.ts:56-57); title-case Polish on the presentation button ("👁️ Pokaż Panel Sterowania", container.ts:251); stale 11-06 copy (S7). | conversation-controller.ts:136; user-settings.ts:56-57; container.ts:248-253 | L | S |
| M3 | `index.html lang="pl"` (index.html:2) must flip to `en` with Phase 12; the WebGL fallback card strings (index.html:14-27) are the only user-visible strings outside modules — move rendering into `webgl-fallback.ts` so they slot too. | index.html:2,14-27 | L | S |
| M4 | User-layer icons are emoji (🎙️🎤🛑⚙️👁️ in dock/settings/presentation; status-pill.ts:18, conversation-dock.ts:19,27,37, user-settings.ts:20, container.ts:251) although 11-UI-SPEC mandated inline SVG for the user layer (emoji tolerated in studio until touched). Studio panel titles/icons remain emoji (per spec, acceptable). | conversation-dock.ts:19-38; 11-UI-SPEC §Design System | M | S |

---

## 4. Component & state inventory

### 4.1 Components

| Layer | Component | File (LOC) | Notes |
|---|---|---|---|
| user | ConversationDock | src/ui/user/conversation-dock.ts (66) | Start/End, Mute, Interrupt; label flips on `voice:state`/`voice:muted` |
| user | StatusPill | src/ui/user/status-pill.ts (43) | brand + 4-state pill |
| user | Captions | src/ui/user/captions.ts (48) | TY/AGENT lines, `textContent` |
| user | AlgorithmSwitcher | src/ui/user/algorithm-switcher.ts (111) | segment + Compare A/B + blind + status line |
| user | UserSettings | src/ui/user/user-settings.ts (123) | gear → modal; volume/mic/theme/preset; lock-aware |
| studio | StudioShell | src/ui/studio/studio-shell.ts (172) | right tabs + left drawers, lazy mount |
| studio | PanelRegistry | src/ui/studio/panel-registry.ts (138) | registry + error boundary |
| studio | AnimationPanel | panels/animation-panel.ts (232) | engine, source, presets, 9 sliders, phoneme tests |
| studio | VisemesPanel | panels/visemes-panel.ts (198) | chips + editor + resets (no confirm) |
| studio | InspectorPanel | panels/inspector-panel.ts (214) | 51 shapes, `<details>` accordion, mirror |
| studio | A2fPanel | panels/a2f-panel.ts (92) | URL, /status, demo, stats |
| studio | SessionPanel | panels/session-panel.ts (170) | agent, audio, telemetry, locks, profile I/O, PoC |
| studio | ScenePanel | panels/scene-panel.ts (110) | model load, preset radios |
| shared | dom/toast/loader/modal | src/ui/shared/ (176 total) | primitives to polish |
| app | UiMode | src/app/ui-mode.ts (94) | user/studio switching |
| app | Container (UI surfaces) | src/app/container.ts (344) | presentation mode, vignette, loader wiring |
| root | WebGLFallback | src/ui/webgl-fallback.ts (35) + index.html:14-27 | overlay card |
| css | style.css | 1,229 lines / 25 KB | see §3.1, §3.5 |

### 4.2 States coverage matrix (current)

✅ covered · ⚠️ partial · ❌ missing · — not applicable

| Component | loading | empty | error | ok | partial |
|---|---|---|---|---|---|
| ConversationDock | — | — | ❌ no connection-error surface, toast only (A3) | ✅ | — |
| Captions | — | ✅ '—' placeholders | — | ✅ streaming replace | ❌ unbounded length (S3); no correction update (S4) |
| StatusPill | — | — | ❌ no error/interrupted state | ✅ 4 states | ❌ silent during compare replay (S8) |
| AlgorithmSwitcher | ✅ 'A2F: przetwarzanie…' | ✅ empty-compare copy | ⚠️ A2F offline not gated in segment (S13); error→toast only | ✅ | ⚠️ partial warning via toast; blind leaks order (S8) |
| UserSettings | ✅ async device list | ✅ defaults always present | ✅ store defensive | ✅ | ✅ locks disabled+tooltip |
| StudioShell | ✅ sync lazy mount | ✅ first tab auto-open | ✅ per-panel boundary | ✅ | — |
| AnimationPanel | — | ✅ initial profile | — | ✅ | ✅ save/reset toasts |
| VisemesPanel | — | ✅ '— wybierz głoskę —', 'Brak głosek dla filtra.' | — | ✅ | ❌ destructive reset no confirm (S5) |
| InspectorPanel | — | ✅ zeros | — | ✅ | ✅ filter hides rows |
| A2fPanel | ✅ 'sprawdzanie…' | ✅ '—' | ✅ inline status line | ✅ | ✅ stats optional fields |
| SessionPanel | ✅ telemetry '--' | ✅ | ⚠️ toasts | ⚠️ dead mic select + stale copy (S7) | ✅ locks list |
| ScenePanel | ✅ loader | ✅ 'Model: brak…' | ✅ toast + loader hide | ✅ | — |
| Toast | — | — | ❌ no dismiss (A4), no AT role | ✅ | ❌ single slot overwrite (S6) |
| Loader | ✅ pill | — | ❌ hangs on double failure (S1); hidden under dock (S2) | ✅ | — |
| Modal | — | — | — | ✅ | ❌ no close button (A5) |
| WebGLFallback | — | — | ✅ card | — | ❌ dev-speak copy; canvas stays visible (S9) |

### 4.3 Microcopy slot inventory (current strings — Phase 12 fills EN here)

> Mechanism decision (§5.5): one pure registry module `src/app/copy.ts` with `t(slot, params?)`.
> Slot IDs are stable; values start as the current Polish strings. `{x}` marks interpolation.

**User layer**

| Slot | Current string | Location |
|---|---|---|
| brand.title | AVATAR AI | status-pill.ts:25 |
| status.idle / status.listening / status.speaking / status.thinking | Gotowy / Słucham… / Mówię… / Myślę… | status-pill.ts:7-12 |
| dock.start / dock.end | Rozpocznij rozmowę / Zakończ rozmowę | conversation-dock.ts:18-21,48-49 |
| dock.mute / dock.unmute | Wycisz / Włącz | conversation-dock.ts:26-29,54 |
| dock.muteAria / dock.unmuteAria | Wycisz mikrofon / Włącz mikrofon | conversation-dock.ts:26,53 |
| dock.interrupt / dock.interruptAria | Przerwij / Przerwij wypowiedź agenta | conversation-dock.ts:32-39 |
| captions.you / captions.agent / captions.empty | TY: / AGENT: / — | captions.ts:16-25 |
| algo.segmentAria | Źródło animacji | algorithm-switcher.ts:20 |
| algo.compare | Porównaj A/B | algorithm-switcher.ts:47 |
| algo.blind | Tryb blind | algorithm-switcher.ts:52 |
| algo.empty | Brak wypowiedzi do porównania — odbądź jedną turę rozmowy albo odtwórz demo, a potem wróć tutaj. | algorithm-switcher.ts:62 |
| algo.predicting | A2F: przetwarzanie… | algorithm-switcher.ts:69 |
| algo.playingA / algo.playingB | Odtwarzanie toru A… / Odtwarzanie toru B… | algorithm-switcher.ts:71 |
| algo.resultOrder | kolejność: {order} | algorithm-switcher.ts:78 |
| algo.orderLiveFirst / algo.orderA2fFirst | LIVE → A2F / A2F → LIVE | algorithm-switcher.ts:78 |
| algo.result | Wynik — {details} | algorithm-switcher.ts:81 |
| algo.resultPredictMs | predict {ms} ms | algorithm-switcher.ts:79 |
| algo.resultFrames | {frames} ramek | algorithm-switcher.ts:80 |
| algo.partialWarning | Uwaga: klip A2F jest krótszy niż wypowiedź (stan partial). | algorithm-switcher.ts:83 |
| algo.cancelled | Porównanie przerwane przez nową turę rozmowy. | algorithm-switcher.ts:88 |
| settings.title | Ustawienia | user-settings.ts:11,22,112 |
| settings.volumeLabel | Głośność wyjściowa: | user-settings.ts:92 |
| settings.micLabel | Mikrofon: | user-settings.ts:96 |
| settings.defaultDevice | Domyślne urządzenie | user-settings.ts:37,41 |
| settings.themeLabel | Motyw: | user-settings.ts:100 |
| settings.themeDark / settings.themeLight | Dark (ciemny) / Light (jasny) | user-settings.ts:56-57 |
| settings.presetLabel | Preset sceny: | user-settings.ts:104 |
| settings.lockTooltip | Zablokowane przez studio ({key}) | user-settings.ts:85 |
| presentation.show / presentation.showAria | 👁️ Pokaż Panel Sterowania / Pokaż interfejs | container.ts:251-252 |
| loader.default / loader.model | Ładowanie… / Ładowanie modelu 3D… | loader.ts:13,21 |
| boot.loadingModel | Ładowanie zrigowanego modelu MetaPerson 3D… | container.ts:308 |

**Conversation & compare (features layer — emits final strings today)**

| Slot | Current string | Location |
|---|---|---|
| toast.conversationEnded | Rozmowa zakończona. | conversation-controller.ts:100 |
| toast.conversationStarting | Rozpoczynanie rozmowy z agentem... | conversation-controller.ts:103 |
| toast.connectionError | Błąd połączenia: {message} | conversation-controller.ts:107 |
| toast.micMuted / toast.micUnmuted | Mikrofon: Wyciszony / Mikrofon: Włączony | conversation-controller.ts:118 |
| toast.bargeIn | Barge-in: Natychmiastowe przerwanie mowy agenta | conversation-controller.ts:136 |
| toast.agentChanged | Zmieniono agenta na: {id} | conversation-controller.ts:147 |
| poc.start / poc.interrupt1 / poc.interrupt2 / poc.done | Uruchamianie testu PoC Stress (3 sekwencje z przerwaniami)... / Przerwanie 1/2 zrealizowane / Przerwanie 2/2 zrealizowane / Test PoC Stress zakończony sukcesem (0 wycieków węzłów) | conversation-controller.ts:159-185 |
| poc.phases (×3) | [Faza 1/3] Mówię zdanie, które zostanie przerwane w połowie... / [Faza 2/3] Natychmiastowa druga wypowiedź i szybkie cięcie... / [Faza 3/3] Pełna fraza bez przerwania — naturalny powrót do spoczynku. | conversation-controller.ts:165,174,183 |
| poc.transcriptUser | Test obciążeniowy PoC | conversation-controller.ts:163 |
| compare.failedToast | Porównanie nie powiodło się: {message} | compare-controller.ts:154 |
| compare.a2fDownToast | A2F niedostępny — sprawdź adres serwisu w Studio → A2F. ({message}) | compare-controller.ts:215 |

**Studio panels**

| Slot | Current string | Location |
|---|---|---|
| studio.title / studio.subtitle | Studio / Konfiguracja i diagnostyka awatara | studio-shell.ts:44-45 |
| studio.tabsAria | Panele studia | studio-shell.ts:38 |
| studio.closeAria | Zamknij studio | studio-shell.ts:35 |
| studio.leftOpenAria / studio.leftCloseAria | Otwórz {panel} / Zamknij {panel} | studio-shell.ts:110,96 |
| panel.errorTitle | Panel „{title}” nie mógł się załadować. | panel-registry.ts:67 |
| panel.retry | Spróbuj ponownie | panel-registry.ts:61 |
| session.agentTitle / session.agentPlaceholder / session.agentSave | Agent: / agent_xxx... / Zapisz agenta | session-panel.ts:134,22,24 |
| session.agentEmptyError | Agent ID nie może być pusty. | session-panel.ts:28 |
| session.audioTitle | Audio: | session-panel.ts:139 |
| session.micComingSoon (REMOVE) | Wybór urządzenia mikrofonu dostępny po 11-06. | session-panel.ts:143 |
| session.telemetryTitle + labels | Telemetria: / FPS: / TTFB: / Barge-in: / Sesja: | session-panel.ts:146,58-61 |
| session.alignEl / session.alignFallback | ALIGN: EL ✓ ({count}) / ALIGN: FALLBACK ⚠ ({el}/{fb}) | session-panel.ts:72-73 |
| session.locksTitle / session.lockLabel | Blokady ustawień (dla usera): / {key} (blokada dla usera) | session-panel.ts:151,85 |
| session.profileTitle | Profil tweakera: | session-panel.ts:155 |
| session.exportProfile / session.importProfile | ⬇ Eksportuj profil / ⬆ Importuj profil | session-panel.ts:91,124 |
| session.exported / session.imported / session.importRejected | Profil wyeksportowany. / Profil zaimportowany. / Import odrzucony. | session-panel.ts:100,116,118 |
| session.exportFailed / session.importFailed | Eksport/Import nie powiódł się: {message} | session-panel.ts:102,121 |
| session.stress | ⚡ PoC Stress | session-panel.ts:127 |
| scene.modelTitle / scene.modelNone / scene.modelInfo | Model awatara: / Model: brak (ładowanie w toku...) / Model: {name} · shapes: {shapes} · meshe mowy: {meshes} | scene-panel.ts:87,20,22 |
| scene.loadDemo / scene.generatingDemo / scene.demoError | Wczytaj demo / Generowanie demonstracyjnego awatara... / Błąd generowania: {message} | scene-panel.ts:26,28,34 |
| scene.chooseGlb / scene.loadingFile / scene.fileError | Wybierz .GLB / Wczytywanie pliku {name}... / Błąd ładowania: {message} | scene-panel.ts:42,49,54 |
| scene.presetsTitle / scene.presetsHint | Presety sceny: / Preset zmienia tło, światło, exposure i kadr (crossfade 280 ms; reduced-motion = natychmiast). | scene-panel.ts:92,94-97 |
| animation.engineLabel / engineHint | Fonemowy silnik EN (G2P) / ON = litery → fonemy (CMUdict); OFF = stara tabela znaków | animation-panel.ts:66,68 |
| animation.sourceLabel / sourceViseme / sourceFrames / sourceHint | Źródło animacji: / LIVE wizemy (domyślne) / A2F (frames) / frames = absolutne ramki neuronowe; wybierz i odpal „▶ Demo A2F" poniżej | animation-panel.ts:85,75-76,88 |
| animation.presetsTitle + 3 preset labels | 1. Profile artykulacji: / 🎯 Dyskretny / 🌟 Naturalny / 🎭 Ekspresyjny | animation-panel.ts:117,95-97 |
| animation.phonemesTitle + 7 phoneme labels | 2. Podgląd ułożenia ust (statyczny test): / [ A ] [ E / I ] [ O / U ] [ M / B / P ] [ SZ / CZ ] [ F / V ] Spoczynek | animation-panel.ts:143,36-42 |
| animation.phrasePl / phraseEn / demoA2f | ▶ Zdanie testowe (PL) / ▶ Sample Speech (EN) / ▶ Demo A2F (frames) | animation-panel.ts:133,135,137 |
| animation.geometryTitle / dynamicsTitle | 3. Geometria ust i zębów: / 4. Dynamika i synchronizacja AV: | animation-panel.ts:153,156 |
| animation.sliderLabels (×9) | Głębokość otwarcia żuchwy (jawOpen) … Przesunięcie synchronizacji AV (Audio Lead) | animation-panel.ts:24-32 |
| animation.save / animation.reset / savedToast / resetToast | 💾 Zapisz Profil / ↺ Przywróć Domyślne / Profil kalibracji fonetycznej zapisany w pamięci! / Przywrócono domyślny profil kalibracji | animation-panel.ts:184-194 |
| a2f.urlTitle / urlPlaceholder / save / urlInvalid / urlSaved | Serwis A2F (wrapper /predict): / http://127.0.0.1:8000 / Zapisz URL / Nieprawidłowy URL — dozwolone tylko http:// lub https://. / Adres serwisu A2F zapisany. | a2f-panel.ts:71,22,26,30,34 |
| a2f.checkStatus / statusIdle / statusChecking / statusOk / statusDown | Sprawdź /status / Status: — / Status: sprawdzanie... / Status: {status} · {gpu} · uptime {uptime}s / Status: brak połączenia ({message}) | a2f-panel.ts:38,37,41,46-48,50 |
| a2f.demoTitle / demo / stats | Demo neuronowe (frames): / ▶ Demo A2F (frames) / A2F: {details} | a2f-panel.ts:77,55,60-66 |
| visemes.groupEn / groupChar / searchPlaceholder | Silnik EN (fonemy G2P) / Ścieżka znaków (PL / fallback) / 🔍 Filtruj głosek... | visemes-panel.ts:52-55 |
| visemes.pickViseme / stateDefault / stateOverride / noMatches | — wybierz głoskę — / domyślna / ⚙ nadpisana / Brak głosek dla filtra. | visemes-panel.ts:58,110,155 |
| visemes.resetKey / resetAll / hint | ↺ Reset tej głoski (domyślna) / ✖ Reset WSZYSTKICH głosek / Zmiany zapisują się automatycznie i działają w live lip-syncu. Podgląd znika, gdy agent zacznie mówić. | visemes-panel.ts:66-67,74 |
| visemes.shapeLabels (×11) | Otwarcie żuchwy (jawOpen) … Ściśnięcie warg (L+P) | visemes-panel.ts:21-32 |
| inspector.searchPlaceholder / resetAll / mirror / mirrorHint | 🔍 Szukaj kształtu (np. jaw, roll, eye)... / Resetuj wszystko / Symetrycznie L/R (smile, press, brow, oko…) / jaw/mouth translacje zostają osobno | inspector-panel.ts:132-145 |
| inspector.categoryTitles (×5) / shapeLabels (×51) | 🦴 Żuchwa (4) … 😊 Policzki & Nos (5) / jawOpen (Otwarcie żuchwy) … | inspector-panel.ts:21-96 |
| scenePreset labels (×4) | Studio Dark / Studio Soft / Cinema / Light (jasny motyw) | scene-presets.ts:21-57 |
| webgl.title / body / subtext / fallbackBtn | ⚠️ Brak obsługi WebGL / Twoja przeglądarka lub karta graficzna nie obsługuje WebGL / akceleracji sprzętowej. / Upewnij się, że masz włączoną akcelerację sprzętową w ustawieniach przeglądarki. / Przejdź do trybu Audio 2D (Graceful Degradation) | index.html:16-24 |

---

## 5. Scope decisions

### 5.1 In scope
Everything in §3 with a UI address: tokens/theming/typography, primitives contract, a11y,
states/error-recovery/first-run, feedback hygiene, compare UX, responsive guards, copy slots,
studio discoverability, icon pass (user layer), CSS hygiene. Minimal **cross-seams** (flagged
for Phase 14 review, each ≤ ~10 lines): surfacing mic-denied + `onAgentCorrection` wiring in
`speech-backend.ts`, `avatar:error` emit in `scene-controller.ts`, toast de-spam edits in
`conversation-controller.ts`, `AppServices.uiMode` addition in `app-types.ts`/`container.ts`.

### 5.2 Studio discoverability — decision
**Add a discreet "Studio mode" toggle inside the user Settings modal** (footer row: switch +
"Ctrl+Shift+D" hint), routed through `AppServices.uiMode` (lock-respecting), and **keep
`?studio=1` as a documented backdoor** (README mention is Phase 13's). Rationale: the
hidden-studio story is a portfolio selling point, but a visitor with no hint will never find
Ctrl+Shift+D; a settings-buried switch stays out of the demo frame while making the feature
real. The `uiMode` lock already prevents end-user escape in embedded deployments.

### 5.3 Minimum viewport
Declare **1152×648** (smallest common 16:9 laptop) as the supported minimum; verified tiers:
1920×1080, 1440×900, 1280×720, 1152×648. Guard queries at ≤1440px and ≤1280px (and an
emergency ≤1152px collapse: algo panel → icon-only column, dock labels stay). No mobile
support claim.

### 5.4 Icons
User layer: inline SVG (Lucide-path style, MIT — consistent with 11-UI-SPEC) for dock buttons,
gear, presentation exit, status dot, drawer/panel closes. Studio panel titles keep emoji
(spec-tolerated) except files already touched. No icon library dependency.

### 5.5 Microcopy mechanism
`src/app/copy.ts` (pure data + `t(slot, params?)`, no DOM imports — importable by both `ui/`
and `features/`). Values remain Polish until Phase 12 swaps them (then `index.html lang="en"`
flips in Phase 12). Slot IDs per §4.3 are the contract; the table is the single inventory.
Location may be re-homed by Phase 14, slot IDs must not change.

### 5.6 Out of scope (explicitly)
Embed-bridge UX (postMessage API), A2F service semantics, new scene presets (deferred in
F11), video/UX of telemetry sampling rate, bundle size work (STATE.md open item), any
backend/a2f/ folder changes.

---

## 6. Proposed requirements

- **UIX-01 — Design tokens & theming**: `style.css` is driven by CSS custom properties
  (color/type/spacing/radius/shadow/z-index/motion); dark+light themes via `body.theme-light`
  token swaps; **all** interactive surfaces (buttons, selects, chips, inputs, dialog, toast,
  captions, drawers) are readable in both themes; zero raw hex outside token definitions;
  `#f0c` typo gone; z-index uses a documented scale.
- **UIX-02 — Typography & targets**: no text below 12px; type roles per 11-UI-SPEC
  (Display 28 / Heading 18 / Body 14 / Label 12; weights 400/600); interactive targets
  ≥36px (user dock ≥40px); spacing in 4px multiples.
- **UIX-03 — Shared primitives contract**: toast = `role=status` (errors `role=alert`) with a
  visible close button on persistent (error) toasts; modal = visible close button +
  `aria-labelledby` + native Esc; loader = `role=status`, positioned clear of the dock and
  above it in z-order, always removed on success **or** failure; contract documented in
  15-DRAFT-ui-spec.md and covered by unit tests.
- **UIX-04 — Accessibility**: aria-live (polite) on captions, status pill, algo status;
  label/id association for every form control; tablist keyboard support (roving tabindex,
  arrows, Home/End) + `tabpanel` wiring; file upload keyboard-reachable; decorative elements
  `aria-hidden`; `prefers-reduced-motion` covers every animation incl. pulse-border and
  spinner; Esc no longer double-fires with open dialogs; keyboard-only pass completes on the
  user layer without traps.
- **UIX-05 — States & recovery**: connection failure shows an inline banner with
  "Try again" (consumes `voice:error`); mic-denied shows distinct guidance + retry and never
  fakes "listening"; avatar double-failure surfaces an error and clears the loader; captions
  clamp to 3 lines with fade and apply `agent_response_correction`; destructive resets confirm
  via modal; session panel dead control removed.
- **UIX-06 — Feedback hygiene & compare UX**: routine state changes (mute, interrupt, agent
  change) are silent-or-inline (no toasts); compare shows A/B chips with live track
  highlight, a cancel affordance while running, and blind-safe results (order hidden until
  "reveal"); interrupted turns visibly flash captions.
- **UIX-07 — Responsive integrity**: min viewport 1152×648 declared; no overlap or clipped
  controls at 1920×1080 / 1440×900 / 1280×720 / 1152×648; guard media queries at ≤1440px and
  ≤1280px; drawers/captions/dock never collide.
- **UIX-08 — Discoverability & first-run**: Settings modal exposes a lock-respecting
  "Studio mode" switch with the shortcut hint; `?studio=1` stays and is documented (Phase 13);
  a no-credentials visitor gets a coherent sequence: loader → avatar → idle state, with
  honest errors at every failure point.
- **UIX-09 — Microcopy slots**: every user-visible string flows through `src/app/copy.ts`
  slot registry + `t()`; no inline literals in UI modules; slot table (§4.3 +
  15-DRAFT-ui-spec.md) is the Phase 12 handoff; WebGL card strings move into the module.
- **UIX-10 — Icon system (user layer)**: dock/gear/close/presentation/status icons are inline
  SVG with `aria-hidden` + text labels preserved; user layer contains no emoji.
- **UIX-11 — CSS hygiene**: dead rules (§3.5 C1) removed; glass/button recipes deduplicated;
  documented TOC sections in `style.css`; regression test guards token usage and the 12px
  floor.

---

## 7. Cross-area notes (for the orchestrator)

1. **Phase 12 (EN)**: consumes `src/app/copy.ts` + the §4.3 slot table. After 15-02 lands,
   translation = editing values in one file + `index.html lang` flip. The WebGL card must
   first move out of `index.html` (15-02 task) or its strings can't slot.
2. **Phase 13 (README)**: screenshot session should run **after** Phase 15 (light theme is
   currently broken — screenshots of it would be misleading). Requested shots listed in
   15-VERIFICATION.md §5 (user dark, user light, studio overview, compare A/B, presentation
   mode). Quickstart facts: `public/models/avatar.glb` (11.9 MB), committed in 11.2 (SHOW-09; amended 2026-11-19), means the real
   avatar loads with zero setup; conversation needs a public agent + mic permission; demo
   avatar fallback exists in Scene panel.
3. **Phase 14 (architecture)**: bless/adjust four cross-seams created here — mic-error
   surfacing + `onAgentCorrection` wiring (`speech-backend.ts`), `avatar:error` event
   (`scene-controller.ts`, `app-types.ts`), toast de-spam edits (`conversation-controller.ts`),
   `AppServices.uiMode` (`app-types.ts`, `container.ts`); also the `copy.ts` module home and
   the volume-slider store-write churn (optional debounce).
4. **Phase 16/17**: compare chips/cancel/reveal ride entirely on existing
   `compare:state/result/cancelled` events; blind reveal needs nothing from the pipeline.
   A2F availability gating in the segment (S13) would benefit from an `available()` probe —
   currently only `/status` fetch in the A2F panel; suggest Phase 16 owns the probe.
5. **Phase 18 (CI)**: consider adding two cheap gates: (a) the token/12px CSS regression test
   from UIX-11; (b) grep gate forbidding new `aria-live`-less rewrites of the primitives.
6. **STATE.md A1 leftovers not owned here**: CMUdict pruning (bundle), `?studio=1` doc →
   resolved by UIX-08 for the UI side; README wording is Phase 13.

## 8. Sources read

`src/ui/**` (all 18 files), `src/app/{container,ui-mode,app-types}.ts`,
`src/app/store/{settings-schema,settings-store}.ts`, `src/features/{conversation,compare,
scene-preset-controller,scene-presets,scene,animation,telemetry-controller}.ts` (UI-facing
parts), `src/audio/{speech-backend,agent-config,raw-wss-client,mic-capture}.ts` (error paths),
`src/avatar/{test-avatar-generator,model-cache}.ts`, `src/style.css` (full, 1,229 lines),
`index.html`, `src/main.ts`, `public/` listing, `tests/` listing (41 files),
`.planning/ROADMAP.md`, `STATE.md`, phase-11 `11-CONTEXT.md`, `11-UI-SPEC.md`,
`11-06-PLAN.md`, `11-VERIFICATION.md`.
