---
phase: 11
slug: ui-dual-persona-i-modularny-frontend-user-studio-scene-prese
status: executed
automated: pass
manual_uat: pending
created: 2026-09-10
---

# Phase 11 — VERIFICATION

> Wynik egzekucji planów 11-01..11-07 (implementacja inline, pętla plan-po-planie; planner subagent
> zawodził w tym środowisku, dlatego plany napisano i wykonano inline, a weryfikację planów
> przeprowadził osobny agent gsd-plan-checker — VERIFICATION PASSED, 0 blockerów).

---

## 1. Bramki automatyczne (PASS)

| Gate | Wynik | Dowód |
|------|-------|-------|
| `npm test` (pełna regresja) | ✅ **41 plików / 202 testy zielone** | start fazy: 33 pliki / 146 testów |
| `npm run build` (tsc + vite) | ✅ przechodzi | brak błędów TS |
| Nowe pliki testów | ✅ 6/6 | `settings-store`, `ui-mode`, `events`, `panel-registry`, `compare-controller`(+registry), `pcm-to-wav`, `scene-presets`, `mic-capture-device` (8 plików) |
| `main.ts` ≤ 100 linii | ✅ **24 linie** | grep/lines |
| Brak DOM w kontrolerach | ✅ 0 trafień `getElementById|document.` w `src/features/` | grep |
| Brak `keydown` poza `src/app/` | ✅ 0 trafień | grep |
| Usunięte god-objects | ✅ `src/ui/hud.ts`, `src/app/legacy-hud-adapter.ts`, `src/prod/settings-modal.ts` nie istnieją | Test-Path |
| Zero martwych ustawień | ✅ 0 trafień `micSensitivity` w `src/` i `index.html` | grep |
| Legacy bez utraty danych | ✅ testy migracji pole-po-polu (kalibracja + wizemy) + backup | `tests/settings-store.test.ts` |
| Fairness A/B (jedno PCM) | ✅ test bajtów + `rmsDiff` = 0 dla identycznych ścieżek | `tests/compare-controller.test.ts` |

## 2. Mapowanie wymagań → dowody

| Req | Status | Dowód automatyczny | UAT manualny |
|-----|--------|--------------------|--------------|
| UI-01 | ✅ kod | `?studio=1`/skrót/persystencja (`ui-mode.test`), `visibleIn` paneli (`panel-registry.test`), shell bez markupu paneli w `index.html` | smoke: tryb user/studio na żywo |
| UI-02 | ✅ kod | sekwencja A/B na tym samym PCM, cancel (interruption/user/chunk), blind order, partial (`compare-controller.test`), WAV (`pcm-to-wav.test`) | słuchowe A/B, blind |
| UI-03 | ✅ kod | presety + tween + reduced-motion + dispose tekstur (`scene-presets.test`), picker <2 ukryty | 60 FPS + zrzuty wizualne |
| UI-04 | ✅ kod | store precedencja/locki/export-import, kontrolery bez DOM, `main.ts` 24 linie | smoke rozmowy po refaktorze |
| UI-05 | ✅ kod | locki (store + UI disabled), export/import round-trip, brak martwego pola | weryfikacja blokad w UI |

## 3. Manualne UAT (⏳ do wykonania przez człowieka; wymaga GPU/mikrofonu)

> Instrukcje z `11-VALIDATION.md`. Wpisz wynik i dowód przy zamknięciu.

- [ ] **60 FPS @ 1080p** na domyślnym presecie (`studio-dark`) i przy przełączaniu presetów — licznik FPS w Studio → Sesja; 2 min mowy na preset. *(backstop — bez pomiaru nie ma passa)*
- [ ] **Presety sceny wizualnie**: zrzuty każdego z 4 presetów (tło/światło/kadr), w tym `cinema` z winietą i `light` w motywie jasnym.
- [ ] **Porównywarka**: tura rozmowy → „Porównaj A/B" (chipsy/wynik), tryb blind, przerwanie nową turą; słyszalnie to samo nagranie w obu torach.
- [ ] **Fairness audio**: nagranie torów → RMS diff < 1% (held-out). *(backstop)*
- [ ] **Dostępność**: Tab po UI (focus-visible), aria-label na gear/zamknięciach, `prefers-reduced-motion` wyłącza animacje.
- [ ] **Regresja rozmowy**: 10 min rozmowy (2×), barge-in 10×, LIVE i A2F (jeśli wrapper dostępny), brak wycieków węzłów audio.

## 4. Retrospekcja i korekta Faz 9–10 (obowiązkowa)

**Co zmieniło F11 dla F9 (lokalny A2F):**
1. **Rejestr źródeł animacji** (`src/lipsync/animation-sources.ts`) — F10 dorejestruje `a2f-cloud` jako wpis danych; segment w warstwie user czyta rejestr (zero zmian shella).
2. **Porównywarka gotowa** — F9 E2E może użyć `CompareController` + `LastTurnBuffer` + `encodeWav` (sędzia A/B na tym samym PCM) zamiast pisać własny replay.
3. **Panel A2F** w studiu przejmuje URL `/status`, demo i statystyki — zadanie 09-04 (przełącznik HUD) jest **zrealizowane inaczej**: segment LIVE/A2F (user) + panel (tweaker); plan 09-04 aktualizuje tylko checklistę użycia.
4. **`a2fUrl` w SettingsStore** (precedencja + walidacja http/https) — F9/F10 czytają `store.getEffective('a2fUrl')` zamiast legacy klucza.

**Co zmieniło F11 dla F10 (chmura):**
1. Nowe źródło = `registry.register({ id: 'a2f-cloud', label, short:'A2F', available: () => fetchStatus(cloudUrl), apply })` — bez zmian UI.
2. Jeśli dojdzie osobny URL cloud: rozszerzyć schemat store do v2 (migracja: bump `schemaVersion` + merge defaultów — mechanizm gotowy).
3. Polityka scale-to-zero bez zmian; cold start obsłużony komunikatem „A2F: przetwarzanie…" w segmencie.

**Lekcje wykonawcze:**
- Subagenty `gsd-planner` w tym środowisku nie zapisywały plików (2× pusty powrót) → plany i wykonanie inline, weryfikacja osobnym agentem (działa niezawodnie).
- Dodano devDependency `jsdom` (1 plik smoke `tests/container.test.ts`) — zgodnie z limitem „≤2 pliki DOM" z planu; runtime bez nowych zależności.
- Tryb przejściowy 11-04→11-06: stary top-dock usunięty w 11-06 (zastąpiony warstwą user).

## 5. Zamknięcie

- Bramki automatyczne: **PASS** (41/202, build, grepy).
- UAT manualny: **PENDING** — po wypełnieniu zmienić `manual_uat: pass` i `status: verified`.
- Deferred (poza zakresem F11): custom preset sceny z JSON tweakera (świadomie odłożone), zapis wyniku blind do telemetrii.
