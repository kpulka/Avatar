import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FaceController } from '../src/lipsync/face-controller';
import { FaceDriver, FramesClip, PoseFrame } from '../src/types/avatar';
import { AudioEngine } from '../src/audio/audio-engine';
import { buildDemoFrames } from '../src/lipsync/demo-frames';

class MockFaceDriver implements FaceDriver {
  public appliedWeights: Record<string, number> = {};

  public applyTargets(weights: Record<string, number>): void {
    Object.assign(this.appliedWeights, weights);
  }
  public applyWeight(shape: string, weight: number): void {
    this.appliedWeights[shape] = weight;
  }
  public listAvailableShapes(): string[] {
    return [
      'jawOpen',
      'mouthClose',
      'mouthFunnel',
      'mouthPucker',
      'mouthSmileLeft',
      'mouthSmileRight',
      'eyeBlinkLeft',
      'eyeBlinkRight',
    ];
  }
  public relaxToNeutral(): void {
    this.appliedWeights = {};
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
  public hasPending = false;

  public getEpoch(): number {
    return this.epoch;
  }
  public hasPendingAudio(): boolean {
    return this.hasPending;
  }
}

function clipOf(frames: PoseFrame[], extra?: Partial<FramesClip>): FramesClip {
  const owned = new Set<string>();
  for (const f of frames) for (const k of Object.keys(f.weights)) owned.add(k);
  return {
    frames,
    fps: 60,
    shapes: [...owned],
    carriesEyes: false,
    carriesEmotion: false,
    ...extra,
  };
}

describe('FaceController tryb frames (kontrakt v2)', () => {
  let driver: MockFaceDriver;
  let engine: MockAudioEngine;
  let controller: FaceController;

  beforeEach(() => {
    driver = new MockFaceDriver();
    engine = new MockAudioEngine();
    controller = new FaceController(driver, engine as unknown as AudioEngine);
    controller.setAnimationMode('frames');
  });

  it('switches the mode to frames and clears the state (IDLE)', () => {
    expect(controller.getAnimationMode()).toBe('frames');
    expect(controller.getState()).toBe('IDLE');
  });

  it('applies the middle frame — absolute frame values, no smoothing', () => {
    const clip = clipOf([
      { timeSec: 0.0, weights: { jawOpen: 0.1, mouthSmileLeft: 0.2 } },
      { timeSec: 0.5, weights: { jawOpen: 0.6, mouthSmileLeft: 0.4 } },
      { timeSec: 1.0, weights: { jawOpen: 0.8, mouthSmileLeft: 0.7 } },
    ]);
    engine.ctx.currentTime = 0.0;
    engine.hasPending = true; // playback w toku
    controller.feedFrames(clip, 0.0, 0);

    // Time between frame 0 and 1: frame 0 is applied (zero-order hold).
    engine.ctx.currentTime = 0.25;
    controller.render(1 / 60);

    expect(controller.getState()).toBe('SPEAKING');
    expect(driver.appliedWeights['jawOpen']).toBe(0.1);
    expect(driver.appliedWeights['mouthSmileLeft']).toBe(0.2);

    // After passing the 0.5 mark, frame 1 is applied.
    engine.ctx.currentTime = 0.51;
    controller.render(1 / 60);
    expect(driver.appliedWeights['jawOpen']).toBe(0.6);
  });

  it('ends the turn in RELAXING, starting from the LAST frame value (currentWeights)', () => {
    const clip = clipOf([
      { timeSec: 0.0, weights: { jawOpen: 0.1 } },
      { timeSec: 0.5, weights: { jawOpen: 0.7 } },
    ]);
    engine.ctx.currentTime = 0.0;
    engine.hasPending = true;
    controller.feedFrames(clip, 0.0, 0);

    engine.ctx.currentTime = 2.0; // jump past the end of the clip
    engine.hasPending = false; // audio has finished
    controller.render(1 / 60);

    // RELAXING from the last frame (0.7) — no "teleport" back to the old pose.
    expect(controller.getState()).toBe('RELAXING');
    expect(driver.appliedWeights['jawOpen']).toBe(0.7);
  });

  it('passes barge-in: onInterruption clears the buffer and enters RELAXING', () => {
    const clip = clipOf([
      { timeSec: 0.0, weights: { jawOpen: 0.5 } },
      { timeSec: 0.5, weights: { jawOpen: 0.8 } },
    ]);
    engine.hasPending = true;
    controller.feedFrames(clip, 0.0, 0);
    expect(controller.getFrameQueueLength()).toBe(2);

    controller.onInterruption();

    expect(controller.getState()).toBe('RELAXING');
    expect(controller.getFrameQueueLength()).toBe(0);
    expect(controller.getAnimationMode()).toBe('frames');
  });

  it('ignores feedFrames from an old epoch', () => {
    engine.epoch = 2;
    controller.feedFrames(clipOf([{ timeSec: 0.0, weights: { jawOpen: 0.9 } }]), 0.0, 1);

    expect(controller.getState()).toBe('IDLE');
    expect(controller.getFrameQueueLength()).toBe(0);
  });

  it('clamps mouthClose to 0.85 (MetaPerson safety)', () => {
    const clip = clipOf([
      { timeSec: 0.0, weights: { mouthClose: 1.0, jawOpen: 0.05 } },
    ]);
    engine.ctx.currentTime = 0.0;
    engine.hasPending = true;
    controller.feedFrames(clip, 0.0, 0);
    controller.render(1 / 60);

    expect(driver.appliedWeights['mouthClose']).toBe(0.85);
  });

  it('zeroes the clip-owned shapes missing from the current frame (owned = absolute)', () => {
    const clip = clipOf([{ timeSec: 0.0, weights: { jawOpen: 0.5 } }], {
      shapes: ['jawOpen', 'mouthSmileLeft'],
    });
    engine.ctx.currentTime = 0.0;
    engine.hasPending = true;
    controller.feedFrames(clip, 0.0, 0);
    controller.render(1 / 60);

    expect(driver.appliedWeights['jawOpen']).toBe(0.5);
    expect(driver.appliedWeights['mouthSmileLeft']).toBe(0);
  });

  it('disables procedural blinking when the clip carriesEyes (A2F carries the eyes)', () => {
    let blinkCalls = 0;
    controller.setBlinkProvider(() => {
      blinkCalls++;
      return { left: 1, right: 1 };
    });

    const clip = clipOf([{ timeSec: 0.0, weights: { jawOpen: 0.4 } }], {
      carriesEyes: true,
    });
    engine.ctx.currentTime = 0.0;
    engine.hasPending = true;
    controller.feedFrames(clip, 0.0, 0);
    controller.render(1 / 60);

    expect(blinkCalls).toBe(0);
    expect(driver.appliedWeights['eyeBlinkLeft'] ?? 0).toBe(0);
  });

  it('blinks procedurally when the clip does NOT carry eyes (carriesEyes=false)', () => {
    let blinkCalls = 0;
    controller.setBlinkProvider(() => {
      blinkCalls++;
      return { left: 1, right: 1 };
    });

    const clip = clipOf([{ timeSec: 0.0, weights: { jawOpen: 0.4 } }], {
      carriesEyes: false,
    });
    engine.ctx.currentTime = 0.0;
    engine.hasPending = true;
    controller.feedFrames(clip, 0.0, 0);
    controller.render(1 / 60);

    expect(blinkCalls).toBe(1);
  });

  it('does not blend emotion into speech weights when carriesEmotion (A2E drives the expression)', () => {
    controller.setEmotion('happy');
    const clip = clipOf([{ timeSec: 0.0, weights: { jawOpen: 0.5 } }], {
      carriesEmotion: true,
    });
    engine.ctx.currentTime = 0.0;
    engine.hasPending = true;
    controller.feedFrames(clip, 0.0, 0);
    controller.render(1 / 60);

    // Value comes purely from the frame — no 30% emotion blend.
    expect(driver.appliedWeights['jawOpen']).toBe(0.5);
  });

  it('defers the mode change to the turn boundary (deferToTurnEnd)', () => {
    controller.setAnimationMode('viseme');
    // Viseme turn in progress.
    controller.onAudioChunk(
      {
        chars: ['A'],
        char_start_times_ms: [0],
        char_durations_ms: [60],
      },
      0.0,
      0
    );
    expect(controller.getState()).toBe('SPEAKING');

    // Switch requested while speaking -> pending, mode unchanged.
    controller.setAnimationMode('frames', { deferToTurnEnd: true });
    expect(controller.getAnimationMode()).toBe('viseme');

    // End of turn (queue empty, audio finished) -> switch at the boundary.
    engine.ctx.currentTime = 1.0;
    engine.hasPending = false;
    controller.render(1 / 60);

    expect(controller.getAnimationMode()).toBe('frames');
    expect(controller.getState()).toBe('RELAXING');
  });

  it('switches the mode immediately on interruption when pendingMode is set', () => {
    controller.setAnimationMode('viseme');
    controller.onAudioChunk(
      {
        chars: ['B', 'C'],
        char_start_times_ms: [0, 60],
        char_durations_ms: [60, 60],
      },
      0.0,
      0
    );
    controller.setAnimationMode('frames', { deferToTurnEnd: true });
    expect(controller.getAnimationMode()).toBe('viseme');

    controller.onInterruption();

    expect(controller.getAnimationMode()).toBe('frames');
    expect(controller.getState()).toBe('RELAXING');
    expect(controller.getFrameQueueLength()).toBe(0);
  });

  it('30 s drift: frame-by-frame playback hits the frames (v2 contract, no divergence)', () => {
    const clip = buildDemoFrames(44100, 30.0);
    engine.ctx.currentTime = 0.0;
    engine.hasPending = true;
    controller.feedFrames(clip, 0.0, 0);

    // Play the whole clip in 1/60 s steps; each render frame falls on a frame boundary
    // (zero-order hold) — at the end the LAST frame of the clip is applied.
    const steps = Math.round(30.0 * 60);
    for (let s = 1; s <= steps; s++) {
      engine.ctx.currentTime = s / 60;
      controller.render(1 / 60);
    }

    engine.ctx.currentTime = 30.1; // audio has finished
    engine.hasPending = false;
    controller.render(1 / 60);

    const last = clip.frames[clip.frames.length - 1];
    expect(controller.getState()).toBe('RELAXING');
    for (const [k, v] of Object.entries(last.weights)) {
      expect(Math.abs((driver.appliedWeights[k] ?? 0) - v)).toBeLessThan(1e-6);
    }
    expect(controller.getFrameQueueLength()).toBeLessThanOrEqual(1);
  });
});

describe('demo-frames (buildDemoFrames — kontrakt v2)', () => {
  it('generates 60 fps frames of length ~durationSec (±1 frame)', () => {
    const dur = 2.5;
    const clip = buildDemoFrames(44100, dur, 'Hello and welcome');
    expect(clip.fps).toBe(60);
    expect(clip.frames.length).toBe(Math.round(dur * 60));
    const last = clip.frames[clip.frames.length - 1];
    expect(last.timeSec + 1 / 60).toBeCloseTo(dur, 5);
  });

  it('values in 0..1, timeSec increasing from 0, keys matching shapes', () => {
    const clip = buildDemoFrames(44100, 1.0, 'Map, mop, pop.');
    let prev = -1e-9;
    for (const f of clip.frames) {
      expect(f.timeSec).toBeGreaterThan(prev);
      prev = f.timeSec;
      for (const v of Object.values(f.weights)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      for (const k of Object.keys(f.weights)) {
        expect(clip.shapes).toContain(k);
      }
    }
    expect(clip.frames[0].timeSec).toBe(0);
  });

  it('M/B/P closes the lips in the clip (mouthClose appears in shapes)', () => {
    const clip = buildDemoFrames(44100, 2.0, 'Map pop boy');
    expect(clip.shapes).toContain('mouthClose');
    expect(clip.carriesEyes).toBe(false);
    expect(clip.carriesEmotion).toBe(false);
  });
});
