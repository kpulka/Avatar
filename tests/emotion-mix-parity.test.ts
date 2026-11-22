import { describe, it, expect } from 'vitest';
import { FaceController, EMOTION_MIX_SPEAKING } from '../src/lipsync/face-controller';
import { FaceDriver, FramesClip } from '../src/types/avatar';
import { AudioEngine } from '../src/audio/audio-engine';

class MockDriver implements FaceDriver {
  public appliedWeights: Record<string, number> = {};
  public applyTargets(weights: Record<string, number>): void {
    Object.assign(this.appliedWeights, weights);
  }
  public applyWeight(shape: string, weight: number): void {
    this.appliedWeights[shape] = weight;
  }
  public listAvailableShapes(): string[] {
    return ['jawOpen', 'mouthSmileLeft', 'mouthSmileRight', 'cheekSquintLeft', 'cheekSquintRight',
      'browInnerUp', 'browDownLeft', 'browDownRight', 'eyeWideLeft', 'eyeWideRight', 'eyeBlinkLeft', 'eyeBlinkRight'];
  }
  public getSpeechMeshes(): never[] {
    return [];
  }
  public getMorphTargetDictionary(): Record<string, number> {
    return {};
  }
}

class MockEngine {
  public ctx = { currentTime: 0 };
  public getEpoch(): number {
    return 0;
  }
  public hasPendingAudio(): boolean {
    return true;
  }
}

function build(): { driver: MockDriver; controller: FaceController } {
  const driver = new MockDriver();
  const controller = new FaceController(driver, new MockEngine() as unknown as AudioEngine, {
    audibleClock: () => 0.5,
  });
  controller.setLipSyncEngine('char');
  controller.setCalibrationProfile({ syncOffsetMs: 0 });
  return { driver, controller };
}

const BROW_SHAPES = ['browInnerUp', 'eyeWideLeft', 'eyeWideRight'];

describe('emotion mix parity (16-02: one policy for both tracks)', () => {
  it('the shared constant is 0.3', () => {
    expect(EMOTION_MIX_SPEAKING).toBe(0.3);
  });

  it('brow/eye emotion shapes get the same weight in the viseme and the frames track', () => {
    const viseme = build();
    viseme.controller.setEmotion('surprised');
    viseme.controller.onAudioChunk({ chars: ['a'], char_start_times_ms: [0], char_durations_ms: [2000] }, 0, 0);
    viseme.controller.render(0.5); // cross-fade (0.4 s) completes in one step

    const frames = build();
    frames.controller.setEmotion('surprised');
    frames.controller.setAnimationMode('frames');
    const clip: FramesClip = {
      shapes: ['jawOpen'],
      fps: 60,
      frames: [{ timeSec: 0, weights: { jawOpen: 0.3 } }],
      carriesEyes: false,
    };
    frames.controller.feedFrames(clip, 0, 0);
    frames.controller.render(0.5);

    expect(viseme.controller.getState()).toBe('SPEAKING');
    expect(frames.controller.getState()).toBe('SPEAKING');
    const profile: Record<string, number> = { browInnerUp: 0.25, eyeWideLeft: 0.15, eyeWideRight: 0.15 };
    for (const shape of BROW_SHAPES) {
      const expected = profile[shape] * EMOTION_MIX_SPEAKING;
      expect(viseme.driver.appliedWeights[shape]).toBeCloseTo(expected, 9);
      expect(frames.driver.appliedWeights[shape]).toBeCloseTo(expected, 9);
      expect(frames.driver.appliedWeights[shape]).toBeCloseTo(viseme.driver.appliedWeights[shape], 9);
    }
  });

  it('frames track: 0.3x emotion on non-owned shapes (was 100% - intentional behavior change)', () => {
    const { driver, controller } = build();
    controller.setEmotion('happy');
    controller.setAnimationMode('frames');
    controller.feedFrames(
      { shapes: ['jawOpen'], fps: 60, frames: [{ timeSec: 0, weights: { jawOpen: 0.3 } }], carriesEyes: false },
      0,
      0
    );
    controller.render(0.5);
    expect(driver.appliedWeights['mouthSmileLeft']).toBeCloseTo(0.22 * 0.3, 9);
    expect(driver.appliedWeights['cheekSquintLeft']).toBeCloseTo(0.12 * 0.3, 9);
    expect(driver.appliedWeights['jawOpen']).toBeCloseTo(0.3, 9); // owned shape stays absolute
  });
});
