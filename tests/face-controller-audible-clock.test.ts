import { describe, it, expect } from 'vitest';
import { FaceController } from '../src/lipsync/face-controller';
import { FaceDriver } from '../src/types/avatar';
import { AudioEngine } from '../src/audio/audio-engine';

class MockFaceDriver implements FaceDriver {
  public appliedWeights: Record<string, number> = {};
  public applyTargets(weights: Record<string, number>): void {
    Object.assign(this.appliedWeights, weights);
  }
  public applyWeight(shape: string, weight: number): void {
    this.appliedWeights[shape] = weight;
  }
  public listAvailableShapes(): string[] {
    return ['jawOpen', 'mouthClose', 'mouthFunnel', 'mouthPucker', 'eyeBlinkLeft', 'eyeBlinkRight'];
  }
  public getSpeechMeshes(): never[] {
    return [];
  }
  public getMorphTargetDictionary(): Record<string, number> {
    return {};
  }
}

class MockAudioEngine {
  // Render position far ahead of what is audible: the controller must NOT use it.
  public ctx: { currentTime: number; outputLatency?: number } = { currentTime: 5.0 };
  public getEpoch(): number {
    return 0;
  }
  public hasPendingAudio(): boolean {
    return true;
  }
}

describe('FaceController audible clock (SHOW-05)', () => {
  function setup() {
    const driver = new MockFaceDriver();
    const engine = new MockAudioEngine();
    let audible = 0;
    const controller = new FaceController(driver, engine as unknown as AudioEngine, {
      audibleClock: () => audible,
    });
    controller.setLipSyncEngine('char');
    controller.setCalibrationProfile({ syncOffsetMs: 0 });
    return {
      driver,
      engine,
      controller,
      setAudible: (t: number) => {
        audible = t;
      },
    };
  }

  it('keeps the mouth closed until the viseme is audible, even if the render position is past it', () => {
    const { driver, controller, setAudible } = setup();
    controller.onAudioChunk({ chars: ['a'], char_start_times_ms: [0], char_durations_ms: [400] }, 1.0, 0);

    // ctx.currentTime (5.0) is long past the viseme; the audible time (0.9) is not.
    setAudible(0.9);
    for (let i = 0; i < 5; i++) controller.render(0.016);
    expect(driver.appliedWeights['jawOpen'] ?? 0).toBeLessThan(0.01);

    setAudible(1.05);
    for (let i = 0; i < 10; i++) controller.render(0.016);
    expect(driver.appliedWeights['jawOpen']).toBeGreaterThan(0.05);
  });

  it('defaults to a latency-compensated clock built from the engine context', () => {
    const driver = new MockFaceDriver();
    const engine = new MockAudioEngine();
    engine.ctx.outputLatency = 0.5;
    const controller = new FaceController(driver, engine as unknown as AudioEngine);
    controller.setLipSyncEngine('char');
    controller.setCalibrationProfile({ syncOffsetMs: 0 });
    // Viseme at 5.2 s: render position 5.25 is already past it, but the audible time (4.75) is not.
    controller.onAudioChunk({ chars: ['a'], char_start_times_ms: [0], char_durations_ms: [400] }, 5.2, 0);
    engine.ctx.currentTime = 5.25;
    for (let i = 0; i < 5; i++) controller.render(0.016);
    expect(driver.appliedWeights['jawOpen'] ?? 0).toBeLessThan(0.01);
  });
});
