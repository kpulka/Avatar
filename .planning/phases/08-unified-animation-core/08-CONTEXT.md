---
phase: "08"
name: "Zunifikowany tor animacji + barge-in"
created: "2026-09-02"
updated: "2026-09-02 (po review-unifikacji A2F↔wizemy)"
---

# Phase 8: Zunifikowany tor animacji + barge-in — Context

## Cel fazy (rdzeń, bez GPU)

Przygotować silnik animacji twarzy tak, by **jedna maszyna stanów i jeden mechanizm przerwań
(epoka)** obsługiwały dwa źródła ruchu ust:

1. **LIVE wizemy** (obecne: `VisemeScheduler` + koartykulacja z alignmentu ElevenLabs),
2. **absolutny strumień ramek** (docelowo NVIDIA Audio2Face-3D — neuronowe wartości
   bezwzględne, patrz `docs/7-audio2face-cloudrun.md`).

Faza NIE wymaga GPU ani A2F — ramki testowe są syntetyczne (JSON/płyta). To fundament pod Fazę 9
(lokalny A2F) i Fazę 10 (chmura).

## Zasada unifikacji (decyzja po review 2026-09-02)

**Jednoczymy się na poziomie "właściciela morphów + osi czasu + epoki", NIE na poziomie
wygładzania.** Smoothing/koartykulacja jest właściwością ŹRÓDŁA:

- **VisemeSource** (tor wizemowy): dyskretne itemy → `VisemeScheduler` (additive + easing +
  damping per grupa mięśni + priorytet mouthClose + nadpisania z Edytora Wizemów).
- **FramesSource** (tor ramek): `FramesClip` = pozy bezwzględne per klatka → aplikacja wprost,
  **bez** addycji/dampingu/emocji addytywnej. Opcjonalna interpolacja liniowa między ramkami
  (odtwarza ciągłą krzywą z próbkowania 30/60 fps — NIE jest to wygładzanie schedulerowe).

Wspólne dla obu torów (należy do FaceController):
- state machine `IDLE/SPEAKING/RELAXING`, epoka barge-in, `AudioContext.currentTime`,
- RELAXING interpolujące z `currentWeights` (tor frames MUSI je też zapisywać!),
- safety rigu: clamp 0..1, cap `mouthClose ≤ 0.85` (CLOSE_SAFETY_CAP jak w schedulerze),
  anatomiczny guard jaw-vs-close.

Kalibracja gustowa (jawScale/smileScale/…) stosuje się TYLKO w torze wizemowym (to korekta tabel
wizem); na ramkach A2F — wyłącznie cap bezpieczeństwa. Nadpisania Edytora Wizemów nie działają
na torze frames (semantyka per-wizem ≠ poza per-klatka).

## Zasady nienaruszalne

- Tylko `FaceController` pisze do `FaceDriver` (docs/4). W trybie `frames` także.
- Oś czasu = `AudioContext.currentTime`; baza czasu (baseSec z `AudioEngine.playChunk`)
  dodawana JEDNORAZOWO w `feedFrames(clip, baseSec, epoch)` — ramki są RELATYWNE.
- Proceduralne mruganie (`ProceduralBlink`) działa TYLKO gdy clip tego nie niesie
  (`carriesEyes === false`); gdy A2F niesie oczy — blink OFF i `GazeSaccades` nie pisze
  `eyeLook*` (A2F generuje rotację oczu + sakkady).
- Epoka i state machine wspólne dla obu trybów.

## Kluczowe pliki

- `src/lipsync/face-controller.ts` — tryb `frames` + API ramek + safety/gating,
- `src/types/avatar.ts` — typy `PoseFrame` / `FramesClip` / `AnimationMode`,
- `src/avatar/shape-normalizer.ts` — normalizer (druga linia mapowania; parser ma własny
  PascalCase→camelCase, bo normalizer nie obsługuje "MouthSmileLeft"!),
- nowy `src/lipsync/a2f-parser.ts` — JSON A2F → `FramesClip` (docs/7 §5),
- nowy `src/lipsync/animation-router.ts` — polityka wyboru źródła per tura + degradacja
  (cienki, testowalny bez GPU; rozbudowa o health-check w Fazie 9),
- nowy `src/lipsync/demo-frames.ts` — syntetyczne ramki do demo,
- `src/audio/audio-engine.ts` — bez zmian (odtwarzanie gapless już jest),
- testy: `tests/face-controller-state.test.ts`, nowe `tests/a2f-parser.test.ts`,
  `tests/animation-frames.test.ts`.

## Format ramki — kontrakt v2 (decyzja review 2026-09-02)

> **Właścicielem formatu JSON z serwera jest WRAPPER A2F** (docs/7 §5 = kontrakt wrapper-output,
> nie natywny format NVIDIA). Parser jest odporny na niestały krok ramek
> (v3.0 diffusion = 30 fps używalnych; porządkujemy po `frame_time`, nie po `fps`).

```ts
export interface PoseFrame {
  /** CZAS WZGLĘDNY startu audio tury (s) — baza (baseSec) dodawana JEDNORAZOWO
      w FaceController.feedFrames(clip, baseSec, epoch) */
  timeSec: number;
  /** znormalizowane wagi: klucz = nasz camelCase (jawOpen, mouthSmileLeft…) */
  weights: Record<string, number>;
}

export interface FramesClip {
  frames: PoseFrame[];        // posortowane rosnąco po timeSec
  fps: number;                // informacyjne (nie zakładamy stałego kroku!)
  /** kształty, którymi strumień WŁADA — brak klucza w ramce → 0 dla tych kształtów */
  shapes: string[];
  carriesEyes: boolean;       // true → blink proceduralny OFF + GazeSaccades eyeLook* OFF
  carriesEmotion: boolean;    // true → EmotionLayer addytywna OFF w trakcie tury (A2E prowadzi)
  emotions?: Array<{ timeSec: number; weights: Record<string, number> }>; // A2E (opcjonalne)
}
```

JSON z wrappera: `{ fps, frames: [{ frame_time, blendshapes: { "JawOpen": 0.12, … } }],
carriesEyes?, emotions? }` → parser:
- **PascalCase→camelCase własnym dekapitalizerem** (`MouthSmileLeft`→`mouthSmileLeft`;
  `normalizeShapeName` jako druga linia — sam nie składa PascalCase!),
- `timeSec = frame_time` (RELATYWNY; żadnego audioStart w parserze!),
- clamp 0..1; nieznane shape'y: skip + licznik (telemetria, nie spam per ramka),
- `carriesEyes`/`shapes` z meta lub inferencji (obecność eyeBlink*/eyeLook* w ramkach),
- brak `frames` → czytelny Error; JSON parse fail → czytelny Error.

## Przyszłość (poza zakresem fazy — sygnał architektoniczny)

Sterowanie postacią zostanie podzielone na warstwy/regiony (twarz-mimika, ciało, gesty rękami,
głowa). `FaceController` (+ `PoseRouter`) ma być **regionem twarzy** przyszłego nadrzędnego
"AvatarDirector"; interfejsy nie mogą blokować tej dekompozycji (FaceController pozostaje
jedynym pisarzem morphów twarzy; inne regiony dostaną własnych właścicieli).
