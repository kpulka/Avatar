import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  mapPhonemeToShapes,
  lipPoseToShapes,
  PHONEME_POSES,
  DIPHTHONG_END_POSES,
} from '../src/lipsync/g2p/phoneme-visemes';
import { ANIM_DEFAULTS } from '../src/lipsync/anim-config';
import { VisemeScheduler } from '../src/lipsync/viseme-scheduler';
import { CALIBRATION_PRESETS } from '../src/lipsync/calibration';
import { defined } from './helpers/defined';

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

  it('F/V: clear tucked-under lower lip (distinguishable from M)', () => {
    for (const p of ['F', 'V']) {
      const m = mapPhonemeToShapes(p)!;
      expect(m.get('mouthRollLower')).toBeGreaterThan(0.5);
    }
  });

  it('OW has rounding (pucker); AA has a wide opening without pucker (distinguishable)', () => {
    expect(mapPhonemeToShapes('OW')!.has('mouthPucker')).toBe(true);
    const aa = mapPhonemeToShapes('AA')!;
    expect(aa.get('jawOpen')).toBeGreaterThan(0.4);
    expect(aa.has('mouthPucker')).toBe(false);
  });

  it('symmetric keys are applied to both Left and Right', () => {
    const m = mapPhonemeToShapes('M')!;
    expect(m.get('mouthPressLeft')).toBe(0.58);
    expect(m.get('mouthPressRight')).toBe(0.58);

    const e = mapPhonemeToShapes('EH')!;
    expect(e.get('mouthSmileLeft')).toBe(0.24);
    expect(e.get('mouthSmileRight')).toBe(0.24);
  });

  it('distinguishing the "twins" and "little detail" cases (v1.3): EY has teeth > EH; AA/SZ have lower teeth', () => {
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

  it('unknown phoneme -> null', () => {
    expect(mapPhonemeToShapes('XYZ')).toBeNull();
    expect(mapPhonemeToShapes('')).toBeNull();
    expect(mapPhonemeToShapes('constructor')).toBeNull(); // not an own key of the table
  });
});

// ---------------------------------------------------------------------------------------------
// Phase 17 (17-02): the table is the single source of truth
// ---------------------------------------------------------------------------------------------

const snapshot = JSON.parse(
  readFileSync(new URL('./fixtures/phoneme-poses-snapshot.json', import.meta.url), 'utf8'),
) as { poses: Record<string, Record<string, number>> };

describe('PHONEME_POSES single source of truth (LIP-04)', () => {
  it('has exactly the 39 ARPAbet keys of the committed snapshot', () => {
    expect(Object.keys(PHONEME_POSES).sort()).toEqual(Object.keys(snapshot.poses).sort());
    expect(Object.keys(snapshot.poses)).toHaveLength(39);
  });

  it('mapPhonemeToShapes output is unchanged for every key (regression snapshot)', () => {
    for (const [phoneme, expected] of Object.entries(snapshot.poses)) {
      const shapes = mapPhonemeToShapes(phoneme)!;
      expect(Object.fromEntries([...shapes.entries()].sort(([a], [b]) => (a < b ? -1 : 1))), phoneme).toEqual(expected);
    }
  });

  it('P, B and M share one bilabial pose', () => {
    expect(PHONEME_POSES.P).toBe(PHONEME_POSES.M);
    expect(PHONEME_POSES.B).toBe(PHONEME_POSES.M);
  });

  it('diphthong glide targets exist in the table (AY -> IH, AW -> UH)', () => {
    expect(DIPHTHONG_END_POSES).toEqual({ AY: 'IH', AW: 'UH' });
    for (const end of Object.values(DIPHTHONG_END_POSES)) expect(PHONEME_POSES[end]).toBeDefined();
  });

  it('every pose uses only shapes the speech subset can drive (jaw/mouth/tongue)', () => {
    for (const [phoneme, pose] of Object.entries(PHONEME_POSES)) {
      for (const shape of lipPoseToShapes(pose).keys()) {
        expect(/^(jawOpen|mouth|tongueOut)/.test(shape), `${phoneme}: ${shape}`).toBe(true);
      }
    }
  });
});

describe('perceived bilabial closure, computed from the table (LIP-04 / T-10)', () => {
  const cap = ANIM_DEFAULTS.common.mouthCloseCap;

  /** effective = table value x profile scale; close/press scale is min(closeScale, cap). */
  function computedEffective(phoneme: string, closeScale: number) {
    const pose = defined(PHONEME_POSES[phoneme]);
    const closeFactor = Math.min(closeScale, cap);
    return {
      jaw: (pose.jaw ?? 0) * 1.0,
      close: (pose.close ?? 0) * closeFactor,
      press: (pose.press ?? 0) * closeFactor,
    };
  }

  it('M/B/P under balanced: mouthClose <= 0.35, mouthPress >= 0.3, jawOpen <= 0.05', () => {
    const closeScale = CALIBRATION_PRESETS.balanced.closeScale;
    for (const p of ['M', 'B', 'P']) {
      const e = computedEffective(p, closeScale);
      expect(e.close, `${p} close`).toBeLessThanOrEqual(0.35);
      expect(e.press, `${p} press`).toBeGreaterThanOrEqual(0.3);
      expect(e.jaw, `${p} jaw`).toBeLessThanOrEqual(0.05);
    }
  });

  it('the roll-in lips complete the closure (rollLower and rollUpper present and unscaled by closeScale)', () => {
    const pose = defined(PHONEME_POSES.M);
    expect(pose.rollLower ?? 0).toBeGreaterThanOrEqual(0.2);
    expect(pose.rollUpper ?? 0).toBeGreaterThanOrEqual(0.1);
  });

  it('the computation agrees with what the scheduler actually renders', () => {
    for (const preset of ['subtle', 'balanced', 'expressive'] as const) {
      const computed = computedEffective('M', CALIBRATION_PRESETS[preset].closeScale);
      const rendered = effectivePose('M', preset);
      expect(rendered.get('mouthClose')!).toBeCloseTo(computed.close, 2);
      expect(rendered.get('mouthPressLeft')!).toBeCloseTo(computed.press, 2);
    }
  });

  it('the cap limits the scale: a 1.2 slider never exceeds the 0.85 ceiling on mouthClose', () => {
    const e = computedEffective('M', 1.2);
    expect(e.close).toBeCloseTo(defined(PHONEME_POSES.M).close! * cap, 6);
    expect(e.close).toBeLessThanOrEqual(defined(PHONEME_POSES.M).close! * cap + 1e-9);
  });
});
