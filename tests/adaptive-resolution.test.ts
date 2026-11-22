import { describe, it, expect } from 'vitest';
import { AdaptiveResolution } from '../src/core/adaptive-resolution';

/** Feeds `fps` samples every 500 ms from `startMs` for `durationMs`; returns every change as [time, ratio]. */
function feed(gov: AdaptiveResolution, fps: number, startMs: number, durationMs: number): Array<[number, number]> {
  const changes: Array<[number, number]> = [];
  for (let t = startMs; t <= startMs + durationMs; t += 500) {
    const next = gov.update(fps, t);
    if (next !== null) changes.push([t, next]);
  }
  return changes;
}

describe('AdaptiveResolution', () => {
  it('drops the ratio by 0.25 after 2 s below 50 FPS', () => {
    const gov = AdaptiveResolution.create(2);
    const changes = feed(gov, 40, 0, 2000);
    expect(changes).toEqual([[2000, 1.75]]);
    expect(gov.current).toBe(1.75);
  });

  it('does not change again during the 3 s hold', () => {
    const gov = AdaptiveResolution.create(2);
    feed(gov, 40, 0, 2000); // change at 2000, hold until 5000
    expect(feed(gov, 40, 2500, 2000)).toEqual([]); // samples at 2500..4500
    expect(gov.current).toBe(1.75);
  });

  it('never goes below the 1.0 floor', () => {
    const gov = AdaptiveResolution.create(2);
    feed(gov, 20, 0, 60000);
    expect(gov.current).toBe(1);
  });

  it('raises the ratio by 0.25 after 4 s above 58 FPS, never above max', () => {
    const gov = AdaptiveResolution.create(2);
    feed(gov, 40, 0, 2000); // -> 1.75, hold until 5000
    const changes = feed(gov, 60, 2500, 20000);
    // first sample after the hold is 5000; 4 s of sustained high FPS later (9000) the ratio rises once
    expect(changes).toEqual([[9000, 2]]);
    expect(gov.current).toBe(2);
  });

  it('ignores a single slow sample among good ones', () => {
    const gov = AdaptiveResolution.create(2);
    const changes: Array<[number, number]> = [];
    for (let t = 0; t <= 10000; t += 500) {
      const next = gov.update(t === 4000 ? 45 : 60, t);
      if (next !== null) changes.push([t, next]);
    }
    expect(changes).toEqual([]);
    expect(gov.current).toBe(2);
  });

  it('keeps a mixed 50-58 FPS band stable', () => {
    const gov = AdaptiveResolution.create(2);
    expect(feed(gov, 54, 0, 20000)).toEqual([]);
  });

  it('steps up and down in 0.25 increments within the configured range', () => {
    const gov = AdaptiveResolution.create(1.5);
    feed(gov, 30, 0, 2000);
    expect(gov.current).toBe(1.25);
    feed(gov, 30, 5000, 2000);
    expect(gov.current).toBe(1);
  });
});
