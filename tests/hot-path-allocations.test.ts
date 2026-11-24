import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FaceController } from '../src/lipsync/face-controller';
import { allocProbe } from '../src/realism/alloc-probe';
import { FaceDriver, FramesClip } from '../src/types/avatar';
import { AudioEngine } from '../src/audio/audio-engine';
import { defined } from './helpers/defined';

const SHAPES = [
  'jawOpen', 'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthSmileLeft', 'mouthSmileRight',
  'mouthPressLeft', 'cheekSquintLeft', 'browInnerUp', 'eyeWideLeft', 'eyeBlinkLeft', 'eyeBlinkRight',
];

class CountingDriver implements FaceDriver {
  public w: Record<string, number> = {};
  public applyCalls = 0;
  public applyTargets(): void {}
  public applyWeight(shape: string, weight: number): void {
    this.applyCalls++;
    this.w[shape] = weight;
  }
  public listAvailableShapes(): string[] {
    return SHAPES;
  }
  public getSpeechMeshes(): never[] {
    return [];
  }
  public getMorphTargetDictionary(): Record<string, number> {
    return {};
  }
}

const engine = { ctx: { currentTime: 0 }, getEpoch: () => 0, hasPendingAudio: () => true };

/** Fixed char -> pose mapper: independent of the viseme tables (Phase 17 owns those). */
function fixedMapper(_chars: string[], i: number): Map<string, number> {
  switch (i % 4) {
    case 0: return new Map([['jawOpen', 0.6], ['mouthSmileLeft', 0.3]]);
    case 1: return new Map([['mouthClose', 0.5], ['mouthPressLeft', 0.3], ['jawOpen', 0.1]]);
    case 2: return new Map([['mouthFunnel', 0.5], ['mouthPucker', 0.4]]);
    default: return new Map([['mouthSmileLeft', 0.4], ['mouthSmileRight', 0.4], ['cheekSquintLeft', 0.2]]);
  }
}

function longVisemeTurn(controller: FaceController): void {
  const n = 40;
  controller.onAudioChunk(
    {
      chars: Array.from({ length: n }, () => 'x'),
      char_start_times_ms: Array.from({ length: n }, (_, i) => i * 80),
      char_durations_ms: Array.from({ length: n }, () => 80),
    },
    0,
    0
  );
}

function framesClip(n: number): FramesClip {
  return {
    shapes: ['jawOpen', 'mouthClose', 'mouthFunnel'],
    fps: 60,
    frames: Array.from({ length: n }, (_, i) => ({
      timeSec: i / 60,
      weights: { jawOpen: (i % 10) / 10, mouthClose: 0.9, mouthFunnel: 0.2 },
    })),
    carriesEyes: false,
  };
}

function build(): {
  driver: CountingDriver;
  controller: FaceController;
  setAudible: (t: number) => void;
  setWall: (ms: number) => void;
} {
  const driver = new CountingDriver();
  let audible = 0;
  let wall = 0;
  const controller = new FaceController(driver, engine as unknown as AudioEngine, {
    audibleClock: () => audible,
    nowMs: () => wall,
    debugAllocations: true,
  });
  controller.setLipSyncEngine('char');
  controller.setCharMapper(fixedMapper);
  controller.setCalibrationProfile({ syncOffsetMs: 0 });
  return { driver, controller, setAudible: (t) => (audible = t), setWall: (ms) => (wall = ms) };
}

/** Counts real container constructions/copies, independent of the allocProbe instrumentation. */
function countContainerAllocations(run: () => void): number {
  const RealMap = globalThis.Map;
  const RealSet = globalThis.Set;
  let count = 0;
  class CountingMap<K, V> extends RealMap<K, V> {
    constructor(...args: ConstructorParameters<typeof RealMap<K, V>>) {
      super(...args);
      count++;
    }
  }
  class CountingSet<T> extends RealSet<T> {
    constructor(...args: ConstructorParameters<typeof RealSet<T>>) {
      super(...args);
      count++;
    }
  }
  const spies = [
    vi.spyOn(Array.prototype, 'slice'),
    vi.spyOn(Array.prototype, 'filter'),
    vi.spyOn(Array.prototype, 'map'),
    vi.spyOn(Array.prototype, 'concat'),
    vi.spyOn(Object, 'entries'),
  ];
  (globalThis as unknown as { Map: unknown }).Map = CountingMap;
  (globalThis as unknown as { Set: unknown }).Set = CountingSet;
  try {
    run();
  } finally {
    (globalThis as unknown as { Map: unknown }).Map = RealMap;
    (globalThis as unknown as { Set: unknown }).Set = RealSet;
    for (const spy of spies) {
      count += spy.mock.calls.length;
      spy.mockRestore();
    }
  }
  return count;
}

describe('hot path is allocation-free (16-05)', () => {
  beforeEach(() => {
    allocProbe.reset();
  });
  afterEach(() => {
    allocProbe.enabled = false;
  });

  it('(a) viseme turn: 120 SPEAKING frames allocate no containers and the probe stays at 0', () => {
    const { controller, setAudible } = build();
    controller.setEmotion('happy');
    longVisemeTurn(controller);
    setAudible(0.1);
    controller.render(1 / 60); // warm-up frame (first writes populate the weight maps)

    const allocations = countContainerAllocations(() => {
      for (let i = 0; i < 120; i++) {
        setAudible(0.1 + i / 60);
        controller.render(1 / 60);
      }
    });
    expect(controller.getState()).toBe('SPEAKING');
    expect(allocations).toBe(0);
    expect(allocProbe.count).toBe(0);
  });

  it('(b) frames turn: 120 SPEAKING frames allocate no containers and the probe stays at 0', () => {
    const { controller, setAudible } = build();
    controller.setEmotion('surprised');
    controller.setAnimationMode('frames');
    controller.feedFrames(framesClip(300), 0, 0);
    setAudible(0);
    controller.render(1 / 60);

    const allocations = countContainerAllocations(() => {
      for (let i = 0; i < 120; i++) {
        setAudible(i / 60);
        controller.render(1 / 60);
      }
    });
    expect(controller.getState()).toBe('SPEAKING');
    expect(allocations).toBe(0);
    expect(allocProbe.count).toBe(0);
  });

  it('the probe really fires when an owned copy is taken (guards the guard)', () => {
    const { controller } = build();
    controller.getEmotionLayer().takeWeights();
    expect(allocProbe.count).toBe(1);
  });

  it('frames consumption compacts in place and keeps the current frame', () => {
    const { controller, setAudible } = build();
    controller.setAnimationMode('frames');
    controller.feedFrames(framesClip(300), 0, 0);
    expect(controller.getFrameQueueLength()).toBe(300);
    setAudible(1.0); // frame index 60
    controller.render(1 / 60);
    expect(controller.getFrameQueueLength()).toBe(240);
  });

  it('(d) RELAXING: zero-to-zero shapes are not written, completion still correct', () => {
    const { driver, controller, setAudible, setWall } = build();
    controller.onAudioChunk(
      { chars: ['x'], char_start_times_ms: [0], char_durations_ms: [2000] }, 0, 0);
    setAudible(0.5);
    for (let i = 0; i < 20; i++) controller.render(1 / 60); // case 0: jawOpen + mouthSmileLeft only
    controller.onInterruption();
    controller.render(1 / 60);
    driver.applyCalls = 0;
    controller.render(1 / 60);
    // Active shapes only: well below the 10 non-blink shapes the loop used to write every frame
    expect(driver.applyCalls).toBeLessThanOrEqual(5);
    expect(driver.applyCalls).toBeGreaterThan(0);
    for (let i = 1; i <= 60 && controller.getState() !== 'IDLE'; i++) {
      setWall(i * 10);
      controller.render(1 / 60);
    }
    expect(controller.getState()).toBe('IDLE');
  });
});

describe('golden weights: refactor changed no output (16-05)', () => {
  it('viseme track at frames 25 and 34 (captured before the scratch-structure refactor)', () => {
    const { driver, controller, setAudible } = build();
    controller.setEmotion('happy');
    controller.onAudioChunk(
      {
        chars: ['m', 'a', 'p', 'o', 'u', 'e', 'b', 'a'],
        char_start_times_ms: [0, 80, 160, 240, 320, 400, 480, 560],
        char_durations_ms: [80, 80, 80, 80, 80, 80, 80, 80],
      },
      0,
      0
    );
    const snapshots: Record<number, Record<string, number>> = {};
    for (let i = 0; i < 60; i++) {
      setAudible(0.1 + i / 60);
      controller.render(1 / 60);
      if (i === 24 || i === 33) snapshots[i] = { ...driver.w };
    }
    expect(snapshots[24]).toBeDefined();
    expect(snapshots[33]).toBeDefined();
    const golden24: Record<string, number> = {
      jawOpen: 0.05660400904039782,
      mouthClose: 0.2588764001417696,
      mouthFunnel: 0.38601373340219947,
      mouthPucker: 0.3088109867217596,
      mouthSmileLeft: 0.10589871072159623,
      mouthSmileRight: 0.03862908086643966,
      mouthPressLeft: 0.15532584008506176,
      cheekSquintLeft: 0.03769443400062358,
    };
    const golden33: Record<string, number> = {
      jawOpen: 0,
      mouthClose: 0,
      mouthFunnel: 0.06523492028279684,
      mouthPucker: 0.05218793622623749,
      mouthSmileLeft: 0.3963406620225484,
      mouthSmileRight: 0.38746148504814354,
      mouthPressLeft: 0,
      cheekSquintLeft: 0.22571370584253123,
    };
    for (const [shape, value] of Object.entries(golden24)) expect(defined(snapshots[24])[shape], shape).toBeCloseTo(value, 9);
    for (const [shape, value] of Object.entries(golden33)) expect(defined(snapshots[33])[shape], shape).toBeCloseTo(value, 9);
  });

  it('frames track at frame 25 and 60', () => {
    const { driver, controller, setAudible } = build();
    controller.setEmotion('surprised');
    controller.setAnimationMode('frames');
    controller.feedFrames(framesClip(120), 0, 0);
    let at25: Record<string, number> = {};
    for (let i = 0; i < 60; i++) {
      setAudible(i / 60);
      controller.render(1 / 60);
      if (i === 24) at25 = { ...driver.w };
    }
    const golden25: Record<string, number> = {
      jawOpen: 0.4,
      mouthClose: 0.85,
      mouthFunnel: 0.2,
      browInnerUp: 0.075,
      eyeWideLeft: 0.045,
      eyeWideRight: 0.045,
    };
    const golden60: Record<string, number> = {
      jawOpen: 0.9,
      mouthClose: 0.85,
      mouthFunnel: 0.2,
      browInnerUp: 0.075,
      eyeWideLeft: 0.045,
      eyeWideRight: 0.045,
    };
    for (const [shape, value] of Object.entries(golden25)) expect(at25[shape], shape).toBeCloseTo(value, 9);
    for (const [shape, value] of Object.entries(golden60)) expect(driver.w[shape], shape).toBeCloseTo(value, 9);
  });
});
