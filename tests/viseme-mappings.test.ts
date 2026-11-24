import { describe, it, expect } from 'vitest';
import { mapCharToShapes, charPathSpan } from '../src/lipsync/viseme-mappings';

describe('Viseme Mappings (EN & ARKit)', () => {
  it('detects and maps digraphs with lookahead', () => {
    const shChars = ['s', 'h', 'e'];
    const shShapes = mapCharToShapes(shChars, 0);
    expect(shShapes.get('mouthFunnel')).toBeCloseTo(0.5);
    expect(shShapes.get('jawOpen')).toBeCloseTo(0.2);

    const chChars = ['c', 'h', 'a', 't'];
    const chShapes = mapCharToShapes(chChars, 0);
    expect(chShapes.get('mouthFunnel')).toBeCloseTo(0.45);

    const quChars = ['q', 'u', 'i', 'c', 'k'];
    const quShapes = mapCharToShapes(quChars, 0);
    expect(quShapes.get('mouthPucker')).toBeCloseTo(0.5);
    expect(quShapes.get('jawOpen')).toBeCloseTo(0.35);
  });

  it('enforces full lip closure mouthClose: 1.0 for M, B, P (LIPS-02)', () => {
    const mShapes = mapCharToShapes(['m', 'o', 'm'], 0);
    expect(mShapes.get('mouthClose')).toBe(1.0);
    expect(mShapes.get('mouthPressLeft')).toBeCloseTo(0.15);

    const bShapes = mapCharToShapes(['b', 'a', 'b', 'y'], 0);
    expect(bShapes.get('mouthClose')).toBe(1.0);

    const pShapes = mapCharToShapes(['p', 'o', 'p'], 0);
    expect(pShapes.get('mouthClose')).toBe(1.0);
  });

  it('correctly applies contextual heuristic for letter C', () => {
    // Soft C before 'i' ("city") -> like S (mouthSmile, small jawOpen)
    const softC = mapCharToShapes(['c', 'i', 't', 'y'], 0);
    expect(softC.get('jawOpen')).toBeCloseTo(0.15);
    expect(softC.get('mouthSmileLeft')).toBeCloseTo(0.15);

    // Hard C before 'a' ("cat") -> like K (larger jawOpen 0.35)
    const hardC = mapCharToShapes(['c', 'a', 't'], 0);
    expect(hardC.get('jawOpen')).toBeCloseTo(0.35);
    expect(hardC.has('mouthSmileLeft')).toBe(false);
  });

  it('charPathSpan: a consonant digraph consumes two letters, everything else one (17-01)', () => {
    expect(charPathSpan(['t', 'h', 'e'], 0)).toBe(2);
    expect(charPathSpan(['t', 'h', 'e'], 1)).toBe(1); // the H itself is not a digraph start
    expect(charPathSpan(['s', 'h', 'i', 'p'], 0)).toBe(2);
    expect(charPathSpan(['s', 'i', 'n', 'g'], 2)).toBe(2); // ng
    expect(charPathSpan(['c', 'a', 't'], 0)).toBe(1);
    expect(charPathSpan([' ', 't'], 0)).toBe(1);
  });

  it('charPathSpan keeps the vowel of the soft-i digraphs (si/zi/ni/ci) as its own viseme', () => {
    expect(charPathSpan(['s', 'i', 't'], 0)).toBe(1);
    expect(charPathSpan(['n', 'i', 'c', 'e'], 0)).toBe(1);
  });

  it('maps vowels with proper jaw and mouth pucker', () => {
    const aShapes = mapCharToShapes(['a'], 0);
    expect(aShapes.get('jawOpen')).toBeCloseTo(0.55);

    const oShapes = mapCharToShapes(['o'], 0);
    expect(oShapes.get('mouthPucker')).toBeCloseTo(0.6);
    expect(oShapes.get('mouthFunnel')).toBeCloseTo(0.4);

    const uShapes = mapCharToShapes(['u'], 0);
    expect(uShapes.get('mouthPucker')).toBeCloseTo(0.75);
    expect(uShapes.get('jawOpen')).toBeCloseTo(0.25);
  });
});
