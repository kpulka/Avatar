import { CharAlignment } from '../types/avatar';

/**
 * Tworzy syntetyczny alignment akustyczny jaw-only na podstawie analizy energii
 * próbek audio PCM (RMS w oknach 70 ms). Gwarantuje, że awatar ZAWSZE porusza
 * ustami synchronicznie z głosem agenta, nawet gdy backend ElevenLabs nie przesyła
 * metadanych 'alignment' w strumieniu WebSocket.
 *
 * W przeciwieństwie do dawnego fallbacku NIE generuje fałszywych samogłosek
 * (A/O/E/I/U/M) — treść `chars` jest wypełniona spacjami (pusta mapa kształtów),
 * a energia RMS per okno trafia do `energies`. Decyzję o ruchu żuchwy
 * (jawOpen ∝ energia) podejmuje FaceController dla źródła 'energy-fallback'.
 */
export function generateEnergyFallbackAlignment(pcmBytes: Uint8Array, sampleRate: number): CharAlignment {
  const int16 = new Int16Array(pcmBytes.buffer, pcmBytes.byteOffset, Math.floor(pcmBytes.byteLength / 2));
  const sliceMs = 70; // okno analizy 70ms odpowiadające długości sylaby
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
