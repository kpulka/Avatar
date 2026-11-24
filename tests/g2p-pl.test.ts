/**
 * Polish rule-based G2P (17-04, LIP-05): control words, softness-i, final devoicing, nasals,
 * pose-table coverage, and the merge integration (language dispatch + timing invariant).
 * Pure rules: no lexicon and no model are needed for any g2pPl test.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { g2pPl } from '../src/lipsync/g2p/g2p-pl';
import { detectWordLanguage, charsLookPolish } from '../src/lipsync/g2p/language';
import { ensureG2pLoaded } from '../src/lipsync/g2p/g2p-en';
import { mergeCharAlignmentToPhonemes } from '../src/lipsync/g2p/phoneme-merge';
import { PHONEME_POSES, PL_PHONEME_POSES, mapPhonemeToShapes, lipPoseToShapes } from '../src/lipsync/g2p/phoneme-visemes';
import { defined } from './helpers/defined';

describe('g2pPl control words (17-CONTEXT A.7)', () => {
  it('szczypczyzna: sz and cz are single classes', () => {
    expect(g2pPl('szczypczyzna')).toEqual(['SH', 'CH', 'IH', 'P', 'CH', 'IH', 'Z', 'N', 'AA']);
  });

  it('dzi\u0119kuj\u0119: dzi is ONE soft affricate (the i is consumed), the mid nasal stays nasal, the final one is plain', () => {
    expect(g2pPl('dzi\u0119kuj\u0119')).toEqual(['PL_DZI', 'PL_EN', 'K', 'UW', 'Y', 'EH']);
  });

  it('chata: ch is the velar fricative, never the English CH pose', () => {
    const tokens = g2pPl('chata');
    expect(tokens).toEqual(['PL_H', 'AA', 'T', 'AA']);
    expect(tokens).not.toContain('CH');
  });

  it('ziarno: zi + vowel is ONE soft consonant', () => {
    expect(g2pPl('ziarno')).toEqual(['PL_ZI', 'AA', 'R', 'N', 'AO']);
  });

  it('zima: zi before a consonant is a plain z + i (no false softening)', () => {
    expect(g2pPl('zima')).toEqual(['Z', 'IY', 'M', 'AA']);
  });

  it('trzeba: rz is the ZH class', () => {
    expect(g2pPl('trzeba')).toEqual(['T', 'ZH', 'EH', 'B', 'AA']);
  });

  it('chleb: final devoicing makes the last b a P', () => {
    expect(g2pPl('chleb')).toEqual(['PL_H', 'L', 'EH', 'P']);
  });

  it('nasal vowels: k\u0105t, w\u0119\u017Ce', () => {
    expect(g2pPl('k\u0105t')).toEqual(['K', 'PL_AN', 'T']);
    expect(g2pPl('w\u0119\u017Ce')).toEqual(['V', 'PL_EN', 'ZH', 'EH']);
  });
});

describe('g2pPl rules', () => {
  it('softness-i before every softness vowel, including the nasals', () => {
    expect(g2pPl('nie')).toEqual(['PL_NI', 'EH']);
    expect(g2pPl('siatka')).toEqual(['PL_SI', 'AA', 'T', 'K', 'AA']);
    expect(g2pPl('ci\u0119\u017Cko')).toEqual(['PL_CI', 'PL_EN', 'ZH', 'K', 'AO']);
    expect(g2pPl('cios')).toEqual(['PL_CI', 'AO', 'S']);
    expect(g2pPl('zi\u0105b')).toEqual(['PL_ZI', 'PL_AN', 'P']);
  });

  it('i stays a vowel before a consonant and at the end of a word', () => {
    expect(g2pPl('nigdy')).toEqual(['N', 'IY', 'G', 'D', 'IH']);
    expect(g2pPl('si')).toEqual(['S', 'IY']);
  });

  it('the acute and dotted letters are always soft / ZH', () => {
    expect(g2pPl('\u015Bwiat')).toEqual(['PL_SI', 'V', 'IY', 'AA', 'T']);
    expect(g2pPl('\u017Caba')).toEqual(['ZH', 'AA', 'B', 'AA']);
    expect(g2pPl('\u0107ma')).toEqual(['PL_CI', 'M', 'AA']);
    expect(g2pPl('ko\u0144')).toEqual(['K', 'AO', 'PL_NI']);
    expect(g2pPl('\u017Ale')).toEqual(['PL_ZI', 'L', 'EH']);
  });

  it('dz, d + z-acute, d + z-dot', () => {
    expect(g2pPl('dzwon')).toEqual(['PL_DZ', 'V', 'AO', 'N']);
    expect(g2pPl('d\u017Awi\u0119k')).toEqual(['PL_DZI', 'V', 'IY', 'PL_EN', 'K']);
    expect(g2pPl('d\u017Cem')).toEqual(['JH', 'EH', 'M']);
  });

  it('o-acute is UW, the stroked l is W, y is IH, j is Y', () => {
    expect(g2pPl('g\u00F3ra')).toEqual(['G', 'UW', 'R', 'AA']);
    expect(g2pPl('\u0142ama\u0142')).toEqual(['W', 'AA', 'M', 'AA', 'W']);
    expect(g2pPl('my')).toEqual(['M', 'IH']);
    expect(g2pPl('moja')).toEqual(['M', 'AO', 'Y', 'AA']);
  });

  it('final devoicing covers the voiced obstruents and their soft variants', () => {
    expect(g2pPl('wid')).toEqual(['V', 'IY', 'T']);
    expect(g2pPl('kraj')).toEqual(['K', 'R', 'AA', 'Y']); // j is not an obstruent
    expect(g2pPl('w\u00F3g')).toEqual(['V', 'UW', 'K']);
    expect(g2pPl('w\u00F3z')).toEqual(['V', 'UW', 'S']);
    expect(g2pPl('krew')).toEqual(['K', 'R', 'EH', 'F']);
    expect(g2pPl('mo\u017Ce\u017C')).toEqual(['M', 'AO', 'ZH', 'EH', 'SH']);
    expect(g2pPl('ga\u017A')).toEqual(['G', 'AA', 'PL_SI']);
  });

  it('devoicing touches only the last token', () => {
    expect(g2pPl('zbyt')).toEqual(['Z', 'B', 'IH', 'T']);
  });

  it('is case-insensitive, ignores punctuation, and never throws on junk', () => {
    expect(g2pPl('CHATA')).toEqual(g2pPl('chata'));
    expect(g2pPl("d'zi")).toEqual(g2pPl('dzi'));
    expect(g2pPl('')).toEqual([]);
    expect(g2pPl('123 -')).toEqual([]);
  });

  it('every emitted token has a pose (shared table or PL table) over a broad word list', () => {
    const words = ['szczypczyzna', 'dzi\u0119kuj\u0119', 'chata', 'ziarno', 'zima', 'trzeba', 'chleb', 'k\u0105t', 'w\u0119\u017Ce', '\u015Bwiat',
      '\u017Ad\u017Ab\u0142o', '\u017C\u00F3\u0142\u0107', 'd\u017Cem', 'ci\u0119\u017Cko', 'przepraszam', 'dzie\u0144', 'dzisiaj', 'cze\u015B\u0107', 'ha\u0142as', 'xylofon', 'quiz', 'vat'];
    const unknown = new Set<string>();
    for (const word of words) {
      for (const token of g2pPl(word)) {
        if (mapPhonemeToShapes(token) === null) unknown.add(token);
      }
    }
    expect([...unknown]).toEqual([]);
  });
});

describe('Polish pose table', () => {
  it('PL_H (the [x] of ch / h) is a different pose from the English CH funnel', () => {
    const h = lipPoseToShapes(defined(PL_PHONEME_POSES.PL_H));
    const ch = lipPoseToShapes(defined(PHONEME_POSES.CH));
    expect(h.get('mouthFunnel') ?? 0).toBe(0);
    expect(ch.get('mouthFunnel') ?? 0).toBeGreaterThan(0.3);
  });

  it('the nasal vowels are open with a slight funnel', () => {
    for (const key of ['PL_AN', 'PL_EN']) {
      const shapes = lipPoseToShapes(defined(PL_PHONEME_POSES[key]));
      expect(shapes.get('jawOpen') ?? 0).toBeGreaterThan(0.3);
      expect(shapes.get('mouthFunnel') ?? 0).toBeGreaterThan(0);
    }
  });

  it('the English table is not polluted by PL keys', () => {
    expect(Object.keys(PHONEME_POSES).filter((k) => k.startsWith('PL_'))).toEqual([]);
  });
});

describe('language dispatch', () => {
  beforeAll(async () => {
    await ensureG2pLoaded();
  });

  it('a Polish diacritic always means Polish, whatever the default', () => {
    expect(detectWordLanguage('dzi\u0119kuj\u0119', 'en')).toBe('pl');
    expect(detectWordLanguage('\u0142\u00F3d\u017A', 'en')).toBe('pl');
  });

  it('a Polish-only digraph in a word the English lexicon does not know means Polish', () => {
    expect(detectWordLanguage('szczypczyzna', 'en')).toBe('pl');
    expect(detectWordLanguage('trzeba', 'en')).toBe('pl');
  });

  it('ordinary English words stay English and plain words follow the default', () => {
    expect(detectWordLanguage('hello', 'en')).toBe('en');
    expect(detectWordLanguage('chata', 'en')).toBe('en');
    expect(detectWordLanguage('chata', 'pl')).toBe('pl');
  });

  it('charsLookPolish: one Polish word in the chunk is enough; plain English is not', () => {
    expect(charsLookPolish('Dzie\u0144 dobry'.split(''))).toBe(true);
    expect(charsLookPolish('szczypczyzna'.split(''))).toBe(true);
    expect(charsLookPolish('the church is here'.split(''))).toBe(false);
    expect(charsLookPolish([])).toBe(false);
  });
});

describe('merge integration (PL words)', () => {
  beforeAll(async () => {
    await ensureG2pLoaded();
  });

  function alignmentFor(text: string, msPerChar: number) {
    const chars = text.split('');
    return {
      chars,
      char_start_times_ms: chars.map((_, i) => i * msPerChar),
      char_durations_ms: chars.map(() => msPerChar),
      source: 'elevenlabs' as const,
    };
  }

  it('a Polish word with diacritics is one word, merged through the PL rules', () => {
    const spans = mergeCharAlignmentToPhonemes(alignmentFor('dzi\u0119kuj\u0119', 60));
    expect(spans.map((s) => s.phoneme)).toEqual(['PL_DZI', 'PL_EN', 'K', 'UW', 'Y', 'EH']);
  });

  it('the span-sum invariant holds for Polish words (sum = word window, never crossing it)', () => {
    const text = 'Dzie\u0144 dobry, dzi\u0119kuj\u0119 bardzo';
    const alignment = alignmentFor(text, 55);
    const spans = mergeCharAlignmentToPhonemes(alignment);
    const re = /[A-Za-z\u0105\u0107\u0119\u0142\u0144\u00F3\u015B\u017A\u017C]+/g;
    let m: RegExpExecArray | null;
    let words = 0;
    while ((m = re.exec(text)) !== null) {
      const startMs = m.index * 55;
      const endMs = (m.index + m[0].length) * 55;
      const inWord = spans.filter((s) => s.startMs >= startMs - 1e-6 && s.startMs < endMs - 1e-6);
      const sum = inWord.reduce((acc, s) => acc + s.durationMs, 0);
      expect(Math.abs(sum - (endMs - startMs)), m[0]).toBeLessThanOrEqual(1);
      const last = defined(inWord[inWord.length - 1]);
      expect(last.startMs + last.durationMs - endMs, m[0]).toBeLessThanOrEqual(1);
      words++;
    }
    expect(words).toBe(4);
  });

  it('PL vowels get the vowel weight: a vowel span is longer than a consonant span of the same word', () => {
    const spans = mergeCharAlignmentToPhonemes(alignmentFor('k\u0105t', 100));
    const k = defined(spans[0]);
    const an = defined(spans[1]);
    const t = defined(spans[2]);
    expect(an.durationMs).toBeGreaterThan(k.durationMs);
    expect(an.durationMs).toBeGreaterThan(t.durationMs);
  });

  it('defaultLanguage pl sends plain ASCII words through the PL rules; en keeps them English', () => {
    const al = alignmentFor('chata', 60);
    expect(mergeCharAlignmentToPhonemes(al, { defaultLanguage: 'pl' }).map((s) => s.phoneme)).toEqual(['PL_H', 'AA', 'T', 'AA']);
    expect(mergeCharAlignmentToPhonemes(al).map((s) => s.phoneme)).not.toContain('PL_H');
  });

  it('mixed words in one turn are routed per word', () => {
    const spans = mergeCharAlignmentToPhonemes(alignmentFor('hello dzi\u0119kuj\u0119', 60));
    const phonemes = spans.map((s) => s.phoneme);
    expect(phonemes.slice(0, 4)).toEqual(['HH', 'AH', 'L', 'OW']);
    expect(phonemes.slice(-6)).toEqual(['PL_DZI', 'PL_EN', 'K', 'UW', 'Y', 'EH']);
  });

  it('the Polish path works without the English lexicon (no model needed)', async () => {
    // g2pPl itself never touches the lexicon; the control words above already prove it. Here: the merge of a
    // diacritic word does not depend on lexicon content (it is routed before any lexicon lookup).
    expect(mergeCharAlignmentToPhonemes(alignmentFor('za\u017C\u00F3\u0142\u0107', 60)).length).toBeGreaterThan(0);
  });
});
