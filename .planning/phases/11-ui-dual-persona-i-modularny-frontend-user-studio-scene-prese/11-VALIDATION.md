---
phase: 11
slug: ui-dual-persona-i-modularny-frontend-user-studio-scene-prese
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-10
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.11 (domyślne env `node`; per-file `// @vitest-environment happy-dom` gdy potrzebne) |
| **Config file** | `vite.config.ts` bez sekcji `test` (wystarcza domyślne; brak zmian wymaganych dla env node) |
| **Quick run command** | `npx vitest run tests/settings-store.test.ts tests/ui-mode.test.ts tests/events.test.ts tests/panel-registry.test.ts tests/compare-controller.test.ts tests/pcm-to-wav.test.ts tests/scene-presets.test.ts tests/mic-capture-device.test.ts` |
| **Full suite command** | `npm test` (brak regresji; 33 pliki / 146 testów przed fazą; `tests/settings-modal.test.ts` świadomie usunięty w 11-04) |
| **Estimated runtime** | ~4–6 s (obecne 3,3 s + 6 nowych plików) |

---

## Sampling Rate

- **After every task commit:** Run quick command (dotknięte pliki testowe)
- **After every plan wave:** Run `npm test` i `npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green; `npm run build` przechodzi
- **Max feedback latency:** ~10 s

---

## Per-Task Verification Map

> Mapowanie wstępne per plan (task ID uzupełni validate-phase po planach).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-* | 01 | 1 | UI-04, UI-05, UI-01 | — | Store precedence defaults→studio→user, locki, migracja legacy bez utraty, export/import, `scenePresetManual` | unit | `npx vitest run tests/settings-store.test.ts` | ❌ W0 | ⬜ pending |
| 11-01-* | 01 | 1 | UI-01 | — | `?studio=1`/skrót/persystencja, `body[data-mode]`; bus bez wycieków | unit | `npx vitest run tests/ui-mode.test.ts tests/events.test.ts` | ❌ W0 | ⬜ pending |
| 11-02-* | 02 | 2 | UI-04 | — | Composition root: kontrolery bez DOM; `audio:chunk` z `sampleRate`; `main.ts` cienki | unit + build | `npm test` && `npm run build` | ✅ | ⬜ pending |
| 11-03-* | 03 | 3 | UI-01 | — | `visibleIn` filtruje panele; mount/destroy bez wycieków; error boundary | unit | `npx vitest run tests/panel-registry.test.ts` | ❌ W0 | ⬜ pending |
| 11-04-* | 04 | 4 | UI-01, UI-05 | — | Panele 1:1; ładowanie modelu; locki w UI; export/import profilu; brak `micSensitivity` | build + smoke | `npm test` && `npm run build` | ✅ | ⬜ pending |
| 11-05-* | 05 | 4 | UI-02 | — | CompareController: capture→ready→A→B; ten sam PCM (RMS diff < 1%); cancel; partial; WAV | unit (fake ports) | `npx vitest run tests/compare-controller.test.ts tests/pcm-to-wav.test.ts` | ❌ W0 | ⬜ pending |
| 11-06-* | 06 | 5 | UI-01, UI-02, UI-05 | — | User shell: dock/segment/captions/settings; locki respektowane; mic `deviceId` end-to-end; compare wiring; a11y | unit + build + smoke | `npx vitest run tests/mic-capture-device.test.ts` && `npm test` && `npm run build` | ❌ W0 | ⬜ pending |
| 11-07-* | 07 | 6 | UI-03 | — | Presety: apply/tween/pedestal/framing; dispose tekstur; reduced-motion = instant; picker <2 ukryty | unit (real THREE lights, bez WebGL) | `npx vitest run tests/scene-presets.test.ts` | ❌ W0 | ⬜ pending |
| 11-07-* | 07 | 6 | UI-01..05 | — | UAT końcowe: 60 FPS @1080p, presety wizualnie, blind, a11y, RMS < 1% | manual | — | — | ⬜ pending |
| (regresja) | — | — | F1–F10 | — | Cała dotychczasowa domena | unit | `npm test` | ✅ | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `tests/settings-store.test.ts` — precedence/locks/export-import/migracja (UI-04/UI-05)
- [ ] `tests/ui-mode.test.ts` — URL/shortcut/persystencja (UI-01)
- [ ] `tests/events.test.ts` — TypedEventBus + Unsub (UI-04)
- [ ] `tests/panel-registry.test.ts` — visibleIn/mount/destroy (UI-01)
- [ ] `tests/compare-controller.test.ts` — sekwencja A/B, anulowanie, fairness (UI-02)
- [ ] `tests/scene-presets.test.ts` — apply/tween/pedestal/framing (UI-03)
- [ ] `tests/pcm-to-wav.test.ts` — nagłówek RIFF/długości (UI-02)
- [ ] `tests/mic-capture-device.test.ts` — mapowanie deviceId/getUserMedia (UI-05/UI-01)
- [ ] `tests/helpers/memory-storage.ts` — wspólny fake storage (wydzielony z `tests/settings-modal.test.ts`)
- [ ] (opcjonalnie) `npm i -D happy-dom` — tylko dla ≤ 2 plików DOM smoke (panel mount, aria/focus)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 60 FPS @ 1080p na domyślnym presecie sceny (i przy przełączeniu presetów) | UI-03 | Pomiar klatkażu wymaga realnego GPU/WebGL — poza env testów | Uruchom `npm run dev`, wczytaj `avatar.glb`, włącz licznik FPS, rozmawiaj 2 min na każdym presecie |
| Estetyka presetów sceny (tło/oświetlenie/kadr) | UI-03 | Ocena wizualna | Zrzuty A/B każdego presetu zapisane w 11-VERIFICATION.md |
| Tryb blind porównywarki — etykiety ukryte, wynik odsłaniany po wyborze | UI-02 | Ocena UX | Odbądź turę, kliknij „Porównaj A/B" z blind, sprawdź brak etykiet i odsłonięcie po wyborze |
| Dostępność: `aria-label` na kontrolkach icon-only, widoczny focus | UI-01 | Weryfikacja klawiaturowa/mouse | Tab po UI, focus-visible na wszystkich interaktywnych; screen-reader name na gear/zamknięciach |
| Brak regresji rozmowy/lip-syncu po refaktorze (F1–F10) | UI-04 | E2E z żywym agentem | 10 min rozmowy, barge-in 10×, oba tryby LIVE/A2F |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
