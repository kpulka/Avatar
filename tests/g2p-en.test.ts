import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { ensureG2pLoaded, isG2pReady, g2pAvailable, wordToPhonemesSync, wordInLexicon, rulesFallback } from '../src/lipsync/g2p/g2p-en';
import { GATE_TOKENS } from '../scripts/lipsync-corpus.mjs';

describe('G2P EN (CMUdict + rules)', () => {
  beforeAll(async () => {
    await ensureG2pLoaded();
  });

  it('loads the CMUdict lexicon', () => {
    expect(isG2pReady()).toBe(true);
    expect(g2pAvailable()).toBe(true);
  });

  it('maps known words to ARPAbet phonemes (silent letters disappear)', () => {
    expect(wordToPhonemesSync('know')).toEqual(['N', 'OW']); // silent K
    expect(wordToPhonemesSync('though')).toEqual(['DH', 'OW']); // silent GH
    expect(wordToPhonemesSync('team')).toEqual(['T', 'IY', 'M']); // EA -> IY (one phoneme)
    expect(wordToPhonemesSync('what')).toEqual(['W', 'AH', 'T']);
  });

  it('maps words with several phonemes and affricates', () => {
    expect(wordToPhonemesSync('question')).toEqual(['K', 'W', 'EH', 'S', 'CH', 'AH', 'N']);
    expect(wordToPhonemesSync('nation')).toEqual(['N', 'EY', 'SH', 'AH', 'N']);
    expect(wordToPhonemesSync('about')).toEqual(['AH', 'B', 'AW', 'T']);
  });

  it('removes stress digits from all phonemes', () => {
    for (const w of ['know', 'though', 'question', 'team', 'about', 'nation', 'what']) {
      const phonemes = wordToPhonemesSync(w);
      expect(phonemes).not.toBeNull();
      for (const p of phonemes!) {
        expect(p).not.toMatch(/\d/);
      }
    }
  });

  it('rule-based fallback for words outside the lexicon (OOV)', () => {
    const result = wordToPhonemesSync('zzzqqq');
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(0);
  });

  it('returns null for empty input', () => {
    expect(wordToPhonemesSync('')).toBeNull();
    expect(wordToPhonemesSync('!!!')).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// Phase 17 (17-01): pruned lexicon + hardened OOV rules
// ---------------------------------------------------------------------------------------------

interface OovCase {
  word: string;
  via: 'rules' | 'lexicon';
  expect?: string[];
  endsWith?: string[];
  absent?: string[];
}

const oovFixture = JSON.parse(readFileSync(new URL('./fixtures/oov-wordlist.json', import.meta.url), 'utf8')) as { cases: OovCase[] };

describe('OOV exception coverage (LIP-02)', () => {
  beforeAll(async () => {
    await ensureG2pLoaded();
  });

  it.each(oovFixture.cases.map((c) => [`${c.word} (${c.via})`, c] as const))('%s', (_label, c) => {
    const phonemes = c.via === 'rules' ? rulesFallback(c.word) : wordToPhonemesSync(c.word);
    expect(phonemes).not.toBeNull();
    if (c.expect) expect(phonemes).toEqual(c.expect);
    if (c.endsWith) expect(phonemes!.slice(-c.endsWith.length)).toEqual(c.endsWith);
    for (const forbidden of c.absent ?? []) expect(phonemes).not.toContain(forbidden);
  });

  it('keeps the legacy rules for words without silent-letter classes', () => {
    expect(rulesFallback('comb')).toEqual(['K', 'AA', 'M']); // final MB -> M
    expect(rulesFallback('know')).toEqual(['N', 'OW']); // initial KN
    expect(rulesFallback('though')).toEqual(['TH', 'AW']); // GH silent (OOV-only vowel quirk, documented)
  });

  it('short words ending in "ed" keep their vowel instead of losing it', () => {
    expect(rulesFallback('red')).toEqual(['R', 'EH', 'D']);
    expect(rulesFallback('shed')).toEqual(['SH', 'EH', 'D']);
  });
});

describe('pruned lexicon (LIP-01)', () => {
  beforeAll(async () => {
    await ensureG2pLoaded();
  });

  it('resolves at least 95% of the corpus tokens straight from the lexicon', () => {
    const missed = GATE_TOKENS.filter((token: string) => !wordInLexicon(token));
    const rate = 1 - missed.length / GATE_TOKENS.length;
    // The threshold is the phase gate; never lower it to make a regression pass. Regenerate
    // the lexicon (npm run build:dict) or improve the ranking instead.
    expect(rate, `missed: ${[...new Set(missed)].join(', ')}`).toBeGreaterThanOrEqual(0.95);
  });

  it('wordInLexicon follows the same ladder as wordToPhonemesSync (apostrophes, hyphens)', () => {
    expect(wordInLexicon('don’t')).toBe(wordInLexicon("don't"));
    expect(wordInLexicon('')).toBe(false);
    expect(wordInLexicon('zzzqqq')).toBe(false);
    // a word that only the rules can produce still yields phonemes
    expect(wordToPhonemesSync('zzzqqq')).not.toBeNull();
  });

  it('artifact integrity: counts, ordering, ARPAbet-only, no stress digits', () => {
    const artifact = JSON.parse(readFileSync(new URL('../src/lipsync/g2p/dict-en-pruned.json', import.meta.url), 'utf8')) as {
      meta: { entries: number; source: string };
      entries: Record<string, string>;
    };
    const keys = Object.keys(artifact.entries);
    expect(artifact.meta.entries).toBeGreaterThanOrEqual(5000);
    expect(keys.length).toBe(artifact.meta.entries);
    expect(keys).toEqual([...keys].sort());
    const arpabet = new Set([
      'AA',
      'AE',
      'AH',
      'AO',
      'AW',
      'AY',
      'B',
      'CH',
      'D',
      'DH',
      'EH',
      'ER',
      'EY',
      'F',
      'G',
      'HH',
      'IH',
      'IY',
      'JH',
      'K',
      'L',
      'M',
      'N',
      'NG',
      'OW',
      'OY',
      'P',
      'R',
      'S',
      'SH',
      'T',
      'TH',
      'UH',
      'UW',
      'V',
      'W',
      'Y',
      'Z',
      'ZH',
    ]);
    for (const [word, pronunciation] of Object.entries(artifact.entries)) {
      for (const phoneme of pronunciation.split(' ')) {
        expect(arpabet.has(phoneme), `${word}: ${phoneme}`).toBe(true);
      }
    }
  });

  it('the browser bundle no longer imports the full CMU dictionary', () => {
    const importing: string[] = [];
    const walk = (dir: URL) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
        if (entry.isDirectory()) walk(child);
        else if (entry.name.endsWith('.ts') && /(from|import\()\s*['"]cmu-pronouncing-dictionary/.test(readFileSync(child, 'utf8'))) {
          importing.push(entry.name);
        }
      }
    };
    walk(new URL('../src/', import.meta.url));
    expect(importing).toEqual([]);
  });
});
