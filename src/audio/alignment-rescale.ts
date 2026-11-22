/**
 * Rescales the character alignment onto the chunk's audio timeline (docs/3, v1.1).
 *
 * Observation from the live agent (2026-09-02): the text span in the ElevenLabs alignment chunk
 * often does NOT match the audio length of that chunk (ratio 0.56-2.5x). Text slices are
 * disjoint and sequential across the utterance, so an unrescaled error ACCUMULATES —
 * the mouth drifts apart in long sentences and at word boundaries. This function scales character
 * times linearly so that the end of the last character coincides with the end of the audio chunk
 * (proportions inside the chunk preserved). Overall text ≈ audio of the whole utterance,
 * so the rescale keeps the global timeline consistent without drift.
 */

import { CharAlignment } from '../types/avatar';

/** Allowed range of the scale factor — outside it we do not correct (too pathological). */
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
