import { describe, it, expect } from 'vitest';
import { generateEnergyFallbackAlignment, detectSpeechBounds } from '../src/audio/energy-fallback';

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

/** Constant-amplitude PCM of an exact sample count. */
function constantPcm(samples: number, amplitude = 8000): Uint8Array {
  const int16 = new Int16Array(samples).fill(amplitude);
  return new Uint8Array(int16.buffer);
}

describe('Energy fallback edges (17-03)', () => {
  const SR = 10000; // 70 ms = exactly 700 samples
  const WINDOW = 700;

  it('rounds the window count: exactly 1.5 windows -> 2 slices (the tail is not dropped)', () => {
    const a = generateEnergyFallbackAlignment(constantPcm(WINDOW * 1.5), SR);
    expect(a.chars).toHaveLength(2);
    expect(a.energies![1]).toBeGreaterThan(0.2); // the partial tail window has real energy
  });

  it('a remainder below half a window is folded away (1.4 windows -> 1 slice)', () => {
    expect(generateEnergyFallbackAlignment(constantPcm(Math.floor(WINDOW * 1.4)), SR).chars).toHaveLength(1);
  });

  it('all-zero PCM -> every energy is exactly 0 (the face controller enqueues nothing)', () => {
    const a = generateEnergyFallbackAlignment(new Uint8Array(WINDOW * 3 * 2), SR);
    expect(a.energies).toEqual([0, 0, 0]);
  });

  it('an odd byte length is truncated to whole samples without throwing', () => {
    const bytes = new Uint8Array(WINDOW * 2 + 1).fill(1);
    expect(() => generateEnergyFallbackAlignment(bytes, SR)).not.toThrow();
  });

  it('an odd byteOffset (subarray view) is handled without throwing', () => {
    const backing = new Uint8Array(WINDOW * 2 + 3).fill(1);
    expect(() => generateEnergyFallbackAlignment(backing.subarray(1), SR)).not.toThrow();
  });

  it('a non-positive or non-finite sample rate throws a clear error', () => {
    expect(() => generateEnergyFallbackAlignment(new Uint8Array(8), 0)).toThrow(/sample rate/);
    expect(() => generateEnergyFallbackAlignment(new Uint8Array(8), -16000)).toThrow(/sample rate/);
    expect(() => generateEnergyFallbackAlignment(new Uint8Array(8), Number.NaN)).toThrow(/sample rate/);
  });
});

describe('detectSpeechBounds (17-03 task 3a)', () => {
  const SR = 10000;
  const WINDOW = 700;

  /** silence | tone | silence, each in whole 70 ms windows. */
  function burst(leadWindows: number, toneWindows: number, tailWindows: number): Uint8Array {
    const int16 = new Int16Array((leadWindows + toneWindows + tailWindows) * WINDOW);
    for (let i = leadWindows * WINDOW; i < (leadWindows + toneWindows) * WINDOW; i++) int16[i] = 8000;
    return new Uint8Array(int16.buffer);
  }

  it('finds the onset after leading silence and the offset before trailing silence', () => {
    const bounds = detectSpeechBounds(burst(4, 5, 7), SR); // 280 ms silence, 350 ms tone, 490 ms silence
    expect(bounds).not.toBeNull();
    expect(bounds!.onsetSec).toBeCloseTo(0.28, 6);
    expect(bounds!.offsetSec).toBeCloseTo(0.63, 6);
  });

  it('speech that fills the whole chunk -> onset 0, offset = chunk length', () => {
    const bounds = detectSpeechBounds(burst(0, 6, 0), SR);
    expect(bounds).toEqual({ onsetSec: 0, offsetSec: 0.42 });
  });

  it('silence or empty input -> null (caller keeps the whole-chunk rescale)', () => {
    expect(detectSpeechBounds(new Uint8Array(WINDOW * 4 * 2), SR)).toBeNull();
    expect(detectSpeechBounds(new Uint8Array(0), SR)).toBeNull();
  });

  it('audio quieter than the threshold -> null', () => {
    expect(detectSpeechBounds(constantPcm(WINDOW * 3, 300), SR)).toBeNull(); // rms ~0.009 < 0.02
  });

  it('rejects an invalid sample rate', () => {
    expect(() => detectSpeechBounds(new Uint8Array(8), 0)).toThrow(/sample rate/);
  });
});
