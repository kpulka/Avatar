import { describe, it, expect } from 'vitest';
import { FaceController } from '../src/lipsync/face-controller';
import { FaceDriver } from '../src/types/avatar';
import { AudioEngine } from '../src/audio/audio-engine';
import { CALIBRATION_PRESETS } from '../src/lipsync/calibration';
import { defaultVisemeShapes } from '../src/lipsync/viseme-overrides';
import { mapPhonemeToShapes } from '../src/lipsync/g2p/phoneme-visemes';
import { ANIM_DEFAULTS } from '../src/lipsync/anim-config';

class RecordingDriver implements FaceDriver {
  public applied: Record<string, number> = {};
  public applyTargets(): void {}
  public applyWeight(shape: string, weight: number): void {
    this.applied[shape] = weight;
  }
  public listAvailableShapes(): string[] {
    return [];
  }
  public getSpeechMeshes(): never[] {
    return [];
  }
  public getMorphTargetDictionary(): Record<string, number> {
    return {};
  }
}

const engine = { ctx: { currentTime: 0 }, getEpoch: () => 0, hasPendingAudio: () => false };

function build(preset: keyof typeof CALIBRATION_PRESETS): { controller: FaceController; driver: RecordingDriver } {
  const driver = new RecordingDriver();
  const controller = new FaceController(driver, engine as unknown as AudioEngine);
  controller.setCalibrationProfile(CALIBRATION_PRESETS[preset]);
  return { controller, driver };
}

/** Same scale policy as the scheduler (the Calibrator preview must match what speech renders). */
function scaleFor(shape: string, preset: keyof typeof CALIBRATION_PRESETS): number {
  const p = CALIBRATION_PRESETS[preset];
  if (shape === 'mouthClose' || shape.startsWith('mouthPress')) return Math.min(p.closeScale, ANIM_DEFAULTS.common.mouthCloseCap);
  if (shape === 'jawOpen') return p.jawScale;
  if (shape.startsWith('mouthSmile')) return p.smileScale;
  if (shape === 'mouthPucker') return p.puckerScale;
  if (shape === 'mouthFunnel') return p.funnelScale;
  if (shape === 'mouthRollLower' || shape.startsWith('mouthShrug')) return p.rollScale;
  if (shape.startsWith('mouthUpperUp') || shape.startsWith('mouthLowerDown')) return p.teethExposureScale;
  return 1;
}

describe('testPhoneme delegates to the viseme tables (17-02, 16-CONTEXT D-7)', () => {
  for (const key of ['A', 'E', 'O', 'U', 'M', 'SZ', 'F'] as const) {
    it(`${key}: every table shape is written with value x profile scale (no duplicated literals)`, () => {
      const { controller, driver } = build('expressive');
      controller.testPhoneme(key);
      const table = defaultVisemeShapes(key)!;
      expect(table.size).toBeGreaterThan(0);
      for (const [shape, value] of table.entries()) {
        if (shape === 'mouthClose') continue; // anatomical guard (jaw + margin) may lower it; covered below
        expect(driver.applied[shape], `${key}/${shape}`).toBeCloseTo(value * scaleFor(shape, 'expressive'), 6);
      }
    });
  }

  it('M reads the bilabial phoneme pose (jaw ~0, press + roll, low mouthClose) instead of its own literals', () => {
    expect(defaultVisemeShapes('M')).toEqual(mapPhonemeToShapes('M'));
    const { controller, driver } = build('balanced');
    controller.testPhoneme('M');
    expect(driver.applied['jawOpen']).toBeCloseTo(0.02, 6);
    expect(driver.applied['mouthPressLeft']).toBeCloseTo(0.58 * 0.6, 6);
    expect(driver.applied['mouthRollLower']).toBeCloseTo(0.25, 6);
    // guardClose keeps the lip off the nose: mouthClose <= jaw + 0.2 margin
    expect(driver.applied['mouthClose']).toBeLessThanOrEqual(0.02 + ANIM_DEFAULTS.manual.jawGuardMargin + 1e-9);
  });

  it('neutral still relaxes and the SPEAKING guard is untouched', () => {
    const { controller } = build('balanced');
    controller.testPhoneme('neutral');
    expect(controller.getState()).toBe('RELAXING');
  });
});
