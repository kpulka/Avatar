import { describe, it, expect, vi } from 'vitest';
import { AnimationSourceRegistry, createDefaultAnimationSources } from '../src/lipsync/animation-sources';
import { FaceController } from '../src/lipsync/face-controller';
import { FaceDriver, FaceTrackContext, FaceTrackSource, FramesClip } from '../src/types/avatar';
import { AudioEngine } from '../src/audio/audio-engine';

class MockDriver implements FaceDriver {
  public w: Record<string, number> = {};
  public applyTargets(): void {}
  public applyWeight(shape: string, weight: number): void {
    this.w[shape] = weight;
  }
  public listAvailableShapes(): string[] {
    return ['jawOpen', 'mouthFunnel', 'eyeBlinkLeft', 'eyeBlinkRight'];
  }
  public getSpeechMeshes(): never[] {
    return [];
  }
  public getMorphTargetDictionary(): Record<string, number> {
    return {};
  }
}

const engine = { ctx: { currentTime: 0 }, getEpoch: () => 0, hasPendingAudio: () => true };

describe('AnimationSourceRegistry (open ids)', () => {
  it('registers a third source with its own short badge, no union edit needed', () => {
    const registry = createDefaultAnimationSources();
    const apply = vi.fn();
    registry.register({ id: 'synth', label: 'Synthetic', short: 'SYNTH', available: () => true, apply });
    expect(registry.list().map((s) => s.short)).toEqual(['LIVE', 'A2F', 'SYNTH']);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- test double / mock typing: the value comes from an untyped mock or JSON fixture
    registry.get('synth')!.apply({ setSource: (mode) => apply(mode) });
    expect(apply).toHaveBeenCalled();
  });

  it('warns and overwrites on a duplicate id', () => {
    const registry = new AnimationSourceRegistry();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const spec = { id: 'x', label: 'X', short: 'X', available: () => true, apply: () => {} };
    registry.register(spec);
    registry.register({ ...spec, label: 'X2' });
    expect(registry.get('x')?.label).toBe('X2');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('FaceController track sources (16-06: third source without editing internals)', () => {
  function setup() {
    const driver = new MockDriver();
    let audible = 0;
    const controller = new FaceController(driver, engine as unknown as AudioEngine, {
      audibleClock: () => audible,
      nowMs: () => 0,
    });
    return { driver, controller, setAudible: (t: number) => (audible = t) };
  }

  const clip: FramesClip = {
    shapes: ['jawOpen', 'mouthFunnel'],
    fps: 30,
    frames: [
      { timeSec: 0, weights: { jawOpen: 0.3, mouthFunnel: 0.1 } },
      { timeSec: 0.5, weights: { jawOpen: 0.6, mouthFunnel: 0.2 } },
    ],
    carriesEyes: false,
  };

  it('a synthetic SYNTH source runs end to end through the dispatch table', () => {
    const { driver, controller, setAudible } = setup();
    let startedWith: FaceTrackContext | null = null;
    const adapter: FaceTrackSource = {
      kind: 'frames',
      start: vi.fn((ctx) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- test double / mock typing: the value comes from an untyped mock or JSON fixture
        startedWith = ctx;
      }),
      feed: vi.fn((payload, epoch) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- test double / mock typing: the value comes from an untyped mock or JSON fixture
        startedWith!.feedFrames(payload as FramesClip, 0, epoch);
      }),
      stop: vi.fn(() => startedWith!.interrupt()),
    };
    controller.registerTrackSource('SYNTH', adapter);

    expect(controller.startTrack('SYNTH')).toBe(true);
    expect(controller.getAnimationMode()).toBe('frames');
    // eslint-disable-next-line @typescript-eslint/unbound-method -- test double / mock typing: the value comes from an untyped mock or JSON fixture
    expect(adapter.start).toHaveBeenCalledTimes(1);

    expect(controller.feedTrack('SYNTH', clip, 0)).toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- test double / mock typing: the value comes from an untyped mock or JSON fixture
    expect(adapter.feed).toHaveBeenCalledWith(clip, 0); // dispatch table hit
    expect(controller.getState()).toBe('SPEAKING');

    setAudible(0.6);
    controller.render(1 / 60);
    expect(driver.w['jawOpen']).toBeCloseTo(0.6, 9);
    expect(driver.w['mouthFunnel']).toBeCloseTo(0.2, 9);

    expect(controller.stopTrack('SYNTH')).toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- test double / mock typing: the value comes from an untyped mock or JSON fixture
    expect(adapter.stop).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toBe('RELAXING');
  });

  it('built-in adapters route to the existing tracks (frames and viseme)', () => {
    const { controller } = setup();
    expect(controller.startTrack('frames')).toBe(true);
    controller.feedTrack('frames', { clip, baseSec: 0 }, 0);
    expect(controller.getFrameQueueLength()).toBe(2);

    // Mid-turn the switch is deferred to the turn boundary; after the interruption it lands.
    expect(controller.startTrack('viseme')).toBe(true);
    expect(controller.getAnimationMode()).toBe('frames');
    controller.onInterruption();
    expect(controller.getAnimationMode()).toBe('viseme');
    controller.setLipSyncEngine('char');
    controller.feedTrack(
      'viseme',
      { alignment: { chars: ['a'], char_start_times_ms: [0], char_durations_ms: [100] }, startTimeSec: 0 },
      0
    );
    expect(controller.getVisemeQueueLength()).toBe(1);
  });

  it('a stale epoch is still rejected inside the track (safety stays in FaceController)', () => {
    const { controller } = setup();
    controller.startTrack('frames');
    controller.feedTrack('frames', { clip, baseSec: 0 }, 99);
    expect(controller.getFrameQueueLength()).toBe(0);
    expect(controller.getState()).toBe('IDLE');
  });

  it('an unknown source id is a no-op that reports false', () => {
    const { controller } = setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(controller.startTrack('NOPE')).toBe(false);
    expect(controller.feedTrack('NOPE', {}, 0)).toBe(false);
    expect(controller.stopTrack('NOPE')).toBe(false);
    warn.mockRestore();
  });
});
