import { describe, it, expect } from 'vitest';
import {
  mergeCharAlignmentToPhonemes,
  distributeDurations,
  HARD_MIN_SPAN_MS,
} from '../src/lipsync/g2p/phoneme-merge';
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

// ---------------------------------------------------------------------------------------------
// Phase 17 (17-02): window invariant, degenerate edges, diphthong motion
// ---------------------------------------------------------------------------------------------

interface WordWindow {
  text: string;
  startMs: number;
  endMs: number;
}

/** Word windows of a uniform alignment, derived independently of the merge code. */
function wordWindows(text: string, msPerChar: number): WordWindow[] {
  const windows: WordWindow[] = [];
  const re = /[A-Za-z'’-]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    windows.push({ text: m[0], startMs: m.index * msPerChar, endMs: (m.index + m[0].length) * msPerChar });
  }
  return windows;
}

const INVARIANT_SENTENCES = [
  'Map, mop, pop - fine, five, very - wine, white',
  'I am so glad you are here today, it is a pleasure.',
  'know what the question is about',
  'my boy, how do you go every day',
  'It was the best of times, it was the worst of times.',
];

describe('merge window invariant (LIP-03)', () => {
  beforeAll(async () => {
    await ensureG2pLoaded();
  });

  for (const msPerChar of [100, 55, 30, 12]) {
    it(`spans of every word sum to its window and never cross it (${msPerChar} ms/char)`, () => {
      for (const text of INVARIANT_SENTENCES) {
        const spans = mergeCharAlignmentToPhonemes(alignmentFor(text, msPerChar));
        for (const word of wordWindows(text, msPerChar)) {
          const inWord = spans.filter((s) => s.startMs >= word.startMs - 1e-6 && s.startMs < word.endMs - 1e-6);
          if (inWord.length === 0) continue; // a word the G2P layer yields nothing for
          const sum = inWord.reduce((acc, s) => acc + s.durationMs, 0);
          expect(sum, `${word.text} @${msPerChar}`).toBeCloseTo(word.endMs - word.startMs, 0);
          const last = inWord[inWord.length - 1];
          expect(last.startMs + last.durationMs, `${word.text} end`).toBeLessThanOrEqual(word.endMs + 1);
          expect(inWord[0].startMs).toBeCloseTo(word.startMs, 3);
          // contiguous, ordered, no overlap
          for (let k = 1; k < inWord.length; k++) {
            expect(inWord[k].startMs).toBeCloseTo(inWord[k - 1].startMs + inWord[k - 1].durationMs, 3);
          }
        }
      }
    });
  }

  it('regression: a very short word no longer bleeds into the next one', () => {
    // "the" in 50 ms (3 chars x ~16.7 ms), then a normal "cat". The previous algorithm clamped DH and AH
    // to 35 ms each (70 ms in a 50 ms window) and pushed the spans 20 ms into "cat".
    const chars = 'the cat'.split('');
    const starts = [0, 16.7, 33.4, 50, 100, 200, 300];
    const durs = [16.7, 16.7, 16.6, 50, 100, 100, 100];
    const spans = mergeCharAlignmentToPhonemes({ chars, char_start_times_ms: starts, char_durations_ms: durs });
    const the = spans.filter((s) => s.startMs < 50);
    expect(the.map((s) => s.phoneme)).toEqual(['DH', 'AH']);
    const theEnd = the[the.length - 1].startMs + the[the.length - 1].durationMs;
    expect(theEnd).toBeLessThanOrEqual(50.0001);

    // "cat" is unaffected by the pathological word before it: same spans as when it is alone.
    const catAfter = spans.filter((s) => s.startMs >= 100);
    const alone = mergeCharAlignmentToPhonemes({
      chars: ['c', 'a', 't'],
      char_start_times_ms: [100, 200, 300],
      char_durations_ms: [100, 100, 100],
    });
    expect(catAfter).toEqual(alone);
  });
});

describe('distributeDurations', () => {
  it('returns the plain proportional split when the soft minimum is not needed', () => {
    const d = distributeDurations([0.8, 1.2, 0.8], 280);
    expect(d[0]).toBeCloseTo(80, 6);
    expect(d[1]).toBeCloseTo(120, 6);
    expect(d[2]).toBeCloseTo(80, 6);
  });

  it('renormalizes inside the window when the 35 ms floor would overflow it', () => {
    const d = distributeDurations([0.8, 1.2, 0.8], 60);
    expect(d.reduce((a, b) => a + b, 0)).toBeCloseTo(60, 6);
    for (const x of d) expect(x).toBeGreaterThanOrEqual(HARD_MIN_SPAN_MS - 1e-9);
  });

  it('keeps the hard floor on tiny spans and gives the rest to the long one (water filling)', () => {
    const d = distributeDurations([0.8, 0.8, 0.8, 12], 80);
    expect(d.reduce((a, b) => a + b, 0)).toBeCloseTo(80, 6);
    expect(d[0]).toBeCloseTo(HARD_MIN_SPAN_MS, 6);
    expect(d[3]).toBeCloseTo(80 - 3 * HARD_MIN_SPAN_MS, 6);
  });

  it('splits equally when even the hard floor cannot fit (pathological 20 ms word)', () => {
    const d = distributeDurations([0.8, 1.2, 0.8], 20);
    for (const x of d) expect(x).toBeCloseTo(20 / 3, 6);
  });

  it('empty weights -> empty result', () => {
    expect(distributeDurations([], 100)).toEqual([]);
  });
});

describe('degenerate alignments (pinned behavior)', () => {
  beforeAll(async () => {
    await ensureG2pLoaded();
  });

  it('a zero-duration word is skipped and its neighbours are unaffected', () => {
    const chars = 'cat dog hat'.split('');
    const inDog = (i: number) => i >= 4 && i <= 6;
    // "dog" collapsed onto a single instant: equal start times and zero durations -> window 0
    const starts = chars.map((_, i) => (inDog(i) ? 400 : i * 100));
    const durs = chars.map((_, i) => (inDog(i) ? 0 : 100));
    const spans = mergeCharAlignmentToPhonemes({ chars, char_start_times_ms: starts, char_durations_ms: durs });
    const phonemes = spans.map((s) => s.phoneme);
    expect(phonemes).not.toContain('D');
    expect(phonemes.slice(0, 3)).toEqual(wordToPhonemesSync('cat'));
    expect(phonemes.slice(3)).toEqual(wordToPhonemesSync('hat'));
    expect(spans[spans.length - 1].startMs + spans[spans.length - 1].durationMs).toBeCloseTo(1100, 3);
  });

  it('missing start times anchor the word at 0 (not silently shifted)', () => {
    const spans = mergeCharAlignmentToPhonemes({
      chars: ['h', 'i'],
      char_start_times_ms: [],
      char_durations_ms: [100, 100],
    });
    expect(spans.length).toBeGreaterThan(0);
    expect(spans[0].startMs).toBe(0);
    const end = spans[spans.length - 1].startMs + spans[spans.length - 1].durationMs;
    expect(end).toBeCloseTo(100, 3); // window = [0, 0 + duration of the last char]
  });

  it('a single-phoneme word spans exactly its window', () => {
    const spans = mergeCharAlignmentToPhonemes(alignmentFor('a', 80));
    expect(spans).toHaveLength(1);
    expect(spans[0].startMs).toBe(0);
    expect(spans[0].durationMs).toBeCloseTo(80, 6);
  });

  it('a lone hyphen or apostrophe produces no empty-phoneme span', () => {
    for (const text of ['yes - no', "yes ' no"]) {
      const spans = mergeCharAlignmentToPhonemes(alignmentFor(text, 100));
      expect(spans.every((s) => s.phoneme !== '')).toBe(true);
      expect(spans.map((s) => s.phoneme)).toEqual([...wordToPhonemesSync('yes')!, ...wordToPhonemesSync('no')!]);
    }
  });

  it('digits only -> no spans, no crash', () => {
    expect(mergeCharAlignmentToPhonemes(alignmentFor('123', 50))).toEqual([]);
  });
});

describe('diphthong motion: AY and AW emit a start + glide span (LIP-04)', () => {
  beforeAll(async () => {
    await ensureG2pLoaded();
  });

  it('"my" -> M, AY, IH (glide of AY) inside the word window', () => {
    const spans = mergeCharAlignmentToPhonemes(alignmentFor('my', 150));
    expect(spans.map((s) => s.phoneme)).toEqual(['M', 'AY', 'IH']);
    expect(spans[2].glideOf).toBe('AY');
    expect(spans[1].glideOf).toBeUndefined();
    const end = spans[2].startMs + spans[2].durationMs;
    expect(end).toBeCloseTo(300, 6);
    // the own pose gets the larger share (60/40 of the diphthong's time)
    expect(spans[1].durationMs / (spans[1].durationMs + spans[2].durationMs)).toBeCloseTo(0.6, 2);
  });

  it('"how" -> HH, AW, UH (glide of AW)', () => {
    const spans = mergeCharAlignmentToPhonemes(alignmentFor('how', 120));
    expect(spans.map((s) => s.phoneme)).toEqual(['HH', 'AW', 'UH']);
    expect(spans[2].glideOf).toBe('AW');
    expect(spans[2].startMs + spans[2].durationMs).toBeCloseTo(360, 6);
  });

  it('EY / OW / OY stay single static poses: "day", "go", "boy"', () => {
    for (const [word, expected] of [
      ['day', ['D', 'EY']],
      ['go', ['G', 'OW']],
      ['boy', ['B', 'OY']],
    ] as const) {
      const spans = mergeCharAlignmentToPhonemes(alignmentFor(word, 100));
      expect(spans.map((s) => s.phoneme)).toEqual(expected);
      expect(spans.every((s) => s.glideOf === undefined)).toBe(true);
    }
  });

  it('the diphthong pair still respects the word-sum invariant at fast speech', () => {
    const spans = mergeCharAlignmentToPhonemes(alignmentFor('my', 20));
    const total = spans.reduce((acc, s) => acc + s.durationMs, 0);
    expect(total).toBeCloseTo(40, 6);
    expect(spans[spans.length - 1].startMs + spans[spans.length - 1].durationMs).toBeCloseTo(40, 6);
  });
});
