---
phase: 11-ui-dual-persona-i-modularny-frontend-user-studio-scene-prese
plan: 03
subsystem: studio-shell-panel-registry
tags: [ui-shell, panel-registry, shared-primitives, a11y, gsd]

requires:
  - phase: 11-02
    provides: AppEvents/AppServices, kontrolery
provides:
  - Shared UI primitives: dom (el/on/listen), toast, loader, modal (src/ui/shared/)
  - PanelRegistry (visibleIn user|studio, lazy mount, per-panel error boundary) + StudioShell (tablist, drawery)
affects:
  - src/ui/shared/dom.ts
  - src/ui/shared/toast.ts
  - src/ui/shared/loader.ts
  - src/ui/shared/modal.ts
  - src/ui/studio/panel-registry.ts
  - src/ui/studio/studio-shell.ts

tech-stack:
  added: []
  patterns: [Panel registry (visibleIn), Factory + destroy-handle, Per-panel error boundary]

key-files:
  created:
    - src/ui/shared/dom.ts
    - src/ui/shared/toast.ts
    - src/ui/shared/loader.ts
    - src/ui/shared/modal.ts
    - src/ui/studio/panel-registry.ts
    - src/ui/studio/studio-shell.ts
    - tests/panel-registry.test.ts

key-decisions:
  - "Panel = { id, title, icon, visibleIn: 'user'|'studio', mount(ctx): PanelHandle } — przeniesienie funkcji między personami to zmiana jednego pola"
  - "Renderowanie tekstów wyłącznie przez textContent (0 trafień innerHTML w src/ui/shared) — mitigacja XSS"
  - "Mount idempotentny (destroy poprzedniego handle), błąd w mount → renderPanelError + retry bez psucia sąsiednich paneli"

patterns-established:
  - "Wszystkie komponenty UI to factory zwracające { destroy() } — brak wycieków listenerów (test destroyAll)"

requirements-completed:
  - UI-01

duration: 60min
completed: 2026-09-10
status: complete
---

# Phase 11: Plan 03 Summary

**Fundament warstwy UI: shared primitives (dom/toast/loader/modal) + PanelRegistry i StudioShell z tablistą, lazy mountem i error boundary — panele podłączone w 11-04.**

## Accomplishments
- Utworzono `dom.ts` (el/on/listen, zero zależności), `toast.ts` (auto-hide 5 s), `loader.ts`, `modal.ts` — wszystkie przez textContent, factory z destroy.
- Utworzono `panel-registry.ts`: PanelContext/PanelDefinition/PanelHandle, filtr visibleIn, mount idempotentny, per-panel error boundary z ponowieniem.
- Utworzono `studio-shell.ts`: prawy drawer z tabami z rejestru (role=tablist, aria-selected, strzałki), lewe drawery, lazy mount aktywnych tabów, przycisk zamknięcia, destroy().
- Testy `tests/panel-registry.test.ts` (119 linii): filtracja visibleIn, idempotentny mount, error boundary + retry, destroyAll.
- `npm run build` + `npm test` zielone; grep: brak getElementById w src/ui/shared i src/ui/studio.
- UAT manualny (shell w dev): pending — wpis w 11-VERIFICATION.md.