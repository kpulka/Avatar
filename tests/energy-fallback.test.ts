import { describe, it, expect } from 'vitest';
import { generateEnergyFallbackAlignment } from '../src/audio/energy-fallback';

/**
 * Generuje surowy PCM (Int16) w buforze bajtowym: przez `durationSec` pierwszą połowę
 * stanowi ton (sinus 440 Hz × 0.8), drugą połowę cisza.
 */
function buildToneThenSilencePcm(sampleRate: number, durationSec: number): Uint8Array {
  const totalSamples = Math.floor(sampleRate * durationSec);
  const int16 = new Int16Array(totalSamples);
  const halfSamples = Math.floor(totalSamples / 2);

  for (let i = 0; i < totalSamples; i++) {
    if (i < halfSamples) {
      // Pełna amplituda: sinus 440 Hz, składowa 0.8 zakresu int16
      int16[i] = Math.round(0.8 * 32767 * Math.sin((2 * Math.PI * 440 * i) / sampleRate));
    } else {
      int16[i] = 0; // cisza
    }
  }

  return new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
}

describe('Energy Fallback Alignment (jaw-only)', () => {
  it('zwraca jaw-only alignment ze spacjami i energią RMS per okno 70ms', () => {
    const sampleRate = 44100;
    const pcmBytes = buildToneThenSilencePcm(sampleRate, 0.3); // 0.3 s -> ~4 okna po 70ms

    const alignment = generateEnergyFallbackAlignment(pcmBytes, sampleRate);

    // Źródło fallbacku jest oznaczone wprost
    expect(alignment.source).toBe('energy-fallback');

    // chars: wyłącznie spacje (zero fałszywych samogłosek A/O/E/I/U/M)
    expect(alignment.chars.length).toBeGreaterThan(0);
    for (const ch of alignment.chars) {
      expect(ch).toBe(' ');
    }

    // energies: po jednej wartości RMS na okno (4-5 okien dla 0.3s)
    expect(alignment.energies?.length).toBe(alignment.chars.length);
    expect(alignment.energies!.length).toBeGreaterThanOrEqual(4);
    expect(alignment.energies!.length).toBeLessThanOrEqual(5);

    // Pierwsza połowa (ton) ma energię powyżej progu; ostatnie okno (cisza) poniżej
    const first = alignment.energies![0];
    const last = alignment.energies![alignment.energies!.length - 1];
    expect(first).toBeGreaterThan(0.02);
    expect(last).toBeLessThan(0.02);

    // Times/durations zachowane w formacie alignmentu (starty co 70ms)
    expect(alignment.char_start_times_ms[0]).toBe(0);
    expect(alignment.char_durations_ms[0]).toBe(70);
  });

  it('dla pustego PCM zwraca 1 element (zabezpieczenie numSlices = max(1, ...))', () => {
    const emptyPcm = new Uint8Array(0);

    const alignment = generateEnergyFallbackAlignment(emptyPcm, 44100);

    expect(alignment.source).toBe('energy-fallback');
    expect(alignment.chars.length).toBe(1);
    expect(alignment.chars[0]).toBe(' ');
    expect(alignment.energies?.length).toBe(1);
    expect(alignment.energies![0]).toBe(0); // brak sygnału -> rms 0
    expect(alignment.char_durations_ms[0]).toBe(70);
  });
});
