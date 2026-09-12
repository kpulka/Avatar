/**
 * Rescale alignmentu znaków do osi audio chunka (docs/3, v1.1).
 *
 * Obserwacja z live agenta (2026-09-02): rozpiętość tekstu w chuście alignmentu ElevenLabs
 * często NIE pokrywa się z długością audio tego chunka (ratio 0.56-2.5x). Slices tekstu są
 * rozłączne i sekwencyjne względem wypowiedzi, więc nieprzeskalowany błąd KUMULUJE się —
 * usta rozjeżdżają się w długich zdaniach i na granicach słów. Ta funkcja skaluje czasy
 * znaków liniowo tak, by koniec ostatniego znaku pokrywał się z końcem audio chunka
 * (proporcje wewnątrz chunka zachowane). Sumarycznie tekst ≈ audio całej wypowiedzi,
 * więc rescale utrzymuje globalną oś czasu spójną bez dryfu.
 */

import { CharAlignment } from '../types/avatar';

/** Dopuszczalny zakres współczynnika skali — poza nim nie poprawiamy (zbyt patologiczne). */
const MIN_FACTOR = 0.5;
const MAX_FACTOR = 2.0;

export function rescaleAlignmentToAudio(
  alignment: CharAlignment,
  audioDurMs: number
): CharAlignment {
  const { chars, char_start_times_ms: starts, char_durations_ms: durs } = alignment;
  if (!Array.isArray(starts) || starts.length === 0) return alignment;
  if (!Array.isArray(durs) || durs.length !== starts.length) return alignment;

  const lastIdx = starts.length - 1;
  const lastCharEndMs = (starts[lastIdx] ?? 0) + (durs[lastIdx] ?? 0);
  if (lastCharEndMs <= 0 || audioDurMs <= 0) return alignment;

  const rawFactor = audioDurMs / lastCharEndMs;
  const factor = Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, rawFactor));

  return {
    chars,
    char_start_times_ms: starts.map((s) => s * factor),
    char_durations_ms: durs.map((d) => d * factor),
    source: alignment.source,
  };
}
