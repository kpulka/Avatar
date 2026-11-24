import { describe, it, expect } from 'vitest';
import { VisemeScheduler } from '../src/lipsync/viseme-scheduler';
import { mapPhonemeToShapes } from '../src/lipsync/g2p/phoneme-visemes';

describe('VisemeScheduler & Coarticulation', () => {
  it('computes cosine easing correctly across blend-in, hold and blend-out phases', () => {
    const scheduler = new VisemeScheduler({ blendInSec: 0.04, blendOutSec: 0.05 });
    const duration = 0.1; // 100ms

    // Before the blend-in
    expect(scheduler.computeEasing(-0.04, duration)).toBeCloseTo(0.0);
    // Halfway through the blend-in
    expect(scheduler.computeEasing(-0.02, duration)).toBeGreaterThan(0.5);
    // During hold
    expect(scheduler.computeEasing(0.0, duration)).toBeCloseTo(1.0);
    expect(scheduler.computeEasing(0.05, duration)).toBeCloseTo(1.0);
    expect(scheduler.computeEasing(0.1, duration)).toBeCloseTo(1.0);
    // W trakcie blend-out
    expect(scheduler.computeEasing(0.125, duration)).toBeLessThan(1.0);
    expect(scheduler.computeEasing(0.15, duration)).toBeCloseTo(0.0);
  });

  it('clamps additive blending at 1.0 for overlapping phonemes', () => {
    const scheduler = new VisemeScheduler();
    const shapes1 = new Map([['mouthPucker', 0.7]]);
    const shapes2 = new Map([['mouthPucker', 0.6]]);

    scheduler.enqueue({
      epoch: 0,
      char: 'o',
      shapes: shapes1,
      startTimeSec: 1.0,
      durationSec: 0.1,
    });
    scheduler.enqueue({
      epoch: 0,
      char: 'u',
      shapes: shapes2,
      startTimeSec: 1.02,
      durationSec: 0.1,
    });

    const shapes = ['mouthPucker', 'jawOpen'];
    // Update while both phonemes are in the hold phase
    const updated = scheduler.update(1.05, 0.016, 0, shapes);

    expect(updated.get('mouthPucker')).toBeLessThanOrEqual(1.0);
    expect(updated.get('mouthPucker')).toBeGreaterThan(0.0);
  });

  it('enforces mouthClose priority over jawOpen (LIPS-02)', () => {
    const scheduler = new VisemeScheduler();
    scheduler.setCalibrationProfile({ closeScale: 1.0 }); // scheduler mechanics, not calibration
    const mShapes = new Map([
      ['mouthClose', 1.0],
      ['jawOpen', 0.5], // e.g. from coarticulation with an adjacent vowel
    ]);

    scheduler.enqueue({
      epoch: 0,
      char: 'm',
      shapes: mShapes,
      startTimeSec: 1.0,
      durationSec: 0.1,
    });

    // Kilka klatek aktualizacji
    let updated = new Map();
    for (let i = 0; i < 10; i++) {
      updated = scheduler.update(1.05, 0.016, 0, ['mouthClose', 'jawOpen']);
    }

    // New semantics (LIPS-06): mouthClose = table (1.0) x closeScale (1.0), but a hard ceiling
    // the MetaPerson safety limit caps the effective closure at CLOSE_SAFETY_CAP = 0.85.
    // jawOpen should be strongly damped by the presence of mouthClose: 1.0.
    expect(updated.get('mouthClose')).toBeGreaterThan(0.8);
    expect(updated.get('jawOpen')).toBeLessThan(0.15);
  });

  it('bilabial press suppresses jaw left over from the previous vowel (SHOW-06)', () => {
    const scheduler = new VisemeScheduler(); // balanced
    const shapes = ['jawOpen', 'mouthClose', 'mouthPressLeft', 'mouthPressRight'];
    // "A" (jawOpen 0.4) is still sounding (overlaps) while "M" (low close + press, jaw ~0) holds.
    scheduler.enqueue({
      epoch: 0,
      char: 'A',
      shapes: new Map([['jawOpen', 0.4]]),
      startTimeSec: 1.0,
      durationSec: 1.0,
    });
    scheduler.enqueue({
      epoch: 0,
      char: 'M',
      shapes: mapPhonemeToShapes('M')!,
      startTimeSec: 1.2,
      durationSec: 0.6,
    });

    // Vowel holds first: jaw opens.
    let updated = new Map<string, number>();
    for (let i = 0; i < 10; i++) updated = scheduler.update(1.1, 0.016, 0, shapes);
    expect(updated.get('jawOpen')!).toBeGreaterThan(0.3);

    // M in its hold while the vowel is still active: jaw must be pushed shut by the press.
    for (let i = 0; i < 20; i++) updated = scheduler.update(1.5, 0.016, 0, shapes);
    expect(updated.get('jawOpen')!).toBeLessThan(0.05);
    expect(updated.get('mouthPressLeft')!).toBeGreaterThan(0.3);
  });

  it('applies single attenuation only: A (jawOpen 0.55) reaches > 0.5 in hold (LIPS-06)', () => {
    // Old semantics: 0.55 x naturalScale(0.60) x jawScale(0.55) ~= 0.18-0.30 (flat).
    // New: the table is the effective value, multiplied by jawScale EXACTLY ONCE (1.0).
    const scheduler = new VisemeScheduler();
    scheduler.enqueue({
      epoch: 0,
      char: 'a',
      shapes: new Map([
        ['jawOpen', 0.55],
        ['mouthSmileLeft', 0.1],
        ['mouthSmileRight', 0.1],
      ]),
      startTimeSec: 1.0,
      durationSec: 0.1,
    });

    // One hold frame with dt=0.1: jaw alpha (cs 18 x 1.55) ~= 0.94 -> weight ~0.52
    scheduler.update(1.05, 0.1, 0, ['jawOpen', 'mouthSmileLeft', 'mouthSmileRight']);

    expect(scheduler.getWeight('jawOpen')).toBeGreaterThan(0.5);
  });

  it('full lip closure: mouthClose 1.0 reaches >= 0.8 in hold within ~5 frames (LIPS-02, cap 0.85)', () => {
    const scheduler = new VisemeScheduler();
    scheduler.setCalibrationProfile({ closeScale: 1.0 }); // scheduler mechanics, not calibration
    scheduler.enqueue({
      epoch: 0,
      char: 'm',
      shapes: new Map([['mouthClose', 1.0]]),
      startTimeSec: 1.0,
      durationSec: 0.1,
    });

    // Closure tier: cs 30 x 1.7 = 51 [1/s] -> quickly up to the safety ceiling 0.85.
    for (let i = 0; i < 5; i++) {
      scheduler.update(1.05, 0.016, 0, ['mouthClose']);
    }

    expect(scheduler.getWeight('mouthClose')).toBeGreaterThanOrEqual(0.8);
  });

  it('jaw converges faster than smile after a single dt=0.016 frame (per-shape lambda)', () => {
    const scheduler = new VisemeScheduler();
    const jawItem = {
      epoch: 0,
      char: 'x',
      shapes: new Map([['jawOpen', 0.5]]),
      startTimeSec: 1.0,
      durationSec: 0.1,
    };
    const smileItem = {
      epoch: 0,
      char: 'y',
      shapes: new Map([['mouthSmileLeft', 0.5]]),
      startTimeSec: 1.0,
      durationSec: 0.1,
    };
    scheduler.enqueue(jawItem);
    scheduler.enqueue(smileItem);

    // Po JEDNEJ klatce dt=0.016: alpha jaw (18 x 1.55) > alpha smile (18 x 0.45)
    scheduler.update(1.05, 0.016, 0, ['jawOpen', 'mouthSmileLeft']);

    const jawRatio = scheduler.getWeight('jawOpen') / 0.5;
    const smileRatio = scheduler.getWeight('mouthSmileLeft') / 0.5;
    expect(jawRatio).toBeGreaterThan(smileRatio);
  });

  it('strictly decays to 0 after sounds end (Foundation Rule)', () => {
    const scheduler = new VisemeScheduler();
    scheduler.enqueue({
      epoch: 0,
      char: 'a',
      shapes: new Map([['jawOpen', 0.8]]),
      startTimeSec: 1.0,
      durationSec: 0.05,
    });

    // During the audio
    for (let t = 1.0; t <= 1.05; t += 0.016) {
      scheduler.update(t, 0.016, 0, ['jawOpen']);
    }
    expect(scheduler.getWeight('jawOpen')).toBeGreaterThan(0.3);

    // After the audio ends (time > 1.2s)
    for (let t = 1.06; t <= 1.5; t += 0.016) {
      scheduler.update(t, 0.016, 0, ['jawOpen']);
    }

    expect(scheduler.getWeight('jawOpen')).toBe(0.0);
  });
});
