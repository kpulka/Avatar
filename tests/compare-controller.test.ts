import { describe, expect, it, vi } from 'vitest';
import { TypedEventBus } from '../src/app/events';
import { AppEvents, CompareResultEvent } from '../src/app/app-types';
import { CharAlignment, FramesClip } from '../src/types/avatar';
import { LastTurnBuffer } from '../src/features/last-turn-buffer';
import { CompareController, rmsDiff } from '../src/features/compare-controller';
import { createDefaultAnimationSources } from '../src/lipsync/animation-sources';

const ALIGNMENT: CharAlignment = {
  chars: ['a', 'b'],
  char_start_times_ms: [0, 50],
  char_durations_ms: [50, 50],
  source: 'elevenlabs',
};

const CLIP: FramesClip = {
  frames: [
    { timeSec: 0, weights: { jawOpen: 0.2 } },
    { timeSec: 0.05, weights: { jawOpen: 0.4 } },
  ],
  fps: 30,
  shapes: ['jawOpen'],
  carriesEyes: false,
  carriesEmotion: false,
};

function makeEngine() {
  let epoch = 0;
  let tail = 0;
  return {
    playChunk: vi.fn((bytes: Uint8Array, sampleRate: number) => {
      tail += bytes.byteLength / 2 / sampleRate;
      return tail;
    }),
    hardStop: vi.fn(() => {
      epoch += 1;
      tail = 0;
    }),
    getEpoch: vi.fn(() => epoch),
    getTailTime: vi.fn(() => tail),
    hasPendingAudio: vi.fn(() => false),
  };
}

function makeFaceController() {
  const sequence: string[] = [];
  return {
    sequence,
    faceController: {
      onAudioChunk: vi.fn(() => sequence.push('live')),
      feedFrames: vi.fn(() => sequence.push('a2f')),
      getState: vi.fn(() => 'IDLE'),
      getAnimationMode: vi.fn(() => 'viseme'),
      setAnimationMode: vi.fn(),
      onInterruption: vi.fn(),
    },
  };
}

interface HarnessOptions {
  predict?: ReturnType<typeof vi.fn>;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  withTurn?: boolean;
  pendingAudio?: boolean;
}

function makeHarness(options: HarnessOptions = {}) {
  const events = new TypedEventBus<AppEvents>();
  const buffer = new LastTurnBuffer({ events });
  if (options.withTurn !== false) {
    events.emit('audio:chunk', {
      bytes: new Uint8Array([1, 2, 3, 4]),
      alignment: ALIGNMENT,
      epoch: 0,
      startTime: 0,
      sampleRate: 16000,
    });
    events.emit('audio:chunk', {
      bytes: new Uint8Array([5, 6, 7, 8]),
      alignment: ALIGNMENT,
      epoch: 0,
      startTime: 0,
      sampleRate: 16000,
    });
    events.emit('transcript:agent', 'Test turn');
  }

  const engine = makeEngine();
  if (options.pendingAudio) engine.hasPendingAudio.mockReturnValue(true);
  const { faceController, sequence } = makeFaceController();
  const predict =
    options.predict ?? vi.fn(async () => ({ parsed: { clip: CLIP }, predictMs: 120 }));
  const results: CompareResultEvent[] = [];
  events.on('compare:result', (result) => results.push(result));

  const controller = new CompareController({
    buffer,
    audioEngine: engine as never,
    getFaceController: () => faceController as never,
    getA2fUrl: () => 'http://127.0.0.1:8000',
    events,
    sleep: options.sleep ?? (async () => undefined),
    random: options.random ?? (() => 0.1),
    predict: predict as never,
  });

  return { events, buffer, engine, faceController, sequence, predict, results, controller };
}

describe('AnimationSourceRegistry', () => {
  it('rejestruje wbudowane źródła i przyjmuje a2f-cloud jako dane (F10)', () => {
    const registry = createDefaultAnimationSources();
    expect(registry.list().map((spec) => spec.id)).toEqual(['viseme', 'a2f-local']);

    registry.register({
      id: 'a2f-cloud',
      label: 'A2F (cloud)',
      short: 'A2F',
      available: () => true,
      apply: (ctx) => ctx.setSource('frames'),
    });
    expect(registry.list().map((spec) => spec.id)).toContain('a2f-cloud');
    expect(registry.get('a2f-cloud')?.short).toBe('A2F');
  });
});

describe('CompareController', () => {
  it('odtwarza tę samą turę w obu torach, w tej samej kolejności bajtów', async () => {
    const harness = makeHarness();
    const ok = await harness.controller.run();

    expect(ok).toBe(true);
    expect(harness.controller.getState()).toBe('done');

    // 2 chunki × 2 tory
    expect(harness.engine.playChunk).toHaveBeenCalledTimes(4);
    const calls = harness.engine.playChunk.mock.calls;
    expect(Array.from(calls[0][0] as Uint8Array)).toEqual([1, 2, 3, 4]);
    expect(Array.from(calls[2][0] as Uint8Array)).toEqual([1, 2, 3, 4]);
    expect(Array.from(calls[1][0] as Uint8Array)).toEqual([5, 6, 7, 8]);
    expect(Array.from(calls[3][0] as Uint8Array)).toEqual([5, 6, 7, 8]);
    expect(calls[0][1]).toBe(calls[2][1]);

    expect(harness.faceController.onAudioChunk).toHaveBeenCalledTimes(2);
    expect(harness.faceController.feedFrames).toHaveBeenCalledTimes(1);
    expect(harness.sequence).toEqual(['live', 'live', 'a2f']);
    expect(harness.results).toHaveLength(1);
    expect(harness.results[0].order).toEqual(['live', 'a2f']);
    expect(harness.results[0].a2f.predictMs).toBe(120);
    expect(harness.results[0].a2f.frames).toBe(2);
  });

  it('blind losuje prezentację, ale raport zachowuje mapowanie torów', async () => {
    const harness = makeHarness({ random: () => 0.9 });
    await harness.controller.run({ blind: true });

    expect(harness.results[0].order).toEqual(['a2f', 'live']);
    expect(harness.sequence[0]).toBe('a2f');
    expect(harness.faceController.feedFrames).toHaveBeenCalledTimes(1);
  });

  it('interruption przerywa replay zanim predict wystartuje', async () => {
    let release: (() => void) | null = null;
    const harness = makeHarness({
      sleep: () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    });

    const running = harness.controller.run();
    await Promise.resolve();
    await Promise.resolve();
    expect(harness.engine.playChunk).toHaveBeenCalledTimes(2);

    harness.events.emit('speech:interruption', 'user');
    expect(harness.controller.getState()).toBe('idle');
    const hardStops = harness.engine.hardStop.mock.calls.length;

    release?.();
    await running;

    expect(harness.predict).not.toHaveBeenCalled();
    expect(harness.engine.hardStop.mock.calls.length).toBe(hardStops);
  });

  it('nowy audio:chunk (tura LIVE) anuluje replay — hardStop pas bezpieczeństwa', async () => {
    let release: (() => void) | null = null;
    const harness = makeHarness({
      sleep: () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    });

    const running = harness.controller.run();
    await Promise.resolve();
    await Promise.resolve();

    const hardStopsBefore = harness.engine.hardStop.mock.calls.length;
    harness.events.emit('audio:chunk', {
      bytes: new Uint8Array([9, 9]),
      alignment: ALIGNMENT,
      epoch: 1,
      startTime: 0,
      sampleRate: 16000,
    });
    expect(harness.engine.hardStop.mock.calls.length).toBe(hardStopsBefore + 1);
    expect(harness.controller.getState()).toBe('idle');

    release?.();
    await running;
    expect(harness.faceController.feedFrames).not.toHaveBeenCalled();
  });

  it('predict offline → stan error, brak zapisu do FaceDriver w torze B', async () => {
    const failingPredict = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    const harness = makeHarness({ predict: failingPredict });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const ok = await harness.controller.run();
    warn.mockRestore();

    expect(ok).toBe(true);
    expect(harness.controller.getState()).toBe('error');
    expect(harness.faceController.feedFrames).not.toHaveBeenCalled();
    expect(harness.results).toHaveLength(0);
  });

  it('nie startuje, gdy trwa audio lub nie ma tury', async () => {
    const pending = makeHarness({ pendingAudio: true });
    expect(await pending.controller.run()).toBe(false);
    expect(pending.engine.playChunk).not.toHaveBeenCalled();

    const empty = makeHarness({ withTurn: false });
    expect(await empty.controller.run()).toBe(false);
  });

  it('rmsDiff: identyczne ścieżki = 0, różne > 0 (fairness RMS < 1%)', () => {
    const a = new Float32Array([0.1, -0.2, 0.3, -0.4]);
    const b = new Float32Array([0.1, -0.2, 0.3, -0.4]);
    const c = new Float32Array([0.2, -0.1, 0.25, -0.35]);
    expect(rmsDiff(a, b)).toBe(0);
    expect(rmsDiff(a, c)).toBeGreaterThan(0);
    expect(rmsDiff(a, c)).toBeLessThan(1);
  });
});
