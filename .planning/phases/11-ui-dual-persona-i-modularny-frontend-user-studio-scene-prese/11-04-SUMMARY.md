---
phase: 11-ui-dual-persona-i-modularny-frontend-user-studio-scene-prese
plan: 04
subsystem: studio-panels
tags: [panels, hud-decomposition, locks, export-import, model-loading, gsd]

requires:
  - phase: 11-03
    provides: PanelRegistry, StudioShell, shared primitives
provides:
  - Sześć paneli studia (Animacja, Wizemy, Inspektor, A2F, Sesja, Scena) przeniesionych 1:1 z hud.ts/index.html
  - Nowe powierzchnie: ładowanie modelu, locki, export/import profilu
  - Usunięte god-objects: src/ui/hud.ts, src/app/legacy-hud-adapter.ts, src/prod/settings-modal.ts
affects:
  - src/ui/studio/panels/animation-panel.ts
  - src/ui/studio/panels/visemes-panel.ts
  - src/ui/studio/panels/inspector-panel.ts
  - src/ui/studio/panels/a2f-panel.ts
  - src/ui/studio/panels/session-panel.ts
  - src/ui/studio/panels/scene-panel.ts
  - src/features/scene-controller.ts
  - src/app/container.ts

tech-stack:
  added: [jsdom (devDependency, 1 plik smoke tests/container.test.ts)]
  patterns: [Panels as modules (index.html = tylko shell), Store jako jedyne źródło zapisu ustawień]

key-files:
  created:
    - src/ui/studio/panels/animation-panel.ts
    - src/ui/studio/panels/visemes-panel.ts
    - src/ui/studio/panels/inspector-panel.ts
    - src/ui/studio/panels/a2f-panel.ts
    - src/ui/studio/panels/session-panel.ts
    - src/ui/studio/panels/scene-panel.ts
  modified:
    - src/features/scene-controller.ts
    - src/app/container.ts
    - index.html
  deleted:
    - src/ui/hud.ts
    - src/app/legacy-hud-adapter.ts
    - src/prod/settings-modal.ts

key-decisions:
  - "Panele przeniesione funkcjonalnie 1:1 (te same akcje/wartości co hud.ts) — markup budowany przez dom.el, brak getElementById"
  - "Locki w panelu Sesja: checkbox per klucz → store.setLock; zapis ustawień wyłącznie przez store"
  - "Import złego JSON → toast błędu bez zmiany stanu; eksport → pełny profil JSON"
  - "a2fUrl walidowane http/https — javascript: odrzucane z komunikatem z UI-SPEC"
  - "Zniesiono legacy mirror (legacy-bridge usunięty wraz z ostatnimi konsumentami legacy kluczy)"

patterns-established:
  - "index.html przestaje być źródłem prawdy markupu — panele rejestrują się w PanelRegistry"

requirements-completed:
  - UI-01
  - UI-05

duration: 150min
completed: 2026-09-10
status: complete
---

# Phase 11: Plan 04 Summary

**Sześć paneli studia przeniesionych z hud.ts do modułów za PanelRegistry, nowe powierzchnie (model, locki, profil) i usunięte trzy god-objects (hud.ts, legacy-hud-adapter, settings-modal).**

## Accomplishments
- Przeniesiono 1:1: kalibrator fonetyczny → `animation-panel.ts` (engine, źródło animacji, presety, 9 suwaków, głoski, demo A2F), edytor wizemów → `visemes-panel.ts`, inspektor 51 blendshape'ów → `inspector-panel.ts` (symetria L/R, search).
- Utworzono `a2f-panel.ts` (URL z walidacją, /status, demo, statystyki a2f:stats) i `session-panel.ts` (agentId, głośność, locki user.*, PoC stress, telemetria, eksport/import profilu JSON).
- Utworzono `scene-panel.ts`: ładowanie modelu (demo / .glb) przez SceneController z loaderem i tostem; SceneController rozszerzony o loadDemo/loadFile emitujące avatar:loaded.
- Usunięto `src/ui/hud.ts` (871 linii), `src/app/legacy-hud-adapter.ts`, `src/prod/settings-modal.ts` — potwierdzone brakiem plików na dysku; index.html zredukowany do shella.
- Tytuły paneli z ellipsis > 24 znaków; akcje przez AppServices, stan z busa; brak getElementById w panelach.
- `npm test` + `npm run build` zielone. UAT manualny (studio w dev, eksport/import na żywo): pending — 11-VERIFICATION.md.