/**
 * Time merge — phonemes from ElevenLabs character-alignment anchors (docs/3, v1.1, Phase 7).
 *
 * The ElevenLabs alignment gives LETTER times. This module splits the text into words, fetches
 * the phonemes (G2P) for each word and distributes the word time proportionally over the phonemes
 * (vowels/diphthongs 1.2, consonants 0.8). Silent letters do not generate their own visemes —
 * their time is absorbed by neighbouring phonemes (sum of durations = the word time span from the alignment).
 */

import { CharAlignment } from '../../types/avatar';
import { wordToPhonemesSync } from './g2p-en';

export interface PhonemeSpan {
  phoneme: string;
  startMs: number;
  durationMs: number;
}

/** Vowel-like phonemes — they get a larger share of the word time. */
const VOWEL_PHONEMES = new Set([
  'AA', 'AH', 'AE', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW',
]);

const MIN_SPAN_MS = 35;

/**
 * Splits the character alignment into phoneme spans (start+duration, in ms relative to the chunk).
 * Returns [] when the source is the acoustic fallback (no text) or there are no words.
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
    // Boundary: look for the start of a run of letters
    if (!/[A-Za-z'’-]/.test(chars[i])) {
      i += 1;
      continue;
    }

    // Collect the run of letters (the word)
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

    // Weighted distribution of the word time over the phonemes
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
