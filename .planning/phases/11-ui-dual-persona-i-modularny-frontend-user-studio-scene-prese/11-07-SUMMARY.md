---
phase: 11-ui-dual-persona-i-modularny-frontend-user-studio-scene-prese
plan: 07
subsystem: scene-presets-and-phase-verification
tags: [scene-presets, tween, reduced-motion, css-vignette, uat, verification, gsd]

requires:
  - phase: 11-01
    provides: SettingsStore (scenePreset, scenePresetManual)
  - phase: 11-02
    provides: Composition root, pętla render
  - phase: 11-03
    provides: PanelRegistry
  - phase: 11-04
    provides: Panel Scena (placeholder), user-settings
  - phase: 11-05
    provides: rejestr źródeł (retro F9/F10)
  - phase: 11-06
    provides: user shell, picker presetu w user-settings
provides:
  - Scene presets: studio-dark / studio-soft / cinema / light (dane + controller z tweenem 280 ms)
  - API sceny/kamery: setPedestal, setBackgroundColor, setFraming (bust z=1.22 / head z=0.9)
  - Pickery presetów w panelu Scena i user-settings (zero-one-many)
  - Winieta CSS tylko dla cinema; prefers-reduced-motion w stylach
  - 11-VERIFICATION.md (bramki automatyczne PASS; UAT manualny pending) + retrospekcja/korekta dla Faz 9-10
affects:
  - src/features/scene-presets.ts
  - src/features/scene-preset-controller.ts
  - src/core/scene.ts
  - src/core/camera.ts
  - src/ui/studio/panels/scene-panel.ts
  - src/ui/user/user-settings.ts
  - src/app/container.ts
  - src/style.css
  - docs/5-shadery-i-realizm.md
  - .planning/phases/11-ui-dual-persona-i-modularny-frontend-user-studio-scene-prese/11-VERIFICATION.md

tech-stack:
  added: []
  patterns: [Scene preset data + controller (tween lerp w pętli render), Cache CanvasTexture z dispose, Theme→preset sync gated na scenePresetManual]

key-files:
  created:
    - src/features/scene-presets.ts
    - src/features/scene-preset-controller.ts
    - tests/scene-presets.test.ts
  modified:
    - src/core/scene.ts
    - src/core/camera.ts
    - src/ui/studio/panels/scene-panel.ts
    - src/ui/user/user-settings.ts
    - src/app/container.ts
    - src/style.css
    - docs/5-shadery-i-realizm.md
    - .planning/phases/11-ui-dual-persona-i-modularny-frontend-user-studio-scene-prese/11-VERIFICATION.md

key-decisions:
  - "Presety przełączane w runtime (tween świateł + exposure 280 ms); prefers-reduced-motion: reduce → zmiana natychmiastowa"
  - "Tło gradientowe = cache'owana CanvasTexture (SRGBColorSpace) z dispose poprzedniej — brak wycieku GPU (test)"
  - "Sync z motywem: onThemeChange sugeruje preset tylko gdy scenePresetManual !== true (decyzja Open Q2)"
  - "Zero postprocessingu w domyślnym presecie — winieta wyłącznie CSS (body[data-scene=\"cinema\"], opacity 0.35)"
  - "Custom preset z JSON tweakera świadomie odroczone poza Fazę 11"
  - "UAT manualne pozostaje pending — backstopy (60 FPS @1080p, RMS < 1%) wymagają pomiaru człowieka z GPU/mikrofonem"

patterns-established:
  - "Rejestr źródeł animacji + CompareController jako kontrakty dla Faz 9/10 (retro w 11-VERIFICATION.md §4)"

requirements-completed:
  - UI-01
  - UI-02
  - UI-03
  - UI-04
  - UI-05

duration: 150min
completed: 2026-09-10
status: complete
---

# Phase 11: Plan 07 Summary

**Presety sceny (dane, controller z tweenem, pickery w obu warstwach), szlif a11y/CSS oraz domknięcie fazy: 11-VERIFICATION.md z bramkami automatycznymi PASS i retrospekcją dla Faz 9-10.**

## Accomplishments
- Utworzono `scene-presets.ts` (ScenePreset, SCENE_PRESETS: studio-dark/studio-soft/cinema/light wg UI-SPEC) i API w `scene.ts` (setPedestal/setBackgroundColor) oraz `camera.ts` (setFraming bust z=1.22 / head z=0.9).
- Utworzono `scene-preset-controller.ts`: apply(id) z tweenem 280 ms (update(dt) w pętli render), tło color/gradient (CanvasTexture 256×2, SRGBColorSpace, dispose poprzedniej), reduced-motion instant, onThemeChange gated na scenePresetManual, currentId/list/dispose.
- Dopięto pickery: `scene-panel.ts` (studio; zapis studio.scenePreset/user.scenePreset + scenePresetManual) i `user-settings.ts` (miniaturki; picker ukryty gdy < 2 presety); container ustawia body[data-scene] dla winiety CSS.
- style.css: winieta radial-gradient pointer-events:none tylko dla cinema (0.35), prefers-reduced-motion wyłącza pulse/przejścia, :focus-visible z akcentem; docs/5-shadery-i-realizm.md: sekcja „Presety sceny (F11)".
- Testy `tests/scene-presets.test.ts` (156 linii): 4 unikalne id, wartości docelowe po tweenie (±0.01), reduced-motion instant, dispose tekstur, theme sync z/bez flagi, pedestal/framing.
- Domknięto fazę w `11-VERIFICATION.md`: bramki automatyczne PASS — `npm test` 41 plików / 202 testy (start fazy: 33/146), build TS+vite, main.ts 24 linie, grepy czyste, god-objects usunięte, zero micSensitivity; retrospekcja F9/F10 (rejestr źródeł, porównywarka dla E2E, a2fUrl w store) zapisana.
- UAT manualny (60 FPS @1080p, zrzuty presetów, słuchowe A/B, RMS < 1%, a11y, regresja 10 min): **pending** — wymaga GPU/mikrofonu; po wypełnieniu zmienić manual_uat: pass i status: verified w 11-VERIFICATION.md.