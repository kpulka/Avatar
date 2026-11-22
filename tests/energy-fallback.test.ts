import { describe, it, expect } from 'vitest';
import { generateEnergyFallbackAlignment } from '../src/audio/energy-fallback';

/**
 * Generates raw PCM (Int16) in a byte buffer: for `durationSec` the first half
 * is a tone (sine 440 Hz × 0.8), the second half is silence.
 */
function buildToneThenSilencePcm(sampleRate: number, durationSec: number): Uint8Array {
  const totalSamples = Math.floor(sampleRate * durationSec);
  const int16 = new Int16Array(totalSamples);
  const halfSamples = Math.floor(totalSamples / 2);

  for (let i = 0; i < totalSamples; i++) {
    if (i < halfSamples) {
      // Full amplitude: 440 Hz sine, 0.8 of the int16 range
      int16[i] = Math.round(0.8 * 32767 * Math.sin((2 * Math.PI * 440 * i) / sampleRate));
    } else {
      int16[i] = 0; // cisza
    }
  }

  return new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
}

describe('Energy Fallback Alignment (jaw-only)', () => {
  it('returns a jaw-only alignment with spaces and an RMS energy per 70ms window', () => {
    const sampleRate = 44100;
    const pcmBytes = buildToneThenSilencePcm(sampleRate, 0.3); // 0.3 s -> ~4 windows of 70ms

    const alignment = generateEnergyFallbackAlignment(pcmBytes, sampleRate);

    // The fallback source is marked explicitly
    expect(alignment.source).toBe('energy-fallback');

    // chars: spaces only (zero false vowels A/O/E/I/U/M)
    expect(alignment.chars.length).toBeGreaterThan(0);
    for (const ch of alignment.chars) {
      expect(ch).toBe(' ');
    }

    // energies: one RMS value per window (4-5 windows for 0.3s)
    expect(alignment.energies?.length).toBe(alignment.chars.length);
    expect(alignment.energies!.length).toBeGreaterThanOrEqual(4);
    expect(alignment.energies!.length).toBeLessThanOrEqual(5);

    // The first half (tone) has energy above the threshold; the last window (silence) is below it
    const first = alignment.energies![0];
    const last = alignment.energies![alignment.energies!.length - 1];
    expect(first).toBeGreaterThan(0.02);
    expect(last).toBeLessThan(0.02);

    // Times/durations kept in the alignment format (starts every 70ms)
    expect(alignment.char_start_times_ms[0]).toBe(0);
    expect(alignment.char_durations_ms[0]).toBe(70);
  });

  it('for empty PCM returns 1 element (numSlices guard = max(1, ...))', () => {
    const emptyPcm = new Uint8Array(0);

    const alignment = generateEnergyFallbackAlignment(emptyPcm, 44100);

    expect(alignment.source).toBe('energy-fallback');
    expect(alignment.chars.length).toBe(1);
    expect(alignment.chars[0]).toBe(' ');
    expect(alignment.energies?.length).toBe(1);
    expect(alignment.energies![0]).toBe(0); // no signal -> rms 0
    expect(alignment.char_durations_ms[0]).toBe(70);
  });
});
