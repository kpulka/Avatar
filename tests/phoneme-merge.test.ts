import { describe, it, expect } from 'vitest';
import { mergeCharAlignmentToPhonemes } from '../src/lipsync/g2p/phoneme-merge';
import { CharAlignment } from '../src/types/avatar';
import { wordToPhonemesSync } from '../src/lipsync/g2p/g2p-en';
import { beforeAll } from 'vitest';
import { ensureG2pLoaded } from '../src/lipsync/g2p/g2p-en';

function alignmentFor(text: string, msPerChar = 100, source: CharAlignment['source'] = 'elevenlabs'): CharAlignment {
  const chars = text.split('');
  return {
    chars,
    char_start_times_ms: chars.map((_, idx) => idx * msPerChar),
    char_durations_ms: chars.map(() => msPerChar),
    source,
  };
}

describe('mergeCharAlignmentToPhonemes (ElevenLabs timing anchors)', () => {
  beforeAll(async () => {
    await ensureG2pLoaded();
  });

  it('splits word time into phonemes — silent letters produce no spans of their own', () => {
    // "know what" — 9 characters, 100 ms/char; know=4 chars (400 ms), what=4 chars (400 ms)
    const alignment = alignmentFor('know what');
    const spans = mergeCharAlignmentToPhonemes(alignment);

    // know -> N, OW (silent K disappears); what -> W, AH, T
    expect(spans).toHaveLength(5);
    expect(spans[0].phoneme).toBe('N');
    expect(spans[1].phoneme).toBe('OW');
    expect(spans[2].phoneme).toBe('W');
    expect(spans[3].phoneme).toBe('AH');
    expect(spans[4].phoneme).toBe('T');
  });

  it('preserves the word time boundaries (first start, sum of durations = word length)', () => {
    const alignment = alignmentFor('know what');
    const spans = mergeCharAlignmentToPhonemes(alignment);

    // know: word from 0 to 400 ms
    expect(spans[0].startMs).toBeCloseTo(0, 0);
    const knowEnd = spans[0].startMs + spans[0].durationMs + spans[1].durationMs;
    expect(knowEnd).toBeCloseTo(400, 0);

    // what: word from 500 to 900 ms
    expect(spans[2].startMs).toBeCloseTo(500, 0);
    const whatEnd = spans[2].durationMs + spans[3].durationMs + spans[4].durationMs;
    expect(spans[2].startMs + whatEnd).toBeCloseTo(900, 0);
  });

  it('returns [] for the acoustic fallback (source energy-fallback)', () => {
    const alignment = alignmentFor('any words', 100, 'energy-fallback');
    expect(mergeCharAlignmentToPhonemes(alignment)).toEqual([]);
  });

  it('punctuation produces no spans', () => {
    const alignment = alignmentFor('say it.');
    const spans = mergeCharAlignmentToPhonemes(alignment);
    const expected =
      (wordToPhonemesSync('say')?.length ?? 0) + (wordToPhonemesSync('it')?.length ?? 0);
    expect(spans).toHaveLength(expected);
    for (const span of spans) {
      expect(span.phoneme).not.toBe('.');
    }
  });

  it('empty alignment -> []', () => {
    expect(
      mergeCharAlignmentToPhonemes({ chars: [], char_start_times_ms: [], char_durations_ms: [] })
    ).toEqual([]);
  });
});
