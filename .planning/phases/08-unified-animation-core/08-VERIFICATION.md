---
phase: "08"
name: "Zunifikowany tor animacji + barge-in"
created: "2026-09-12"
status: executed
automated: pass
manual_uat: pending
---

# Phase 8 — VERIFICATION

> Artefakt zrekonstruowany (2026-09-12) z planów 08-01..08-04, kodu i testów — oryginalny plik nie istniał.
> Plany 08-01..08-03 (execute) wykonane i domknięte summary; plan 08-04 (verify) to manualny UAT — **jawnie PENDING**.

---

## 1. Bramki automatyczne (PASS — dowody realne, wykonane 2026-09-12)

| Gate | Wynik | Dowód |
|------|-------|-------|
| Testy docelowe fazy (3 pliki) | ✅ 3 pliki / **34 testy** zielone (`npx vitest run tests/a2f-parser.test.ts tests/animation-frames.test.ts tests/animation-router.test.ts`) | vitest: 3 passed / 34 passed, ~740 ms |
| Pełna regresja `npm test` | ✅ **41 plików / 202 testy** zielone | vitest: 41 passed / 202 passed, 3.28 s |
| Zmienne typów kontraktu v2 | ✅ `PoseFrame`/`FramesClip`/`AnimationMode` w `src/types/avatar.ts` (grep, linie 54–77) | typy widoczne w kodzie i importach testów |
| FaceController tryb frames | ✅ `setAnimationMode`/`getAnimationMode`/`feedFrames`/`frameBuffer`/cap mouthClose w `src/lipsync/face-controller.ts` | `tests/animation-frames.test.ts` — 17 testów trybu frames |
| Dryf 30 s (osia audio) | ✅ automatycznie | `tests/animation-frames.test.ts` „dryf 30 s: playback klatka-po-klatce trafia w ramki" |
| Barge-in frames = viseme | ✅ automatycznie | `tests/animation-frames.test.ts` „onInterruption czyści bufor i wchodzi w RELAXING" + „ignoruje feedFrames ze starej epoki" |
| Parser A2F (A2F-01) | ✅ automatycznie | `tests/a2f-parser.test.ts` — 52 nazwy ARKit, clamp, relatywny timeSec, carriesEyes/Emotion, błędy |
| Router (polityka per-tura) | ✅ automatycznie | `tests/animation-router.test.ts` — 6 testów (LIVE→viseme, degradacja, PL→viseme, demo undefined→frames) |

## 2. Mapowanie wymagań → dowody

| Req | Status | Dowód automatyczny |
|-----|--------|--------------------|
| UNA-01 | ✅ kod + testy | `src/lipsync/face-controller.ts` (tryb frames, epoka, safety, gating) + `src/types/avatar.ts` + `tests/animation-frames.test.ts` (17 testów) |
| A2F-01 | ✅ kod + testy | `src/lipsync/a2f-parser.ts` + `tests/a2f-parser.test.ts` (52 ARKit, kontrakt v2) |
| A2F-03 | ✅ kod + testy (częściowo) | `src/lipsync/demo-frames.ts`, `src/lipsync/animation-router.ts`, `tests/animation-frames.test.ts` (dryf 30 s, buildDemoFrames), `tests/animation-router.test.ts`; pełna degradacja z health-check — Faza 9 (09-04) |

## 3. Manualne UAT (08-04) — ⏳ **PENDING**

> Plan 08-04 to wyłącznie manualny UAT (autonomous: false) — wymaga sesji dev z modelem MetaPerson (GPU/mikrofon).
> **08-04-SUMMARY.md celowo NIE istnieje** — dojdzie po sesji człowieka.
> Po refaktorze UI Fazy 11 przełącznik/HUD zastąpił panel **Studio → Animacja**; UAT wykonuje się przez nowe UI —
> checklisty i instrukcje: **`TODO_humanInTheLoop.md` pkt 1** (jedno przejście pokrywa UAT F11 + 08-04) oraz **`11-VERIFICATION.md` §3**.

- [ ] Tryb viseme (regresja): demo mowy / agent EN — usta jak przed zmianami.
- [ ] Tryb frames (demo A2F w Studio → Animacja): usta odtwarzają pozy ramek bez wygładzania; powrót do LIVE; zmiana trybu mid-turn odroczona (deferToTurnEnd).
- [ ] Przerwij (barge-in) w demo frames — twarz neutral <300 ms; RELAXING z pozy OSTATNIEJ ramki.
- [ ] Safety wizualne: mouthClose=1.0 → efektywnie 0.85.
- [ ] 60 FPS w obu trybach (licznik w Studio → Sesja).

Wyników UAT **nie wpisano** — po sesji człowieka uzupełnić checklistę, `manual_uat: pass` i `status: verified`, oraz utworzyć 08-04-SUMMARY.md.

## 4. Zamknięcie

- Plany 08-01..08-03: **execute — complete** (patrz 08-01/02/03-SUMMARY.md; 08-02 A2F-01, 08-01 UNA-01, 08-03 A2F-03 offline).
- Plan 08-04 (UAT): **PENDING** — czeka na człowieka (razem z UAT F11, wg TODO_humanInTheLoop.md).
- Decyzja architektoniczna („absolutny tor ramek" w FaceController, kontrakt v2) — do odnotowania w PROJECT.md Key Decisions przy zamknięciu fazy (post_task 08-04).
- Rdzeń gotowy do Fazy 9 (lokalny A2F): parser, tryb frames, router i demo syntetyczne spełniają automatyczne done-criteria planów 08-01..08-03.