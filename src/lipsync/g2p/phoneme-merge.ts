/**
 * Merge czasu — fonemy z kotwic alignmentu znaków ElevenLabs (docs/3, v1.1, Faza 7).
 *
 * Alignment ElevenLabs podaje czasy LITER. Ten moduł dzieli tekst na słowa, dla każdego
 * słowa pobiera fonemy (G2P) i rozkłada czas słowa proporcjonalnie na fonemy
 * (samogłoski/dyftongi 1.2, spółgłoski 0.8). Litery nieme nie generują własnych wizem —
 * ich czas wchłaniają sąsiednie fonemy (suma duracji słowa = jego długość czasowa z alignmentu).
 */

import { CharAlignment } from '../../types/avatar';
import { wordToPhonemesSync } from './g2p-en';

export interface PhonemeSpan {
  phoneme: string;
  startMs: number;
  durationMs: number;
}

/** Fonemy o charakterze samogłoskowym — dostają większy udział czasu słowa. */
const VOWEL_PHONEMES = new Set([
  'AA', 'AH', 'AE', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW',
]);

const MIN_SPAN_MS = 35;

/**
 * Rozbija alignment znaków na rozpiętości fonemów (start+duration, w ms względem chunka).
 * Zwraca [] gdy źródłem jest fallback akustyczny (brak tekstu) lub brak słów.
 */
export function mergeCharAlignmentToPhonemes(alignment: CharAlignment): PhonemeSpan[] {
  if (alignment.source !== undefined && alignment.source !== 'elevenlabs') {
    return [];
  }

  const chars = alignment.chars;
  const starts = alignment.char_start_times_ms;
  const durations = alignment.char_durations_ms;
  if (!Array.isArray(chars) || chars.length === 0) return [];

  const spans: PhonemeSpan[] = [];
  let i = 0;
  const n = chars.length;

  while (i < n) {
    // Granica: szukamy początku runu liter
    if (!/[A-Za-z'’-]/.test(chars[i])) {
      i += 1;
      continue;
    }

    // Zbierz run liter (słowo)
    let j = i;
    let wordText = '';
    while (j < n && /[A-Za-z'’-]/.test(chars[j])) {
      wordText += chars[j];
      j += 1;
    }

    const firstIdx = i;
    const lastIdx = j - 1;
    i = j;

    const wordStartMs = starts[firstIdx] ?? 0;
    const wordEndMs = (starts[lastIdx] ?? wordStartMs) + (durations[lastIdx] ?? 0);
    const wordSpanMs = Math.max(0, wordEndMs - wordStartMs);

    const phonemes = wordToPhonemesSync(wordText);
    if (!phonemes || phonemes.length === 0 || wordSpanMs <= 0) continue;

    // Rozkład wagowy czasu słowa na fonemy
    const weights = phonemes.map((p) => (VOWEL_PHONEMES.has(p) ? 1.2 : 0.8));
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    let cursorMs = wordStartMs;
    for (let k = 0; k < phonemes.length; k++) {
      const ideal = (wordSpanMs * weights[k]) / totalWeight;
      const durationMs = Math.max(MIN_SPAN_MS, ideal);
      spans.push({
        phoneme: phonemes[k],
        startMs: cursorMs,
        durationMs,
      });
      cursorMs += durationMs;
    }
  }

  return spans;
}
