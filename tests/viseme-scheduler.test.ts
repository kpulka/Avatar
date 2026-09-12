import { describe, it, expect } from 'vitest';
import { VisemeScheduler } from '../src/lipsync/viseme-scheduler';

describe('VisemeScheduler & Coarticulation', () => {
  it('computes cosine easing correctly across blend-in, hold and blend-out phases', () => {
    const scheduler = new VisemeScheduler({ blendInSec: 0.04, blendOutSec: 0.05 });
    const duration = 0.1; // 100ms

    // Przed blend-in
    expect(scheduler.computeEasing(-0.04, duration)).toBeCloseTo(0.0);
    // W połowie blend-in
    expect(scheduler.computeEasing(-0.02, duration)).toBeGreaterThan(0.5);
    // W trakcie hold
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
    // Update w czasie gdy oba fonemy są w fazie hold
    const updated = scheduler.update(1.05, 0.016, 0, shapes);

    expect(updated.get('mouthPucker')).toBeLessThanOrEqual(1.0);
    expect(updated.get('mouthPucker')).toBeGreaterThan(0.0);
  });

  it('enforces mouthClose priority over jawOpen (LIPS-02)', () => {
    const scheduler = new VisemeScheduler();
    scheduler.setCalibrationProfile({ closeScale: 1.0 }); // mechanika schedulera, nie kalibracja
    const mShapes = new Map([
      ['mouthClose', 1.0],
      ['jawOpen', 0.5], // np. z koartykulacji z sąsiednią samogłoską
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

    // Nowa semantyka (LIPS-06): mouthClose = tabela (1.0) x closeScale (1.0), ale twardy sufit
    // bezpieczeństwa MetaPerson ogranicza efektywne domknięcie do CLOSE_SAFETY_CAP = 0.85.
    // jawOpen powinno być mocno wytłumione przez obecność mouthClose: 1.0.
    expect(updated.get('mouthClose')).toBeGreaterThan(0.8);
    expect(updated.get('jawOpen')).toBeLessThan(0.15);
  });

  it('applies single attenuation only: A (jawOpen 0.55) reaches > 0.5 in hold (LIPS-06)', () => {
    // Stara semantyka: 0.55 x naturalScale(0.60) x jawScale(0.55) ~= 0.18-0.30 (płasko).
    // Nowa: tabela = wartość efektywna, mnożona DOKŁADNIE RAZ przez jawScale (1.0).
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

    // Jedna klatka hold z dt=0.1: alpha jaw (cs 18 x 1.55) ~= 0.94 -> waga ~0.52
    scheduler.update(1.05, 0.1, 0, ['jawOpen', 'mouthSmileLeft', 'mouthSmileRight']);

    expect(scheduler.getWeight('jawOpen')).toBeGreaterThan(0.5);
  });

  it('full lip closure: mouthClose 1.0 reaches >= 0.8 in hold within ~5 frames (LIPS-02, cap 0.85)', () => {
    const scheduler = new VisemeScheduler();
    scheduler.setCalibrationProfile({ closeScale: 1.0 }); // mechanika schedulera, nie kalibracja
    scheduler.enqueue({
      epoch: 0,
      char: 'm',
      shapes: new Map([['mouthClose', 1.0]]),
      startTimeSec: 1.0,
      durationSec: 0.1,
    });

    // Tier domknięcia: cs 30 x 1.7 = 51 [1/s] -> szybko do sufitu bezpieczeństwa 0.85.
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

    // W trakcie dźwięku
    for (let t = 1.0; t <= 1.05; t += 0.016) {
      scheduler.update(t, 0.016, 0, ['jawOpen']);
    }
    expect(scheduler.getWeight('jawOpen')).toBeGreaterThan(0.3);

    // Po zakończeniu dźwięku (czas > 1.2s)
    for (let t = 1.06; t <= 1.5; t += 0.016) {
      scheduler.update(t, 0.016, 0, ['jawOpen']);
    }

    expect(scheduler.getWeight('jawOpen')).toBe(0.0);
  });
});
