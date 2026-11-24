import { CharAlignment } from '../types/avatar';

/** Analysis window (ms) matching syllable length; shared by the fallback alignment and the speech-bounds probe. */
const ENERGY_WINDOW_MS = 70;

/**
 * RMS (0..1) above which a window counts as speech. Mirrors `fallback.skipEnergyBelow` in
 * anim-config (the face controller skips jaw visemes at or below it); duplicated here on purpose so
 * the audio layer does not import the lipsync layer.
 */
const SPEECH_ENERGY_THRESHOLD = 0.02;

/** Int16 view over PCM bytes; copies when the byte offset is odd (an Int16Array view would throw). */
function toInt16(pcmBytes: Uint8Array): Int16Array {
  const length = Math.floor(pcmBytes.byteLength / 2);
  if (pcmBytes.byteOffset % 2 !== 0) {
    const copy = new Uint8Array(length * 2);
    copy.set(pcmBytes.subarray(0, length * 2));
    return new Int16Array(copy.buffer, 0, length);
  }
  return new Int16Array(pcmBytes.buffer, pcmBytes.byteOffset, length);
}

function samplesPerWindow(sampleRate: number): number {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error(`energy-fallback: invalid sample rate ${sampleRate}`);
  }
  return Math.max(1, Math.floor((sampleRate * ENERGY_WINDOW_MS) / 1000));
}

/** RMS (0..1) of the samples [start, end). */
function rmsOf(int16: Int16Array, start: number, end: number): number {
  let sumSq = 0;
  for (let i = start; i < end; i++) {
    const sample = int16[i] ?? 0; // i < end <= int16.length: always defined
    sumSq += sample * sample;
  }
  return Math.sqrt(sumSq / Math.max(1, end - start)) / 32768;
}

/**
 * Creates a synthetic jaw-only acoustic alignment from the energy analysis of
 * PCM audio samples (RMS in 70 ms windows). Guarantees that the avatar ALWAYS moves
 * its mouth in sync with the agent's voice, even when the ElevenLabs backend does not send
 * 'alignment' metadata in the WebSocket stream.
 *
 * Unlike the former fallback it does NOT generate false vowels
 * (A/O/E/I/U/M) — the `chars` content is filled with spaces (empty shape map),
 * and the per-window RMS energy goes to `energies`. The jaw-movement decision
 * (jawOpen ∝ energy) is made by FaceController for the 'energy-fallback' source.
 *
 * The window count is ROUNDED, so a tail of at least half a window still becomes a slice (the
 * speech at the end of a chunk gets its viseme); a shorter remainder is folded away. A
 * non-positive or non-finite sample rate throws.
 */
export function generateEnergyFallbackAlignment(pcmBytes: Uint8Array, sampleRate: number): CharAlignment {
  const perSlice = samplesPerWindow(sampleRate);
  const int16 = toInt16(pcmBytes);
  const numSlices = Math.max(1, Math.round(int16.length / perSlice));

  const chars: string[] = [];
  const char_start_times_ms: number[] = [];
  const char_durations_ms: number[] = [];
  const energies: number[] = [];

  for (let s = 0; s < numSlices; s++) {
    const startSample = s * perSlice;
    const endSample = Math.min(int16.length, startSample + perSlice);

    chars.push(' ');
    energies.push(rmsOf(int16, startSample, endSample));
    char_start_times_ms.push(s * ENERGY_WINDOW_MS);
    char_durations_ms.push(ENERGY_WINDOW_MS);
  }

  return {
    chars,
    char_start_times_ms,
    char_durations_ms,
    energies,
    source: 'energy-fallback',
  };
}

/** First and last audible moment of a PCM chunk, in seconds from the chunk start. */
export interface SpeechBounds {
  onsetSec: number;
  offsetSec: number;
}

/**
 * Finds where speech starts and ends inside a PCM chunk using the same 70 ms RMS windows and
 * threshold as the energy fallback. Returns null when no window exceeds the threshold (silence or
 * very quiet audio), so the caller can keep the plain whole-chunk rescale.
 *
 * Granularity is one window: onset is the start of the first loud window, offset the end of the
 * last loud one (clamped to the chunk length).
 */
export function detectSpeechBounds(
  pcmBytes: Uint8Array,
  sampleRate: number,
  threshold: number = SPEECH_ENERGY_THRESHOLD
): SpeechBounds | null {
  const perSlice = samplesPerWindow(sampleRate);
  const int16 = toInt16(pcmBytes);
  if (int16.length === 0) return null;

  const windows = Math.ceil(int16.length / perSlice);
  let first = -1;
  let last = -1;
  for (let w = 0; w < windows; w++) {
    const start = w * perSlice;
    const end = Math.min(int16.length, start + perSlice);
    if (rmsOf(int16, start, end) > threshold) {
      if (first < 0) first = w;
      last = w;
    }
  }
  if (first < 0) return null;

  const totalSec = int16.length / sampleRate;
  return {
    onsetSec: (first * perSlice) / sampleRate,
    offsetSec: Math.min(totalSec, ((last + 1) * perSlice) / sampleRate),
  };
}
