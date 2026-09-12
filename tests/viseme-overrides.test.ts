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

describe('Edytor Wizemów — nadpisania (viseme-overrides)', () => {
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

  it('zapisuje i odczytuje nadpisania (round-trip)', () => {
    saveVisemeOverrides({ M: { mouthClose: 0.5, mouthPressLeft: 0.1 } });
    expect(loadVisemeOverrides()).toEqual({ M: { mouthClose: 0.5, mouthPressLeft: 0.1 } });
  });

  it('clearVisemeOverrides czyści zapis', () => {
    saveVisemeOverrides({ M: { mouthClose: 0.5 } });
    clearVisemeOverrides();
    expect(loadVisemeOverrides()).toEqual({});
  });

  it('defaultVisemeShapes: fonem M -> mouthClose 0.8; char A -> jawOpen 0.55', () => {
    expect(defaultVisemeShapes('M')?.get('mouthClose')).toBe(0.8);
    expect(defaultVisemeShapes('A')?.get('jawOpen')).toBeCloseTo(0.55);
  });

  it('precedencja fonem nad tokenem znakowym dla kluczy wspólnych (TH)', () => {
    // 'TH' istnieje w ARPAbet (phoneme) i jako dwuznak — dla podglądu wygrywa fonem.
    const th = defaultVisemeShapes('TH');
    expect(th?.has('tongueOut')).toBe(true);
  });

  it('charTokenFor: dwuznak SH, litera A, null dla spacji/interpunkcji', () => {
    expect(charTokenFor(['s', 'h', 'i', 'p'], 0)).toBe('SH');
    expect(charTokenFor(['a', 'b'], 0)).toBe('A');
    expect(charTokenFor([' ', 'x'], 0)).toBeNull();
    expect(charTokenFor(['.', 'x'], 0)).toBeNull();
    expect(charTokenFor(['a', 'b'], 1)).toBe('B');
  });

  it('charDefaultShapesForToken zgadza się z mapCharToShapes (brak kontekstu C)', () => {
    // 'SZ' -> dwuznak tunel
    expect(mapCharToShapes(['s', 'z', 'y'], 0)?.get('mouthFunnel')).toBeCloseTo(0.6);
    expect(charDefaultShapesForToken('SZ')?.get('mouthFunnel')).toBeCloseTo(0.6);
    // 'C' bez kontekstu -> twarde K (jawOpen 0.35)
    expect(charDefaultShapesForToken('C')?.get('jawOpen')).toBeCloseTo(0.35);
  });

  it('isEditableViseme: znane głoski true, spacja/nieznane false', () => {
    expect(isEditableViseme('M')).toBe(true);
    expect(isEditableViseme('AA')).toBe(true);
    expect(isEditableViseme(' ')).toBe(false);
  });

  it('charTokenFor jest eksportowane (tożsamość z funkcją z viseme-mappings)', () => {
    expect(charTokenFn).toBeTypeOf('function');
    expect(charTokenFn(['s', 'h'], 0)).toBe('SH');
  });
});
