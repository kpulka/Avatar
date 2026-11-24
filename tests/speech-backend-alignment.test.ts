import { describe, it, expect } from 'vitest';
import { normalizeAlignmentPayload } from '../src/audio/alignment-normalize';
import { defined } from './helpers/defined';

const CHARS = ['h', 'i', ' ', 'y', 'o', 'u'];
const STARTS_MS = [0, 60, 120, 180, 240, 300];
const DURS_MS = [60, 60, 60, 60, 60, 60];

describe('normalizeAlignmentPayload (T-1 matrix)', () => {
  describe('container aliases', () => {
    for (const key of ['alignment', 'normalized_alignment', 'alignments'] as const) {
      it(`accepts the alignment under "${key}"`, () => {
        const out = normalizeAlignmentPayload({
          audio_base_64: 'AAAA',
          [key]: { chars: CHARS, char_start_times_ms: STARTS_MS, char_durations_ms: DURS_MS },
        });
        expect(out).toEqual({
          chars: CHARS,
          char_start_times_ms: STARTS_MS,
          char_durations_ms: DURS_MS,
          source: 'elevenlabs',
        });
      });
    }

    it('accepts a bare alignment object (no container)', () => {
      const out = normalizeAlignmentPayload({ chars: CHARS, char_start_times_ms: STARTS_MS, char_durations_ms: DURS_MS });
      expect(out?.chars).toEqual(CHARS);
    });

    it('prefers "alignment" over the other aliases', () => {
      const out = normalizeAlignmentPayload({
        alignment: { chars: ['a'], char_start_times_ms: [0], char_durations_ms: [10] },
        normalized_alignment: { chars: ['b'], char_start_times_ms: [0], char_durations_ms: [10] },
      });
      expect(out?.chars).toEqual(['a']);
    });
  });

  describe('character field aliases and units', () => {
    it('accepts "characters" as the character array', () => {
      const out = normalizeAlignmentPayload({
        alignment: { characters: CHARS, char_start_times_ms: STARTS_MS, char_durations_ms: DURS_MS },
      });
      expect(out?.chars).toEqual(CHARS);
    });

    it('seconds and milliseconds describe the same alignment (x1000)', () => {
      const ms = normalizeAlignmentPayload({
        alignment: { chars: CHARS, char_start_times_ms: STARTS_MS, char_durations_ms: DURS_MS },
      });
      const sec = normalizeAlignmentPayload({
        alignment: {
          characters: CHARS,
          character_start_times_seconds: STARTS_MS.map((v) => v / 1000),
          character_end_times_seconds: STARTS_MS.map((v, i) => (v + defined(DURS_MS[i])) / 1000),
        },
      });
      expect(sec).not.toBeNull();
      expect(sec!.chars).toEqual(ms!.chars);
      sec!.char_start_times_ms.forEach((v, i) => expect(v).toBeCloseTo(defined(ms!.char_start_times_ms[i]), 6));
      sec!.char_durations_ms.forEach((v, i) => expect(v).toBeCloseTo(defined(ms!.char_durations_ms[i]), 6));
    });

    it('derives durations from end times with a 25 ms floor', () => {
      const out = normalizeAlignmentPayload({
        alignment: {
          characters: ['a', 'b'],
          character_start_times_seconds: [0, 0.01],
          character_end_times_seconds: [0.005, 0.2],
        },
      });
      expect(out!.char_durations_ms[0]).toBe(25); // 5 ms -> floor
      expect(out!.char_durations_ms[1]).toBeCloseTo(190, 6);
    });

    it('a realistic ElevenLabs payload (seconds, characters) normalizes exactly', () => {
      const out = normalizeAlignmentPayload({
        type: 'audio',
        audio_event: undefined,
        alignment: {
          characters: ['H', 'e', 'l', 'l', 'o'],
          character_start_times_seconds: [0, 0.105, 0.163, 0.221, 0.279],
          character_end_times_seconds: [0.105, 0.163, 0.221, 0.279, 0.395],
        },
      });
      expect(out!.chars).toEqual(['H', 'e', 'l', 'l', 'o']);
      expect(out!.char_start_times_ms.map((v) => Math.round(v))).toEqual([0, 105, 163, 221, 279]);
      expect(out!.char_durations_ms.map((v) => Math.round(v))).toEqual([105, 58, 58, 58, 116]);
      expect(out!.source).toBe('elevenlabs');
    });
  });

  describe('durations', () => {
    it('missing durations -> a flat 50 ms per character', () => {
      const out = normalizeAlignmentPayload({ alignment: { chars: CHARS, char_start_times_ms: STARTS_MS } });
      expect(out!.char_durations_ms).toEqual(CHARS.map(() => 50));
    });

    it('a duration array of the wrong length is ignored (flat 50 ms)', () => {
      const out = normalizeAlignmentPayload({
        alignment: { chars: CHARS, char_start_times_ms: STARTS_MS, char_durations_ms: [10, 10] },
      });
      expect(out!.char_durations_ms).toEqual(CHARS.map(() => 50));
    });
  });

  describe('degenerate input degrades to null (fallback), never throws', () => {
    it('start times with a different length than the characters -> null', () => {
      expect(
        normalizeAlignmentPayload({ alignment: { chars: CHARS, char_start_times_ms: [0, 60], char_durations_ms: DURS_MS } })
      ).toBeNull();
    });

    it('missing start times -> null', () => {
      expect(normalizeAlignmentPayload({ alignment: { chars: CHARS, char_durations_ms: DURS_MS } })).toBeNull();
    });

    it('empty or non-array characters -> null', () => {
      expect(normalizeAlignmentPayload({ alignment: { chars: [], char_start_times_ms: [] } })).toBeNull();
      expect(normalizeAlignmentPayload({ alignment: { chars: 'hi', char_start_times_ms: [0, 1] } })).toBeNull();
      expect(normalizeAlignmentPayload({ alignment: { chars: [1, 2], char_start_times_ms: [0, 1] } })).toBeNull();
    });

    it('garbage payloads -> null', () => {
      for (const garbage of [null, undefined, 42, 'text', true, [], {}, { alignment: null }, { alignment: 'x' }, { alignments: [] }]) {
        expect(normalizeAlignmentPayload(garbage)).toBeNull();
      }
    });

    it('NaN / Infinity in the start times drops the whole alignment', () => {
      expect(
        normalizeAlignmentPayload({
          alignment: { chars: ['a', 'b'], char_start_times_ms: [0, Number.NaN], char_durations_ms: [10, 10] },
        })
      ).toBeNull();
      expect(
        normalizeAlignmentPayload({
          alignment: { chars: ['a', 'b'], char_start_times_ms: [0, Infinity], char_durations_ms: [10, 10] },
        })
      ).toBeNull();
    });

    it('NaN in a full-length duration array drops the whole alignment', () => {
      expect(
        normalizeAlignmentPayload({
          alignment: { chars: ['a', 'b'], char_start_times_ms: [0, 10], char_durations_ms: [10, Number.NaN] },
        })
      ).toBeNull();
    });
  });

  describe('negative times are clamped to 0 (pinned behavior)', () => {
    it('negative start times and durations clamp to 0', () => {
      const out = normalizeAlignmentPayload({
        alignment: { chars: ['a', 'b'], char_start_times_ms: [-30, 10], char_durations_ms: [-5, 40] },
      });
      expect(out!.char_start_times_ms).toEqual([0, 10]);
      expect(out!.char_durations_ms).toEqual([0, 40]);
    });
  });

  it('the source is always elevenlabs on success, never the energy fallback', () => {
    const out = normalizeAlignmentPayload({
      alignment: { chars: CHARS, char_start_times_ms: STARTS_MS, char_durations_ms: DURS_MS, source: 'energy-fallback' },
    });
    expect(out!.source).toBe('elevenlabs');
  });
});
