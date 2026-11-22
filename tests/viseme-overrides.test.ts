import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadVisemeOverrides,
  saveVisemeOverrides,
  clearVisemeOverrides,
  defaultVisemeShapes,
  charTokenFor,
  isEditableViseme,
} from '../src/lipsync/viseme-overrides';
import { charTokenFor as charTokenFn } from '../src/lipsync/viseme-overrides';
import { mapCharToShapes, charDefaultShapesForToken } from '../src/lipsync/viseme-mappings';

describe('Viseme editor — overrides (viseme-overrides)', () => {
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    for (const k in mockStorage) delete mockStorage[k];
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => mockStorage[k] ?? null,
      setItem: (k: string, v: string) => {
        mockStorage[k] = v;
      },
      removeItem: (k: string) => {
        delete mockStorage[k];
      },
      clear: () => {
        for (const k in mockStorage) delete mockStorage[k];
      },
    });
  });

  it('saves and reads overrides (round-trip)', () => {
    saveVisemeOverrides({ M: { mouthClose: 0.5, mouthPressLeft: 0.1 } });
    expect(loadVisemeOverrides()).toEqual({ M: { mouthClose: 0.5, mouthPressLeft: 0.1 } });
  });

  it('clearVisemeOverrides clears the saved data', () => {
    saveVisemeOverrides({ M: { mouthClose: 0.5 } });
    clearVisemeOverrides();
    expect(loadVisemeOverrides()).toEqual({});
  });

  it('defaultVisemeShapes: phoneme M -> mouthClose 0.5 (11.2 SHOW-06); char A -> jawOpen 0.55', () => {
    expect(defaultVisemeShapes('M')?.get('mouthClose')).toBe(0.5);
    expect(defaultVisemeShapes('A')?.get('jawOpen')).toBeCloseTo(0.55);
  });

  it('a phoneme takes precedence over a character token for shared keys (TH)', () => {
    // 'TH' exists in ARPAbet (phoneme) and as a digraph — for the preview the phoneme wins.
    const th = defaultVisemeShapes('TH');
    expect(th?.has('tongueOut')).toBe(true);
  });

  it('charTokenFor: digraph SH, letter A, null for space/punctuation', () => {
    expect(charTokenFor(['s', 'h', 'i', 'p'], 0)).toBe('SH');
    expect(charTokenFor(['a', 'b'], 0)).toBe('A');
    expect(charTokenFor([' ', 'x'], 0)).toBeNull();
    expect(charTokenFor(['.', 'x'], 0)).toBeNull();
    expect(charTokenFor(['a', 'b'], 1)).toBe('B');
  });

  it('charDefaultShapesForToken matches mapCharToShapes (no C context)', () => {
    // 'SZ' -> digraph (lip tube)
    expect(mapCharToShapes(['s', 'z', 'y'], 0)?.get('mouthFunnel')).toBeCloseTo(0.6);
    expect(charDefaultShapesForToken('SZ')?.get('mouthFunnel')).toBeCloseTo(0.6);
    // 'C' without context -> hard K (jawOpen 0.35)
    expect(charDefaultShapesForToken('C')?.get('jawOpen')).toBeCloseTo(0.35);
  });

  it('isEditableViseme: known sounds true, space/unknown false', () => {
    expect(isEditableViseme('M')).toBe(true);
    expect(isEditableViseme('AA')).toBe(true);
    expect(isEditableViseme(' ')).toBe(false);
  });

  it('charTokenFor is exported (identical to the function in viseme-mappings)', () => {
    expect(charTokenFn).toBeTypeOf('function');
    expect(charTokenFn(['s', 'h'], 0)).toBe('SH');
  });
});
