import { describe, it, expect } from 'vitest';
import { mapPhonemeToShapes } from '../src/lipsync/g2p/phoneme-visemes';
import { VisemeScheduler } from '../src/lipsync/viseme-scheduler';
import { CALIBRATION_PRESETS } from '../src/lipsync/calibration';

const SPEECH_SHAPES = [
  'jawOpen',
  'mouthClose',
  'mouthPressLeft',
  'mouthPressRight',
  'mouthRollLower',
  'mouthRollUpper',
];

/** Effective pose = table x preset scale applied by the scheduler, converged in the hold phase. */
function effectivePose(phoneme: string, preset: 'subtle' | 'balanced' | 'expressive' = 'balanced'): Map<string, number> {
  const scheduler = new VisemeScheduler({ calibrationProfile: CALIBRATION_PRESETS[preset] });
  scheduler.enqueue({
    epoch: 0,
    char: phoneme,
    shapes: mapPhonemeToShapes(phoneme)!,
    startTimeSec: 1.0,
    durationSec: 2.0,
  });
  let out = new Map<string, number>();
  for (let i = 0; i < 60; i++) out = scheduler.update(2.0, 0.016, 0, SPEECH_SHAPES);
  return out;
}

describe('mapPhonemeToShapes (ARPAbet → ARKit)', () => {
  it('M/B/P: closure built from press + roll with a low mouthClose and jaw ~0 (MetaPerson-safe)', () => {
    for (const p of ['M', 'B', 'P']) {
      const m = mapPhonemeToShapes(p);
      expect(m).not.toBeNull();
      expect(m!.has('mouthPressLeft')).toBe(true);
      expect(m!.has('mouthRollLower')).toBe(true);
      expect(m!.has('mouthRollUpper')).toBe(true);
      expect(m!.get('mouthClose')!).toBeLessThanOrEqual(0.5);
    }
  });

  it('M/B/P effective pose under the balanced preset (SHOW-06)', () => {
    for (const p of ['M', 'B', 'P']) {
      const e = effectivePose(p);
      expect(e.get('jawOpen') ?? 0).toBeLessThanOrEqual(0.03);
      expect(e.get('mouthPressLeft')!).toBeGreaterThanOrEqual(0.3);
      expect(e.get('mouthPressLeft')!).toBeLessThanOrEqual(0.4);
      expect(e.get('mouthPressRight')).toBeCloseTo(e.get('mouthPressLeft')!, 6);
      expect(e.get('mouthRollLower')!).toBeCloseTo(0.25, 2);
      expect(e.get('mouthRollUpper')!).toBeCloseTo(0.15, 2);
      expect(e.get('mouthClose')!).toBeLessThanOrEqual(0.35);
    }
  });

  it('M effective mouthClose stays below the lip-over-nose range for every preset', () => {
    for (const preset of ['subtle', 'balanced', 'expressive'] as const) {
      expect(effectivePose('M', preset).get('mouthClose')!).toBeLessThanOrEqual(0.36);
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
    expect(m.get('mouthPressLeft')).toBe(0.58);
    expect(m.get('mouthPressRight')).toBe(0.58);

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
