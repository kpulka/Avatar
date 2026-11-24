/**
 * Time merge — phonemes from ElevenLabs character-alignment anchors (docs/3, v1.1, Phase 7).
 *
 * The ElevenLabs alignment gives LETTER times. This module splits the text into words, fetches
 * the phonemes (G2P) for each word and distributes the word time proportionally over the phonemes
 * (vowels/diphthongs 1.2, consonants 0.8). Silent letters do not generate their own visemes —
 * their time is absorbed by neighbouring phonemes (sum of durations = the word time span from the alignment).
 *
 * Phase 17 (17-02):
 *  - INVARIANT: the spans of a word always sum to the word's time window and never cross its end.
 *    The 35 ms minimum is a SOFT floor: when it would overflow the window, the clamped durations are
 *    renormalized into the window (hard floor 17.5 ms, equal split if even that cannot fit).
 *  - Diphthong motion: AY and AW emit two spans (own pose over 60% of their time, then the glide end
 *    pose IH / UH over the remaining 40%) — see DIPHTHONG_END_POSES. Zero scheduler changes.
 */

import { CharAlignment } from '../../types/avatar';
import { wordToPhonemesSync } from './g2p-en';
import { DIPHTHONG_END_POSES } from './phoneme-visemes';

export interface PhonemeSpan {
  phoneme: string;
  startMs: number;
  durationMs: number;
  /**
   * Set on the second span of a diphthong: the phoneme whose glide this span completes
   * (`phoneme` is then the END pose, e.g. IH for AY). Absent on ordinary spans.
   */
  glideOf?: string;
}

/** Vowel-like phonemes — they get a larger share of the word time. */
const VOWEL_PHONEMES = new Set([
  'AA', 'AH', 'AE', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW',
]);

/** Soft minimum span (ms). */
export const MIN_SPAN_MS = 35;
/** Hard floor (ms) used when the soft minimum cannot fit inside the word window. */
export const HARD_MIN_SPAN_MS = MIN_SPAN_MS / 2;
/** Share of a diphthong's time spent on its own pose before the glide end pose. */
const DIPHTHONG_START_SHARE = 0.6;

interface Unit {
  phoneme: string;
  weight: number;
  glideOf?: string;
}

/**
 * Splits `spanMs` over `weights` proportionally, applying the soft minimum without ever exceeding
 * the window. The returned durations sum to `spanMs` (up to floating point; the caller pins the last
 * span to the window end).
 */
export function distributeDurations(weights: readonly number[], spanMs: number): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const ideal = weights.map((w) => (spanMs * w) / totalWeight);
  const clamped = ideal.map((d) => Math.max(MIN_SPAN_MS, d));
  const clampedSum = clamped.reduce((a, b) => a + b, 0);

  // Common case: nothing was lifted by the floor (or the floor fits exactly) -> the ideal split.
  if (clampedSum <= spanMs + 1e-9) return ideal;

  // The window cannot hold every span at the soft minimum -> renormalize inside it.
  if (n * HARD_MIN_SPAN_MS >= spanMs) return Array.from({ length: n }, () => spanMs / n);

  // Scale the clamped durations to the window; spans that would drop below the hard floor are
  // pinned to it and the remainder is re-scaled over the free spans (water filling).
  const pinned = new Array<boolean>(n).fill(false);
  const result = new Array<number>(n).fill(0);
  for (;;) {
    const pinnedCount = pinned.filter(Boolean).length;
    const remaining = spanMs - pinnedCount * HARD_MIN_SPAN_MS;
    let freeSum = 0;
    for (let k = 0; k < n; k++) if (!pinned[k]) freeSum += clamped[k];
    const scale = remaining / freeSum;
    let changed = false;
    for (let k = 0; k < n; k++) {
      if (pinned[k]) {
        result[k] = HARD_MIN_SPAN_MS;
      } else {
        result[k] = clamped[k] * scale;
        if (result[k] < HARD_MIN_SPAN_MS) {
          pinned[k] = true;
          changed = true;
        }
      }
    }
    if (!changed) return result;
  }
}

/** Expands a word's phonemes into weighted units (diphthongs become a start + glide-end pair). */
function toUnits(phonemes: readonly string[]): Unit[] {
  const units: Unit[] = [];
  for (const phoneme of phonemes) {
    const weight = VOWEL_PHONEMES.has(phoneme) ? 1.2 : 0.8;
    const end = DIPHTHONG_END_POSES[phoneme];
    if (end) {
      units.push({ phoneme, weight: weight * DIPHTHONG_START_SHARE });
      units.push({ phoneme: end, weight: weight * (1 - DIPHTHONG_START_SHARE), glideOf: phoneme });
    } else {
      units.push({ phoneme, weight });
    }
  }
  return units;
}

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

    const units = toUnits(phonemes);
    const lengths = distributeDurations(units.map((u) => u.weight), wordSpanMs);

    let cursorMs = wordStartMs;
    for (let k = 0; k < units.length; k++) {
      const isLast = k === units.length - 1;
      // The last span is pinned to the window end so rounding can never leak into the next word.
      const durationMs = isLast ? wordStartMs + wordSpanMs - cursorMs : lengths[k];
      const span: PhonemeSpan = { phoneme: units[k].phoneme, startMs: cursorMs, durationMs };
      if (units[k].glideOf) span.glideOf = units[k].glideOf;
      spans.push(span);
      cursorMs += durationMs;
    }
  }

  return spans;
}
