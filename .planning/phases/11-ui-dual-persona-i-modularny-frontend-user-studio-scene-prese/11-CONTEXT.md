---
phase: "11"
name: "UI dual-persona i modularny frontend"
created: "2026-09-10"
updated: "2026-09-10"
---

# Phase 11: UI dual-persona i modularny frontend — Context

## Cel fazy

Przebudować frontend z myślą o **dwóch personach** i docelowej modularności:

1. **User** — ładna scena (tło/oświetlenie/kadr), minimalny dock rozmowy, captions,
   **widoczna porównywarka algorytmów** (LIVE wizemy vs A2F) na tej samej wypowiedzi.
2. **Tweaker** — schowane *studio* z narzędziami (kalibracja, wizemy, inspektor, A2F, sesja,
   scena, telemetria), profile ustawień, blokady dla usera.

Do tego refaktor: rozbicie `main.ts` (676 linii, god-object callbacków) i `hud.ts` (871 linii,
40+ `getElementById`) na moduły z rejestrami, jeden `SettingsStore` i kompozycja w kontenerze.

**Kontekst czasowy**: start po zamknięciu UAT 08-04 (obecny kalibrator jest przedmiotem testu);
realizacja równolegle z Fazą 9 (zablokowaną na instalacjach sprzętowych po stronie człowieka).
Faza 10 dokłada źródło `A2F (cloud)` do rejestru źródeł — bez zmian shella.

## Decyzje użytkownika (2026-09-10, zatwierdzone)

| Temat | Decyzja |
|---|---|
| Dostęp do studia | `?studio=1` + skrót (Ctrl+Shift+D), wybór persystuje; bez osobnego builda |
| Porównywarka A/B | Segment `LIVE | A2F` + „Porównaj" **na ostatniej turze** (to samo audio + alignment; A2F zasilony tym samym PCM); chipsy A/B; opcjonalny tryb blind „który lepszy?" |
| Zakres refaktoru | Pełny, etapowany (store + panele + kontrolery + scene presets), bez frameworka |
| Timing | Teraz jako Phase 11; start po UAT 08-04, równolegle z Fazą 9 |

## Diagnoza obecnego UI (pain points)

- Jeden poziom widoczności dla wszystkiego: top-dock 5 akcji + 5 narzędzi, 3 szuflady
  (kalibrator 9 suwaków, inspektor 51 blendshape'ów, edytor wizemów), modal, karta telemetrii.
- Kontrolki w złych domach: A/B silnika lip-sync i źródło animacji w „Kalibratorze fonetycznym";
  URL A2F w modalu razem z motywem i głośnością.
- Martwe pole: `micSensitivity` w `SettingsModal` nigdy nie jest konsumowane.
- God-objects: `main.ts` (wiring inline, demo, A2F fetch, ~40 callbacków), `hud.ts`
  (widok + logika edytora wizemów i kalibracji), `index.html` 621 linii.
- Rozsiane klucze localStorage: hud.ts (`LIP_SYNC_ENGINE_KEY`, `ANIM_SOURCE_KEY`),
  settings-modal (4 klucze), calibration, viseme-overrides, agent-config.

## Model person i precedencja ustawień

| | **User (rozmówca)** | **Tweaker (operator/owner)** |
|---|---|---|
| Cel | rozmowa + porównanie algorytmów | konfiguracja, kalibracja, diagnostyka |
| UI | scena, captions, status, dock rozmowy, segment algorytmu + Porównaj | wszystko + panele: Animacja, A2F, Sesja, Scena |
| Ustawia | głośność, mic, motyw, preset sceny, algorytm (jeśli odblokowany) | agent ID, URL A2F, silnik lip-sync, kalibracja, overrides, stress test |
| Dostęp | domyślnie | `?studio=1` / Ctrl+Shift+D / persisted |

**Precedencja**: defaults → profil tweakera → wybory usera (tylko dozwolony podzbiór).
Tweaker może zablokować ustawienie (user widzi disabled/ukryte) i wyeksportować/zaimportować
profil jako JSON. To jest „ustawianie dla usera".

## Mapa UI

**User layer**: brand + status pill → dock (Rozmowa/Stop, Wycisz, Przerwij) →
segment algorytmu `LIVE | A2F` + `Porównaj` → captions → prosty modal (głośność, urządzenia,
motyw, preset sceny) → prezentacja (H/Esc) jako „ukryj UI".

**Studio layer** (panel registry):
- **Animacja** — silnik lip-sync (A/B), źródło animacji, kalibrator (presety + suwaki),
- **Wizemy** — edytor wizemów (bez zmian funkcjonalnych),
- **Inspektor** — 51 blendshape'ów + symetria L/R,
- **A2F** — URL wrappera, `/status`, demo frames, statystyki predict/RTF,
- **Sesja** — agent ID, mic/urządzenia, telemetria (TTFB/FPS/align/nodes/A2F), PoC stress,
- **Scena** — presety tła/oświetlenia/kadru, exposure.

## Porównywarka A/B (design)

- Segment przełącza tryb w runtime z `deferToTurnEnd` (bez cięcia twarzy w pół słowa) — mechanizm
  już istnieje w `FaceController.setAnimationMode`.
- „Porównaj" na ostatniej turze: mamy audio + alignment z ostatniej wypowiedzi; tryb LIVE gra ją
  ponownie wizemami, tryb A2F wysyła **ten sam PCM** do `/predict` i gra neuronowe ramki.
- UI: chipsy `A`/`B`, licznik i etykiety toru; tryb blind (bez etykiet) opcjonalny.
- Rejestr źródeł: `AnimationSource { id, label, available(), activate() }` — F10 rejestruje
  `a2f-cloud`; porównywarka i segment czytają z rejestru (zero hardcode w HTML).

## Scene presets (grafika dla usera)

- Presety: `studio-dark` (obecny), `studio-soft` (cieplejszy key + gradient backdrop),
  `cinema` (mocny rim + winieta CSS), `light` (sync z motywem jasnym).
- Parametry presetu: background (color/gradient), rig świateł, env intensity, exposure,
  pedestal on/off, kadr (bust/portrait).
- Tanie efekty bez postprocessingu (gradient tła, winieta CSS, miękkie cienie już są);
  bloom/DoF tylko preset-gated, jeśli budżet 60 FPS pozwoli.
- User wybiera preset miniaturkami; tweaker może dodać własny (JSON).

## Architektura docelowa (vanilla TS, bez frameworka)

```
src/app/
  container.ts            # composition root (main.ts ≤ ~100 linii)
  ui-mode.ts              # user|studio, URL/skrót, body[data-mode]
  events.ts               # typowany event bus
  store/settings-store.ts # jeden schemat + persistence + profile + locki
src/features/             # kontrolery: conversation, animation, demo, telemetry, scene
src/ui/user/              # conversation-dock, algorithm-switcher, captions, status
src/ui/studio/            # studio-shell + panels/* + panel-registry
src/ui/shared/            # toast, loader, modal, dom
```

Wzorce kluczowe:
- **Panel registry** — panel = `{ id, title, icon, mount, visibleIn: 'user' | 'studio' }`;
  przeniesienie funkcji między personami = zmiana jednego pola; shell się nie zmienia.
- **Capability registry źródeł animacji** — nowe źródło (A2F cloud) = rejestracja, UI samo pokaże.
- **Jeden SettingsStore** — zamiast 6 rozsianych kluczy; profile i locki.
- Komponenty dostają kontekst `{ store, events, services }`; markup w modułach,
  `index.html` tylko shell.

## Migracja (plany 11-01..11-05)

1. **11-01** store + ui-mode + event bus; przepięcie istniejących modułów bez zmian wizualnych.
2. **11-02** composition root + kontrolery z `main.ts` (`main.ts` ≤ ~100 linii).
3. **11-03** studio shell + panele z `hud.ts`; deduplikacja ustawień; usunięcie `micSensitivity`.
4. **11-04** user shell + segment + porównywarka na ostatniej turze + captions.
5. **11-05** scene presets + szlif grafiki + update docs/UAT + 11-VERIFICATION.

Każdy etap kończy się zielonym `npm test` i `npm run build`; brak regresji funkcji z Faz 1–10.

## Zasady nienaruszalne

- Tylko `FaceController` pisze do `FaceDriver` (docs/4) — refaktor UI tego nie zmienia.
- Oś czasu i barge-in: mechanizmy z Faz 4/7/8 pozostają; porównywarka używa `deferToTurnEnd`.
- Budżet: domyślny preset sceny i tryb user trzymają 60 FPS @ 1080p (AVAT-02).
- `index.html` przestaje być źródłem prawdy markupu — panele w modułach.
- UAT 08-04 wykonany **przed** startem fazy (testuje obecny kalibrator).

## Kluczowe pliki (start)

- `src/main.ts`, `src/ui/hud.ts`, `index.html`, `src/style.css` — do dekompozycji,
- `src/prod/settings-modal.ts`, `src/lipsync/calibration.ts`, `src/lipsync/viseme-overrides.ts`,
  `src/audio/agent-config.ts` — klucze localStorage do scalenia w store,
- `src/core/scene.ts`, `src/scene/lighting.ts`, `src/scene/environment.ts` — pod scene presets,
- `src/lipsync/animation-router.ts`, `src/audio/a2f-backend.ts` — pod rejestr źródeł/porównywarkę,
- testy: nowe `tests/settings-store.test.ts`, `tests/ui-mode.test.ts`,
  `tests/panel-registry.test.ts`, `tests/compare-mode.test.ts` + regresja całości.
