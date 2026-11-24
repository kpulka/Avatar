/**
 * Rescales the character alignment onto the chunk's audio timeline (docs/3, v1.1; Phase 17 anchors).
 *
 * Observation from the live agent (2026-09-02): the text span in the ElevenLabs alignment chunk
 * often does NOT match the audio length of that chunk (ratio 0.56-2.5x). Text slices are
 * disjoint and sequential across the utterance, so an unrescaled error ACCUMULATES —
 * the mouth drifts apart in long sentences and at word boundaries. This function scales character
 * times linearly onto the audio (proportions inside the chunk preserved). Overall text ≈ audio of
 * the whole utterance, so the rescale keeps the global timeline consistent without drift.
 *
 * Two anchorings:
 *  - whole chunk (default): 0 -> 0 and end of the last character -> end of the audio chunk;
 *  - speech bounds (17-03, when `bounds` is given and the spoken span is at least 100 ms): start of the
 *    first character -> speech onset, end of the last character -> speech offset. Leading silence is no
 *    longer smeared into the first words and trailing silence no longer stretches all of the speech.
 */

import { CharAlignment } from '../types/avatar';
import type { SpeechBounds } from './energy-fallback';

/** The scale factor is CLAMPED to this range (a ratio outside it is too pathological to trust). */
const MIN_FACTOR = 0.5;
/** Header observation: ratios up to 2.5x occur on the live agent. */
const MAX_FACTOR = 2.5;
/** A spoken span shorter than this is not trusted as an anchor (keeps the whole-chunk behavior). */
const MIN_BOUNDED_SPAN_MS = 100;

const clampFactor = (raw: number): number => Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, raw));

export function rescaleAlignmentToAudio(alignment: CharAlignment, audioDurMs: number, bounds?: SpeechBounds | null): CharAlignment {
  const { chars, char_start_times_ms: starts, char_durations_ms: durs } = alignment;
  if (!Array.isArray(starts) || starts.length === 0) return alignment;
  if (!Array.isArray(durs) || durs.length !== starts.length) return alignment;
  // JSON-derived times can be NaN/Infinity from a buggy backend — never propagate them.
  if (!starts.every(Number.isFinite) || !durs.every(Number.isFinite)) return alignment;
  if (!Number.isFinite(audioDurMs) || audioDurMs <= 0) return alignment;

  const lastIdx = starts.length - 1;
  const firstStartMs = starts[0] ?? 0;
  const lastCharEndMs = (starts[lastIdx] ?? 0) + (durs[lastIdx] ?? 0);
  if (lastCharEndMs <= 0) return alignment;

  let anchorMs = 0; // where the first character lands
  let originMs = 0; // text time that maps to anchorMs
  let rawFactor: number;

  const onsetMs = bounds ? bounds.onsetSec * 1000 : NaN;
  const offsetMs = bounds ? bounds.offsetSec * 1000 : NaN;
  const textSpanMs = lastCharEndMs - firstStartMs;
  if (bounds && Number.isFinite(onsetMs) && Number.isFinite(offsetMs) && offsetMs - onsetMs >= MIN_BOUNDED_SPAN_MS && textSpanMs > 0) {
    anchorMs = onsetMs;
    originMs = firstStartMs;
    rawFactor = (offsetMs - onsetMs) / textSpanMs;
  } else {
    rawFactor = audioDurMs / lastCharEndMs;
  }
  if (!Number.isFinite(rawFactor)) return alignment;
  const factor = clampFactor(rawFactor);

  return {
    chars,
    char_start_times_ms: starts.map((s) => Math.max(0, anchorMs + (s - originMs) * factor)),
    char_durations_ms: durs.map((d) => Math.max(0, d * factor)),
    source: alignment.source,
  };
}
