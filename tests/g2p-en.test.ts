import { describe, it, expect, beforeAll } from 'vitest';
import { ensureG2pLoaded, isG2pReady, g2pAvailable, wordToPhonemesSync } from '../src/lipsync/g2p/g2p-en';

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
