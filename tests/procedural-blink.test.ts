import { describe, it, expect } from 'vitest';
import { ProceduralBlink } from '../src/lipsync/procedural-blink';

describe('ProceduralBlink', () => {
  it('reaches maximum closure (~1.0) at 80ms and reopens smoothly to 0 at 280ms', () => {
    const blink = new ProceduralBlink({
      closeDurationSec: 0.08,
      openDurationSec: 0.2,
    });

    // Wymuś mrugnięcie w t = 10.0s
    blink.forceBlink(10.0);

    // t = 10.0s (start mrugnięcia)
    const start = blink.update(10.0);
    expect(start.left).toBeCloseTo(0.0);

    // t = 10.08s (szczyt zamknięcia - 80ms)
    const apex = blink.update(10.08);
    expect(apex.left).toBeCloseTo(1.0, 1);
    expect(apex.right).toBeCloseTo(0.98, 1);

    // t = 10.18s (w połowie otwierania - 180ms od startu)
    const midOpen = blink.update(10.18);
    expect(midOpen.left).toBeGreaterThan(0.4);
    expect(midOpen.left).toBeLessThan(0.9);

    // t = 10.28s (koniec mrugnięcia - 280ms od startu)
    const finished = blink.update(10.28);
    expect(finished.left).toBeCloseTo(0.0);
    expect(finished.right).toBeCloseTo(0.0);
  });

  it('triggers naturally when current time exceeds scheduled time', () => {
    const blink = new ProceduralBlink({
      minIntervalSec: 3.0,
      maxIntervalSec: 3.0, // stały czas dla testu
    });

    blink.scheduleNextBlink(0);

    // t = 1.0s (przed czasem)
    expect(blink.update(1.0).left).toBe(0.0);

    // t = 3.01s (czas nadszedł, rozpoczęcie mrugnięcia)
    blink.update(3.01);
    // t = 3.04s (30ms po starcie, faza zamykania w toku)
    const active = blink.update(3.04);
    expect(active.left).toBeGreaterThan(0.0);
  });
});
