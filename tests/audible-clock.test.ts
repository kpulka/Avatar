import { describe, it, expect } from 'vitest';
import { getAudibleTime, createAudibleClock } from '../src/audio/audible-clock';

type FakeCtx = Partial<AudioContext> & { currentTime: number };
const asCtx = (c: FakeCtx): AudioContext => c as unknown as AudioContext;

describe('getAudibleTime', () => {
  it('extrapolates getOutputTimestamp to "now"', () => {
    const ctx = asCtx({
      currentTime: 10.2,
      getOutputTimestamp: () => ({ contextTime: 10, performanceTime: 1000 }),
    });
    expect(getAudibleTime(ctx, 1050)).toBeCloseTo(10.05, 6);
  });

  it('never extrapolates beyond the render position', () => {
    const ctx = asCtx({
      currentTime: 10.1,
      getOutputTimestamp: () => ({ contextTime: 10, performanceTime: 1000 }),
    });
    expect(getAudibleTime(ctx, 1500)).toBeCloseTo(10.1, 6);
  });

  it('falls back to currentTime - outputLatency - baseLatency without getOutputTimestamp', () => {
    const ctx = asCtx({ currentTime: 5, outputLatency: 0.15, baseLatency: 0.01 });
    expect(getAudibleTime(ctx)).toBeCloseTo(4.84, 6);
  });

  it('handles Safari-like contexts (outputLatency undefined)', () => {
    const ctx = asCtx({ currentTime: 5, baseLatency: 0.02 });
    expect(getAudibleTime(ctx)).toBeCloseTo(4.98, 6);
  });
});

describe('createAudibleClock', () => {
  it('is monotonic when the underlying time jitters backwards', () => {
    const fake: FakeCtx = { currentTime: 5.0 };
    const clock = createAudibleClock(asCtx(fake));
    expect(clock()).toBeCloseTo(5.0, 6);
    fake.currentTime = 4.99;
    expect(clock()).toBeCloseTo(5.0, 6);
    fake.currentTime = 5.2;
    expect(clock()).toBeCloseTo(5.2, 6);
  });
});
