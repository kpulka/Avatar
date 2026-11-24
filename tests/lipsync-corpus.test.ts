/**
 * Golden-span corpus (LIP-07 automated half, Phase 17-03).
 *
 * Pins the END-TO-END DATA RESULT of the EN pipeline: text -> synthetic alignment -> G2P -> merge.
 * Timing is synthetic and uniform (see the fixture note): this guards the data-pipeline logic
 * (lexicon content, OOV rules, merge weighting/renormalization, diphthong split), not timing realism.
 * Real-alignment verification is the live UAT protocol (17-05).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { ensureG2pLoaded } from '../src/lipsync/g2p/g2p-en';
import { mergeCharAlignmentToPhonemes, PhonemeSpan } from '../src/lipsync/g2p/phoneme-merge';
import { PHONEME_POSES, lipPoseToShapes } from '../src/lipsync/g2p/phoneme-visemes';
import { charTokenFor, charPathSpan } from '../src/lipsync/viseme-mappings';
import { CALIBRATION_PRESETS } from '../src/lipsync/calibration';
import { ANIM_DEFAULTS } from '../src/realism/anim-config';
import { CONTROL_SENTENCES, CONVERSATIONAL_PARAGRAPHS } from '../scripts/lipsync-corpus.mjs';
import { defined } from './helpers/defined';

interface CorpusCase {
  id: string;
  group: string;
  path: 'phoneme' | 'char';
  text: string;
  msPerChar: number;
  expect: { phonemeSequence?: string[]; charTokens?: string[] };
}

const corpus = JSON.parse(readFileSync(new URL('./fixtures/lipsync-corpus.json', import.meta.url), 'utf8')) as {
  tolerances: { spanSumToleranceMs: number; minSpanMs: number; maxWordOverflowMs: number };
  cases: CorpusCase[];
};
const { spanSumToleranceMs, minSpanMs, maxWordOverflowMs } = corpus.tolerances;

function alignmentFor(c: CorpusCase) {
  const chars = c.text.split('');
  return {
    chars,
    char_start_times_ms: chars.map((_, i) => i * c.msPerChar),
    char_durations_ms: chars.map(() => c.msPerChar),
    source: 'elevenlabs' as const,
  };
}

/** Word windows as the merge sees them: runs of letters / apostrophes / hyphens. */
function wordWindows(c: CorpusCase): { text: string; startMs: number; endMs: number }[] {
  const out: { text: string; startMs: number; endMs: number }[] = [];
  const re = /[A-Za-z'’-]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(c.text)) !== null) {
    out.push({ text: m[0], startMs: m.index * c.msPerChar, endMs: (m.index + m[0].length) * c.msPerChar });
  }
  return out;
}

const phonemeCases = corpus.cases.filter((c) => c.path === 'phoneme');
const charCases = corpus.cases.filter((c) => c.path === 'char');

describe('lipsync corpus fixture', () => {
  it('has at least 15 cases and covers every control sentence verbatim', () => {
    expect(corpus.cases.length).toBeGreaterThanOrEqual(15);
    for (const sentence of CONTROL_SENTENCES) {
      expect(
        corpus.cases.some((c) => c.text === sentence),
        sentence
      ).toBe(true);
    }
  });

  it('conversational cases are verbatim excerpts of the shared corpus (single source of truth)', () => {
    for (const c of corpus.cases.filter((x) => x.group === 'conversational')) {
      expect(
        CONVERSATIONAL_PARAGRAPHS.some((p: string) => p.includes(c.text)),
        c.id
      ).toBe(true);
    }
  });

  it('ids are unique and the LIPS-05 silent-letter cases are present', () => {
    expect(new Set(corpus.cases.map((c) => c.id)).size).toBe(corpus.cases.length);
    expect(corpus.cases.map((c) => c.id)).toEqual(expect.arrayContaining(['silent-know-what', 'silent-question']));
  });
});

describe('golden spans: phoneme path', () => {
  let spansByCase: Map<string, PhonemeSpan[]>;

  beforeAll(async () => {
    await ensureG2pLoaded();
    spansByCase = new Map(phonemeCases.map((c) => [c.id, mergeCharAlignmentToPhonemes(alignmentFor(c))]));
  });

  for (const c of phonemeCases) {
    describe(c.id, () => {
      it('phoneme sequence equals the pinned sequence (exact)', () => {
        const sequence = spansByCase
          .get(c.id)!
          .filter((s) => !s.glideOf)
          .map((s) => s.phoneme);
        expect(sequence).toEqual(c.expect.phonemeSequence);
      });

      it('spans of every word sum to the word window and never cross it', () => {
        const spans = spansByCase.get(c.id)!;
        for (const word of wordWindows(c)) {
          const inWord = spans.filter((s) => s.startMs >= word.startMs - 1e-6 && s.startMs < word.endMs - 1e-6);
          if (inWord.length === 0) continue;
          const sum = inWord.reduce((acc, s) => acc + s.durationMs, 0);
          expect(Math.abs(sum - (word.endMs - word.startMs)), `${word.text} sum`).toBeLessThanOrEqual(spanSumToleranceMs);
          const last = defined(inWord[inWord.length - 1]);
          expect(last.startMs + last.durationMs - word.endMs, `${word.text} overflow`).toBeLessThanOrEqual(maxWordOverflowMs);
          expect(defined(inWord[0]).startMs).toBeGreaterThanOrEqual(word.startMs - 1e-6);
        }
      });

      it('no span is shorter than the soft-minimum hard floor', () => {
        for (const s of spansByCase.get(c.id)!) expect(s.durationMs, s.phoneme).toBeGreaterThanOrEqual(minSpanMs - 1e-6);
      });

      it('every glide span directly follows its diphthong', () => {
        const spans = spansByCase.get(c.id)!;
        spans.forEach((s, i) => {
          if (s.glideOf) expect(spans[i - 1]?.phoneme).toBe(s.glideOf);
        });
      });
    });
  }
});

describe('golden spans: character path (Polish digraph tokenizer regression)', () => {
  for (const c of charCases) {
    it(`${c.id}: char tokens equal the pinned tokens`, () => {
      const chars = c.text.split('');
      const tokens: string[] = [];
      for (let i = 0; i < chars.length; i++) {
        const token = charTokenFor(chars, i);
        if (token) tokens.push(token);
        i += charPathSpan(chars, i) - 1;
      }
      expect(tokens).toEqual(c.expect.charTokens);
    });
  }
});

// ---------------------------------------------------------------------------------------------
// Computed proxy metrics (no model, no eyes)
// ---------------------------------------------------------------------------------------------

describe('closure presence (M/B/P), computed', () => {
  const balancedClose = Math.min(CALIBRATION_PRESETS.balanced.closeScale, ANIM_DEFAULTS.common.mouthCloseCap);
  let spans: PhonemeSpan[] = [];

  beforeAll(async () => {
    await ensureG2pLoaded();
    spans = phonemeCases.flatMap((c) => mergeCharAlignmentToPhonemes(alignmentFor(c)));
  });

  it('the corpus contains bilabials and each has a span of at least the minimum duration', () => {
    const bilabials = spans.filter((s) => ['M', 'B', 'P'].includes(s.phoneme));
    expect(bilabials.length).toBeGreaterThanOrEqual(15);
    for (const s of bilabials) expect(s.durationMs).toBeGreaterThanOrEqual(minSpanMs - 1e-6);
  });

  it('every bilabial pose is a PERCEIVED closure under balanced: close <= 0.35, press >= 0.3, jaw <= 0.05', () => {
    for (const phoneme of new Set(spans.map((s) => s.phoneme).filter((p) => ['M', 'B', 'P'].includes(p)))) {
      const pose = defined(PHONEME_POSES[phoneme]);
      expect((pose.close ?? 0) * balancedClose, `${phoneme} close`).toBeLessThanOrEqual(0.35);
      expect((pose.press ?? 0) * balancedClose, `${phoneme} press`).toBeGreaterThanOrEqual(0.3);
      expect(pose.jaw ?? 0, `${phoneme} jaw`).toBeLessThanOrEqual(0.05);
    }
  });
});

describe('viseme distinctness proxy (min pairwise L1 distance between pose vectors)', () => {
  const THRESHOLD = 0.15;

  // Poses that are IDENTICAL by design (voiced/voiceless pairs share one mouth shape). Frozen:
  // collapsing one more pair is a table regression and must be a conscious re-baseline.
  const EXPECTED_IDENTICAL_GROUPS = ['B/M/P', 'CH/JH', 'D/N/T', 'DH/TH', 'F/V', 'G/K', 'S/Z', 'SH/ZH'];

  // Documented near-twins (docs/en-visemes.md section 5, EH/AY start pose, ER vs R, AH vs velars): the
  // distance floor of each is pinned, so they cannot silently drift closer. Everything else must stay
  // >= THRESHOLD apart. Values measured on the v1.3 table.
  const KNOWN_TWINS: Record<string, number> = {
    'ER|R': 0.02,
    'AY|EH': 0.08,
    'AH|G/K': 0.12,
  };

  const keys = Object.keys(PHONEME_POSES);
  const shapeNames = new Set<string>();
  const vectors = new Map<string, Map<string, number>>();
  for (const key of keys) {
    const shapes = lipPoseToShapes(defined(PHONEME_POSES[key]));
    vectors.set(key, shapes);
    for (const shape of shapes.keys()) shapeNames.add(shape);
  }
  const l1 = (a: Map<string, number>, b: Map<string, number>) => {
    let d = 0;
    for (const shape of shapeNames) d += Math.abs((a.get(shape) ?? 0) - (b.get(shape) ?? 0));
    return d;
  };

  // Group identical poses.
  const groups: string[][] = [];
  for (const key of keys) {
    const group = groups.find((g) => l1(vectors.get(defined(g[0]))!, vectors.get(key)!) < 1e-9);
    if (group) group.push(key);
    else groups.push([key]);
  }
  const label = (g: string[]) => [...g].sort().join('/');

  it('the set of identical-pose groups is frozen', () => {
    expect(
      groups
        .filter((g) => g.length > 1)
        .map(label)
        .sort()
    ).toEqual(EXPECTED_IDENTICAL_GROUPS);
  });

  it(`distinct poses stay >= ${THRESHOLD} apart, except the pinned near-twins`, () => {
    const pairs: { name: string; distance: number }[] = [];
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const name = [label(defined(groups[i])), label(defined(groups[j]))].sort().join('|');
        pairs.push({ name, distance: l1(vectors.get(defined(defined(groups[i])[0]))!, vectors.get(defined(defined(groups[j])[0]))!) });
      }
    }
    const tooClose = pairs.filter((p) => p.distance < THRESHOLD);
    // every pair under the threshold must be a documented twin ...
    expect(tooClose.map((p) => p.name).sort()).toEqual(Object.keys(KNOWN_TWINS).sort());
    // ... and must not have moved closer than its pinned floor
    for (const p of tooClose) expect(p.distance, p.name).toBeGreaterThanOrEqual(defined(KNOWN_TWINS[p.name]) - 0.005);
    // the closest NON-twin pair, recorded in the 17-03 summary
    const nonTwinMin = Math.min(...pairs.filter((p) => !(p.name in KNOWN_TWINS)).map((p) => p.distance));
    expect(nonTwinMin).toBeGreaterThanOrEqual(THRESHOLD);
  });
});
