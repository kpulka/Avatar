import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FaceController } from '../src/lipsync/face-controller';
import { FaceDriver, FramesClip, EyeLookWeights } from '../src/types/avatar';
import { AudioEngine } from '../src/audio/audio-engine';
import { SceneController, type SceneControllerDeps } from '../src/features/scene-controller';

const EYE_LOOK = [
  'eyeLookInLeft',
  'eyeLookOutLeft',
  'eyeLookUpLeft',
  'eyeLookDownLeft',
  'eyeLookInRight',
  'eyeLookOutRight',
  'eyeLookUpRight',
  'eyeLookDownRight',
];

class RecordingDriver implements FaceDriver {
  public appliedWeights: Record<string, number> = {};
  public writes: Array<[string, number]> = [];
  public applyTargets(weights: Record<string, number>): void {
    for (const [k, v] of Object.entries(weights)) this.applyWeight(k, v);
  }
  public applyWeight(shape: string, weight: number): void {
    this.appliedWeights[shape] = weight;
    this.writes.push([shape, weight]);
  }
  public listAvailableShapes(): string[] {
    return [
      'jawOpen',
      'mouthClose',
      'mouthFunnel',
      'mouthSmileLeft',
      'mouthSmileRight',
      'browInnerUp',
      'eyeBlinkLeft',
      'eyeBlinkRight',
      ...EYE_LOOK,
    ];
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

const GAZE: EyeLookWeights = {
  eyeLookInLeft: 0,
  eyeLookOutLeft: 0.8,
  eyeLookUpLeft: 0,
  eyeLookDownLeft: 0,
  eyeLookInRight: 0.8,
  eyeLookOutRight: 0,
  eyeLookUpRight: 0,
  eyeLookDownRight: 0,
};

function framesClip(carriesEyes: boolean): FramesClip {
  return {
    shapes: ['jawOpen'],
    fps: 60,
    frames: [{ timeSec: 0, weights: { jawOpen: 0.3 } }],
    carriesEyes,
  };
}

describe('single morph writer: gaze through the FaceController provider seam', () => {
  let driver: RecordingDriver;
  let engine: MockAudioEngine;
  let controller: FaceController;
  let audible = 0;

  beforeEach(() => {
    audible = 0;
    driver = new RecordingDriver();
    engine = new MockAudioEngine();
    controller = new FaceController(driver, engine as unknown as AudioEngine, { audibleClock: () => audible });
    controller.setLipSyncEngine('char');
    controller.setCalibrationProfile({ syncOffsetMs: 0 });
  });

  it('(a) G-2: gaze morphs survive a live viseme turn (scheduler no longer zeroes eyeLook*)', () => {
    const provider = vi.fn(() => GAZE);
    controller.setGazeProvider(provider);
    controller.onAudioChunk({ chars: ['a', 'b'], char_start_times_ms: [0, 200], char_durations_ms: [200, 200] }, 0, 0);
    audible = 0.1;

    const mark = driver.writes.length;
    for (let i = 0; i < 30; i++) controller.render(0.016);
    expect(controller.getState()).toBe('SPEAKING');
    expect(provider).toHaveBeenCalledTimes(30);

    const outLeft = driver.writes
      .slice(mark)
      .filter(([s]) => s === 'eyeLookOutLeft')
      .map(([, w]) => w);
    // Only the provider writes eyeLook*: exactly one write per frame, the gaze value, never 0.
    expect(outLeft).toHaveLength(30);
    expect(outLeft.every((w) => Math.abs(w - 0.8 * 0.35) < 1e-9)).toBe(true);
    expect(driver.appliedWeights['jawOpen']).toBeGreaterThan(0);
  });

  it('gaze morphs also survive RELAXING (no clobber to 0 during the ease-out)', () => {
    controller.setGazeProvider(() => GAZE);
    controller.onAudioChunk({ chars: ['a'], char_start_times_ms: [0], char_durations_ms: [300] }, 0, 0);
    audible = 0.1;
    for (let i = 0; i < 5; i++) controller.render(0.016);
    controller.onInterruption();
    const mark = driver.writes.length;
    controller.render(0.016);
    const outLeft = driver.writes
      .slice(mark)
      .filter(([s]) => s === 'eyeLookOutLeft')
      .map(([, w]) => w);
    expect(outLeft).toEqual([0.8 * 0.35]);
  });

  it('(b) gaze provider is not invoked and eyeLook* not written when frames carry eyes', () => {
    const provider = vi.fn(() => GAZE);
    controller.setGazeProvider(provider);
    controller.setAnimationMode('frames');
    controller.feedFrames(framesClip(true), 0, 0);
    expect(controller.areProceduralEyesActive()).toBe(false);

    for (let i = 0; i < 5; i++) controller.render(0.016);
    expect(provider).not.toHaveBeenCalled();
    expect(driver.writes.some(([s]) => s.startsWith('eyeLook'))).toBe(false);
  });

  it('(b2) without carriesEyes the gaze keeps running in frames mode', () => {
    const provider = vi.fn(() => GAZE);
    controller.setGazeProvider(provider);
    controller.setAnimationMode('frames');
    controller.feedFrames(framesClip(false), 0, 0);
    expect(controller.areProceduralEyesActive()).toBe(true);
    controller.render(0.016);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('(d) blink is suppressed under carriesEyes and runs otherwise', () => {
    const blink = vi.fn(() => ({ left: 0.5, right: 0.5 }));
    controller.setBlinkProvider(blink);
    controller.setAnimationMode('frames');
    controller.feedFrames(framesClip(true), 0, 0);
    controller.render(0.016);
    expect(blink).not.toHaveBeenCalled();

    controller.setAnimationMode('viseme');
    controller.render(0.016);
    expect(blink).toHaveBeenCalled();
  });

  it('a null provider result writes nothing (first frame before the scene computed weights)', () => {
    controller.setGazeProvider(() => null);
    controller.render(0.016);
    expect(driver.writes.some(([s]) => s.startsWith('eyeLook'))).toBe(false);
  });
});

describe('scene seam: eyeball bones obey the same carriesEyes gate', () => {
  function makeScene(gate: boolean | undefined) {
    const gaze = {
      compute: vi.fn(() => GAZE),
      applyToEyeObjects: vi.fn(),
      setPointer: vi.fn(),
    };
    const renderer = { render: vi.fn() };
    const deps = {
      renderer,
      camera: { update: vi.fn(), instance: {} },
      scene: { instance: {}, avatarContainer: {} },
      headMicro: { update: vi.fn(), reset: vi.fn() },
      gaze,
    } as unknown as SceneControllerDeps;
    const controller = new SceneController(deps);
    const internals = controller as unknown as { root: unknown; faceDriver: unknown };
    internals.root = { userData: { leftEye: {}, rightEye: {} }, getObjectByName: () => null };
    internals.faceDriver = new RecordingDriver();
    if (gate !== undefined) controller.setProceduralEyesGate(() => gate);
    return { controller, gaze, renderer };
  }

  it('rotates the eye bones by default and exposes the computed gaze weights (never writes morphs)', () => {
    const { controller, gaze } = makeScene(undefined);
    controller.update(0.016, 1000);
    expect(gaze.compute).toHaveBeenCalledWith(1, 0.016);
    expect(gaze.applyToEyeObjects).toHaveBeenCalledTimes(1);
    expect(controller.getGazeWeights()).toEqual(GAZE);
    expect((controller as unknown as { faceDriver: RecordingDriver }).faceDriver.writes).toHaveLength(0);
  });

  it('(c) does not rotate the eye bones when the gate says an A2F clip carries the eyes', () => {
    const { controller, gaze, renderer } = makeScene(false);
    controller.update(0.016, 1000);
    expect(gaze.applyToEyeObjects).not.toHaveBeenCalled();
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });
});
