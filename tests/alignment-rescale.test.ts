import { describe, it, expect } from 'vitest';
import { rescaleAlignmentToAudio } from '../src/audio/alignment-rescale';

describe('rescaleAlignmentToAudio (chunk-local alignment drift)', () => {
  const base = {
    chars: [' ', 'm', 'o', 'r', 'n', 'i', 'n', 'g'],
    char_start_times_ms: [0, 60, 120, 180, 240, 300, 360, 420],
    char_durations_ms: [60, 60, 60, 60, 60, 60, 60, 60],
    source: 'elevenlabs' as const,
  };

  it('rescales text (480ms) to the full length of the audio chunk (569ms) — drift removed', () => {
    const out = rescaleAlignmentToAudio(base, 569);
    const factor = 569 / 480;
    expect(out.char_start_times_ms[1]).toBeCloseTo(60 * factor, 3);
    const lastEnd = out.char_start_times_ms[7] + out.char_durations_ms[7];
    expect(lastEnd).toBeCloseTo(569, 3);
    // proportions inside are preserved
    expect(out.char_durations_ms[0]).toBeCloseTo(60 * factor, 3);
  });

  it('scale == 1.0 when the text matches the audio exactly', () => {
    const out = rescaleAlignmentToAudio(base, 480);
    expect(out.char_start_times_ms).toEqual(base.char_start_times_ms);
    expect(out.char_durations_ms).toEqual(base.char_durations_ms);
  });

  it('clamps a pathological factor to the range [0.5, 2.5]', () => {
    // 240ms of text over 95ms of audio → raw 0.40 → clamp 0.50
    const short = {
      chars: ['[', 'n'],
      char_start_times_ms: [0, 120],
      char_durations_ms: [120, 120],
      source: 'elevenlabs' as const,
    };
    const out = rescaleAlignmentToAudio(short, 95);
    const lastEnd = out.char_start_times_ms[1] + out.char_durations_ms[1];
    expect(lastEnd).toBeCloseTo(240 * 0.5, 3);
  });

  it('returns an empty/invalid alignment unchanged', () => {
    const empty = { chars: [], char_start_times_ms: [], char_durations_ms: [], source: 'elevenlabs' as const };
    expect(rescaleAlignmentToAudio(empty, 500)).toBe(empty);
    expect(rescaleAlignmentToAudio(base, 0)).toBe(base);
  });

  it('keeps the source', () => {
    expect(rescaleAlignmentToAudio(base, 569).source).toBe('elevenlabs');
  });

  it('clamps the upper factor at 2.5 (the ratio range documented from the live agent)', () => {
    const out = rescaleAlignmentToAudio(base, 480 * 4); // raw 4.0 -> 2.5
    expect(out.char_start_times_ms[1]).toBeCloseTo(60 * 2.5, 6);
    // 2.4x is inside the range and is applied as-is
    const inside = rescaleAlignmentToAudio(base, 480 * 2.4);
    expect(inside.char_start_times_ms[1]).toBeCloseTo(60 * 2.4, 6);
  });

  describe('degenerate input (17-03 edge guards)', () => {
    it('NaN or Infinity durations return the input unchanged', () => {
      const bad = { ...base, char_durations_ms: base.char_durations_ms.map((d, i) => (i === 3 ? Number.NaN : d)) };
      expect(rescaleAlignmentToAudio(bad, 569)).toBe(bad);
      const inf = { ...base, char_start_times_ms: base.char_start_times_ms.map((s, i) => (i === 2 ? Infinity : s)) };
      expect(rescaleAlignmentToAudio(inf, 569)).toBe(inf);
    });

    it('a non-finite audio duration returns the input unchanged', () => {
      expect(rescaleAlignmentToAudio(base, Number.NaN)).toBe(base);
      expect(rescaleAlignmentToAudio(base, Infinity)).toBe(base);
    });

    it('negative start times never come out negative', () => {
      const neg = { ...base, char_start_times_ms: base.char_start_times_ms.map((s, i) => (i === 0 ? -40 : s)) };
      const out = rescaleAlignmentToAudio(neg, 569);
      for (const s of out.char_start_times_ms) expect(s).toBeGreaterThanOrEqual(0);
    });

    it('a single-character chunk is rescaled onto the audio', () => {
      const one = { chars: ['a'], char_start_times_ms: [0], char_durations_ms: [100], source: 'elevenlabs' as const };
      const out = rescaleAlignmentToAudio(one, 150);
      expect(out.char_durations_ms[0]).toBeCloseTo(150, 6);
    });
  });

  describe('speech-bounds anchoring (17-03 task 3a)', () => {
    const SPOKEN = {
      chars: ['a', 'b', 'c', 'd'],
      char_start_times_ms: [0, 100, 200, 300],
      char_durations_ms: [100, 100, 100, 100],
      source: 'elevenlabs' as const,
    };

    it('leading silence: the first character lands on the speech onset, not at 0', () => {
      // 1000 ms chunk, speech from 300 ms to 800 ms
      const out = rescaleAlignmentToAudio(SPOKEN, 1000, { onsetSec: 0.3, offsetSec: 0.8 });
      expect(out.char_start_times_ms[0]).toBeGreaterThanOrEqual(280);
      expect(out.char_start_times_ms[0]).toBeCloseTo(300, 6);
    });

    it('trailing silence: the last character ends at the speech offset, not at the chunk end', () => {
      // 1500 ms chunk, speech 0..1000 ms, 500 ms of trailing silence
      const out = rescaleAlignmentToAudio(SPOKEN, 1500, { onsetSec: 0, offsetSec: 1.0 });
      const lastEnd = out.char_start_times_ms[3] + out.char_durations_ms[3];
      expect(lastEnd).toBeLessThanOrEqual(1000 + 30);
      expect(lastEnd).toBeCloseTo(1000, 6);
    });

    it('proportions inside the spoken span are preserved (linear)', () => {
      const out = rescaleAlignmentToAudio(SPOKEN, 1000, { onsetSec: 0.2, offsetSec: 0.8 });
      const f = 600 / 400;
      expect(out.char_start_times_ms[2]).toBeCloseTo(200 + 200 * f, 6);
      expect(out.char_durations_ms[1]).toBeCloseTo(100 * f, 6);
    });

    it('a spoken span shorter than 100 ms falls back to the whole-chunk rescale', () => {
      const whole = rescaleAlignmentToAudio(SPOKEN, 600);
      const out = rescaleAlignmentToAudio(SPOKEN, 600, { onsetSec: 0.25, offsetSec: 0.3 });
      expect(out).toEqual(whole);
    });

    it('null bounds keep the whole-chunk behavior', () => {
      expect(rescaleAlignmentToAudio(SPOKEN, 600, null)).toEqual(rescaleAlignmentToAudio(SPOKEN, 600));
    });
  });
});
