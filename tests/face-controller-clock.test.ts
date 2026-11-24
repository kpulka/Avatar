import { describe, it, expect, beforeEach } from 'vitest';
import { FaceController } from '../src/lipsync/face-controller';
import { VisemeScheduler } from '../src/lipsync/viseme-scheduler';
import { FaceDriver } from '../src/types/avatar';
import { AudioEngine } from '../src/audio/audio-engine';

class RecordingDriver implements FaceDriver {
  public appliedWeights: Record<string, number> = {};
  public writes: Array<[string, number]> = [];
  public applyTargets(weights: Record<string, number>): void {
    Object.assign(this.appliedWeights, weights);
  }
  public applyWeight(shape: string, weight: number): void {
    this.appliedWeights[shape] = weight;
    this.writes.push([shape, weight]);
  }
  public listAvailableShapes(): string[] {
    return ['jawOpen', 'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthSmileLeft', 'mouthSmileRight', 'eyeBlinkLeft', 'eyeBlinkRight'];
  }
  public getSpeechMeshes(): never[] {
    return [];
  }
  public getMorphTargetDictionary(): Record<string, number> {
    return {};
  }
}

class MockAudioEngine {
  public epoch = 0;
  public ctx = { currentTime: 0 };
  public hasPending = true;
  public getEpoch(): number {
    return this.epoch;
  }
  public hasPendingAudio(): boolean {
    return this.hasPending;
  }
}

const CHUNK = { chars: ['a'], char_start_times_ms: [0], char_durations_ms: [2000] };

describe('FaceController clocks (16-03): injectable wall clock + audio clock', () => {
  let driver: RecordingDriver;
  let engine: MockAudioEngine;
  let controller: FaceController;
  let audible = 0;
  let wallMs = 0;

  /** Speaks until the jaw is open. A happy emotion keeps maxWeight above the early-finish epsilon,
   *  so completion is governed purely by the relax timer (what these tests measure). */
  function speak(): void {
    controller.setEmotion('happy');
    controller.onAudioChunk(CHUNK, 0, engine.epoch);
    audible = 0.5;
    for (let i = 0; i < 40; i++) controller.render(0.016);
    expect(controller.getState()).toBe('SPEAKING');
    expect(controller.getCurrentWeight('jawOpen')).toBeGreaterThan(0.05);
  }

  /** Advances the wall clock 1 ms at a time; returns the elapsed ms at which state becomes IDLE. */
  function msUntilIdle(limitMs = 1000): number {
    const start = wallMs;
    while (controller.getState() !== 'IDLE' && wallMs - start < limitMs) {
      wallMs += 1;
      controller.render(0.001);
    }
    return wallMs - start;
  }

  beforeEach(() => {
    audible = 0;
    wallMs = 1_000_000; // arbitrary non-zero origin: only differences may matter
    driver = new RecordingDriver();
    engine = new MockAudioEngine();
    controller = new FaceController(driver, engine as unknown as AudioEngine, {
      audibleClock: () => audible,
      nowMs: () => wallMs,
    });
    controller.setLipSyncEngine('char');
    controller.setCalibrationProfile({ syncOffsetMs: 0 });
  });

  it('(a) RELAXING completes exactly at the relax duration on the injected clock (150 ms)', () => {
    speak();
    controller.onInterruption();
    const elapsed = msUntilIdle();
    expect(elapsed).toBeGreaterThanOrEqual(149);
    expect(elapsed).toBeLessThanOrEqual(151);
  });

  it('(b) double interruption re-anchors the timer: interrupt at t=80 -> completes at 230, not 150', () => {
    speak();
    const t0 = wallMs;
    controller.onInterruption();
    wallMs = t0 + 80;
    controller.render(0.001);
    expect(controller.getState()).toBe('RELAXING');
    controller.onInterruption(); // re-anchor at t0 + 80

    const elapsedSinceReanchor = msUntilIdle();
    expect(elapsedSinceReanchor).toBeGreaterThanOrEqual(149);
    expect(elapsedSinceReanchor).toBeLessThanOrEqual(151);
    expect(wallMs - t0).toBeGreaterThanOrEqual(229);
    expect(wallMs - t0).toBeLessThanOrEqual(231);
  });

  it('the wall clock is independent of the audio clock (relax does not follow audio time)', () => {
    speak();
    controller.onInterruption();
    audible += 100; // audio clock jumps far ahead; wall clock unchanged
    controller.render(0.016);
    expect(controller.getState()).toBe('RELAXING');
    wallMs += 150;
    controller.render(0.016);
    expect(controller.getState()).toBe('IDLE');
  });

  it('(c) a chunk arriving mid-RELAXING resumes SPEAKING without a zero-write', () => {
    speak();
    controller.onInterruption();
    wallMs += 40;
    controller.render(0.016);
    expect(controller.getState()).toBe('RELAXING');

    const mark = driver.writes.length;
    controller.onAudioChunk(CHUNK, 0, engine.epoch);
    controller.render(0.016);
    expect(controller.getState()).toBe('SPEAKING');
    const jaw = driver.writes
      .slice(mark)
      .filter(([s]) => s === 'jawOpen')
      .map(([, w]) => w);
    expect(jaw.length).toBeGreaterThan(0);
    expect(jaw.every((w) => w > 0)).toBe(true);
  });
});

describe('damping is FPS independent (1 - exp(-lambda * dt))', () => {
  function weightAfter(steps: number, dt: number): number {
    const scheduler = new VisemeScheduler();
    scheduler.enqueue({
      epoch: 0,
      char: 'a',
      shapes: new Map([['mouthFunnel', 0.6]]),
      startTimeSec: 0,
      durationSec: 10,
    });
    for (let i = 0; i < steps; i++) scheduler.update(1, dt, 0, ['mouthFunnel']);
    return scheduler.getWeight('mouthFunnel');
  }

  it('one 1/30 s step equals two 1/60 s steps toward a constant target', () => {
    const coarse = weightAfter(1, 1 / 30);
    const fine = weightAfter(2, 1 / 60);
    expect(coarse).toBeGreaterThan(0);
    expect(Math.abs(coarse - fine)).toBeLessThan(1e-9);
  });

  it('three 1/90 s steps equal one 1/30 s step', () => {
    expect(Math.abs(weightAfter(3, 1 / 90) - weightAfter(1, 1 / 30))).toBeLessThan(1e-9);
  });
});
