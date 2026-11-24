/**
 * Pure normalization of the ElevenLabs alignment payload (Phase 17, 17-03; extracted from
 * speech-backend.ts so the defensive wire-format handling is unit-tested).
 *
 * The wire format is accepted defensively:
 *  - container aliases: `alignment` | `normalized_alignment` | `alignments` (or the alignment object itself)
 *  - characters:        `chars` | `characters`
 *  - start times:       `char_start_times_ms` (ms) | `character_start_times_seconds` (s, x1000)
 *  - durations:         `char_durations_ms` (ms) | `character_end_times_seconds` - start (s, x1000, min 25 ms)
 *                       | absent -> a flat 50 ms per character
 *
 * Contract (every degenerate input degrades to `null`, i.e. the energy fallback; it never throws):
 *  - payload is not an object, no characters, or start times missing / wrong length -> null
 *  - any non-finite start time, or non-finite duration in a full-length duration array -> null
 *    (a stream with NaN/Infinity cannot be trusted, so the whole field set is dropped)
 *  - negative start times and negative durations are clamped to 0 (a negative time cannot precede
 *    the audio it belongs to)
 *  - a duration array whose length differs from the characters is ignored (flat 50 ms)
 *  - on success `source` is always 'elevenlabs'
 */

import { CharAlignment } from '../types/avatar';

/** Permissive input shape: the union of every field alias the normalizer understands. */
export type CharAlignmentLike = Record<string, unknown>;

const FLAT_DURATION_MS = 50;
const MIN_DERIVED_DURATION_MS = 25;

function isRecord(value: unknown): value is CharAlignmentLike {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  return value as number[];
}

function allFinite(values: readonly unknown[]): boolean {
  return values.every((v) => typeof v === 'number' && Number.isFinite(v));
}

/**
 * Normalizes an audio-event payload (or a bare alignment object) into a CharAlignment, or null
 * when the alignment is absent or unusable (the caller then falls back to the energy alignment).
 */
export function normalizeAlignmentPayload(payload: unknown): CharAlignment | null {
  if (!isRecord(payload)) return null;

  const hasChars = payload.chars !== undefined || payload.characters !== undefined;
  const raw = payload.alignment ?? payload.normalized_alignment ?? payload.alignments ?? (hasChars ? payload : undefined);
  if (!isRecord(raw)) return null;

  const chars = raw.chars ?? raw.characters;
  if (!Array.isArray(chars) || chars.length === 0) return null;
  if (!chars.every((c) => typeof c === 'string')) return null;

  const startSeconds = numberArray(raw.character_start_times_seconds);
  const endSeconds = numberArray(raw.character_end_times_seconds);

  let startTimes: number[] = [];
  const startsMs = numberArray(raw.char_start_times_ms);
  if (startsMs) {
    startTimes = startsMs;
  } else if (startSeconds) {
    startTimes = startSeconds.map((s) => s * 1000);
  }
  if (startTimes.length !== chars.length) return null;
  if (!allFinite(startTimes)) return null;

  let durations: number[] = [];
  const durationsMs = numberArray(raw.char_durations_ms);
  if (durationsMs) {
    durations = durationsMs;
  } else if (endSeconds && startSeconds) {
    durations = endSeconds.map((endSec, idx) => {
      const startSec = startSeconds[idx] ?? 0;
      return Math.max(MIN_DERIVED_DURATION_MS, (endSec - startSec) * 1000);
    });
  }

  const hasFullDurations = durations.length === chars.length;
  if (hasFullDurations && !allFinite(durations)) return null;

  return {
    chars: chars,
    char_start_times_ms: startTimes.map((s) => Math.max(0, s)),
    char_durations_ms: hasFullDurations
      ? durations.map((d) => Math.max(0, d))
      : (chars).map(() => FLAT_DURATION_MS),
    source: 'elevenlabs',
  };
}
