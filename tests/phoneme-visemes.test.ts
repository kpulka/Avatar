import { describe, it, expect } from 'vitest';
import { mapPhonemeToShapes } from '../src/lipsync/g2p/phoneme-visemes';

describe('mapPhonemeToShapes (ARPAbet → ARKit)', () => {
  it('M/B/P: mocne domknięcie mouthClose 0.8 + press 0.2, bez jawOpen (MetaPerson-safe)', () => {
    for (const p of ['M', 'B', 'P']) {
      const m = mapPhonemeToShapes(p);
      expect(m).not.toBeNull();
      expect(m!.get('mouthClose')).toBe(0.8);
      expect(m!.get('mouthPressLeft')).toBe(0.2);
      expect(m!.has('jawOpen')).toBe(false);
    }
  });

  it('F/V: wyraźna podwinięta dolna warga (odróżnialne od M)', () => {
    for (const p of ['F', 'V']) {
      const m = mapPhonemeToShapes(p)!;
      expect(m.get('mouthRollLower')).toBeGreaterThan(0.5);
    }
  });

  it('OW ma zaokrąglenie (pucker); AA ma szerokie otwarcie bez pucker (odróżnialne)', () => {
    expect(mapPhonemeToShapes('OW')!.has('mouthPucker')).toBe(true);
    const aa = mapPhonemeToShapes('AA')!;
    expect(aa.get('jawOpen')).toBeGreaterThan(0.4);
    expect(aa.has('mouthPucker')).toBe(false);
  });

  it('klucze symetryczne aplikowane do Left i Right', () => {
    const m = mapPhonemeToShapes('M')!;
    expect(m.get('mouthPressLeft')).toBe(0.2);
    expect(m.get('mouthPressRight')).toBe(0.2);

    const e = mapPhonemeToShapes('EH')!;
    expect(e.get('mouthSmileLeft')).toBe(0.24);
    expect(e.get('mouthSmileRight')).toBe(0.24);
  });

  it('rozróżnienie "bliźniaków" + "smaczek" (v1.3): EY ma zęby > EH; AA/SZ mają dolne zęby', () => {
    const ey = mapPhonemeToShapes('EY')!;
    const eh = mapPhonemeToShapes('EH')!;
    expect(ey.get('mouthUpperUpLeft')).toBe(0.14);
    expect(eh.has('mouthUpperUpLeft')).toBe(false);
    expect(ey.get('mouthSmileLeft')!).toBeGreaterThan(eh.get('mouthSmileLeft')!);

    const aa = mapPhonemeToShapes('AA')!;
    expect(aa.get('mouthLowerDownLeft')).toBe(0.15);

    const sz = mapPhonemeToShapes('S')!;
    expect(sz.get('mouthLowerDownLeft')).toBe(0.16);
    expect(sz.get('mouthLowerDownRight')).toBe(0.16);
  });

  it('nieznany fonem -> null', () => {
    expect(mapPhonemeToShapes('XYZ')).toBeNull();
    expect(mapPhonemeToShapes('')).toBeNull();
  });
});
