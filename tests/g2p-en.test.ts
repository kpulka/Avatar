import { describe, it, expect, beforeAll } from 'vitest';
import { ensureG2pLoaded, isG2pReady, g2pAvailable, wordToPhonemesSync } from '../src/lipsync/g2p/g2p-en';

describe('G2P EN (CMUdict + reguły)', () => {
  beforeAll(async () => {
    await ensureG2pLoaded();
  });

  it('ładuje leksykon CMUdict', () => {
    expect(isG2pReady()).toBe(true);
    expect(g2pAvailable()).toBe(true);
  });

  it('mapuje znane słowa na fonemy ARPAbet (litery nieme znikają)', () => {
    expect(wordToPhonemesSync('know')).toEqual(['N', 'OW']); // K nieme
    expect(wordToPhonemesSync('though')).toEqual(['DH', 'OW']); // GH nieme
    expect(wordToPhonemesSync('team')).toEqual(['T', 'IY', 'M']); // EA -> IY (jeden fonem)
    expect(wordToPhonemesSync('what')).toEqual(['W', 'AH', 'T']);
  });

  it('mapuje słowa z wieloma fonemami i afrykatami', () => {
    expect(wordToPhonemesSync('question')).toEqual(['K', 'W', 'EH', 'S', 'CH', 'AH', 'N']);
    expect(wordToPhonemesSync('nation')).toEqual(['N', 'EY', 'SH', 'AH', 'N']);
    expect(wordToPhonemesSync('about')).toEqual(['AH', 'B', 'AW', 'T']);
  });

  it('usuwa cyfry stresu ze wszystkich fonemów', () => {
    for (const w of ['know', 'though', 'question', 'team', 'about', 'nation', 'what']) {
      const phonemes = wordToPhonemesSync(w);
      expect(phonemes).not.toBeNull();
      for (const p of phonemes!) {
        expect(p).not.toMatch(/\d/);
      }
    }
  });

  it('fallback regułowy dla słów spoza leksykonu (OOV)', () => {
    const result = wordToPhonemesSync('zzzqqq');
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(0);
  });

  it('zwraca null dla pustego wejścia', () => {
    expect(wordToPhonemesSync('')).toBeNull();
    expect(wordToPhonemesSync('!!!')).toBeNull();
  });
});
