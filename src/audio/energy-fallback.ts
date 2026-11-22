import { CharAlignment } from '../types/avatar';

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
 */
export function generateEnergyFallbackAlignment(pcmBytes: Uint8Array, sampleRate: number): CharAlignment {
  const int16 = new Int16Array(pcmBytes.buffer, pcmBytes.byteOffset, Math.floor(pcmBytes.byteLength / 2));
  const sliceMs = 70; // 70ms analysis window matching syllable length
  const samplesPerSlice = Math.max(1, Math.floor((sampleRate * sliceMs) / 1000));
  const numSlices = Math.max(1, Math.floor(int16.length / samplesPerSlice));

  const chars: string[] = [];
  const char_start_times_ms: number[] = [];
  const char_durations_ms: number[] = [];
  const energies: number[] = [];

  for (let s = 0; s < numSlices; s++) {
    const startSample = s * samplesPerSlice;
    const endSample = Math.min(int16.length, startSample + samplesPerSlice);
    let sumSq = 0;
    for (let i = startSample; i < endSample; i++) {
      sumSq += int16[i] * int16[i];
    }
    const count = Math.max(1, endSample - startSample);
    const rms = Math.sqrt(sumSq / count) / 32768; // 0.0 - 1.0

    chars.push(' ');
    energies.push(rms);
    char_start_times_ms.push(s * sliceMs);
    char_durations_ms.push(sliceMs);
  }

  return {
    chars,
    char_start_times_ms,
    char_durations_ms,
    energies,
    source: 'energy-fallback',
  };
}
