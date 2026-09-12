import { describe, it, expect, vi, beforeEach } from 'vitest';
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

class MockAudioBufferSourceNode {
  public stopped = false;
  public disconnected = false;
  public onended: (() => void) | null = null;
  public connect(): void {}
  public disconnect(): void {
    this.disconnected = true;
  }
  public start(): void {}
  public stop(): void {
    this.stopped = true;
  }
}

class MockAudioContext {
  public currentTime = 5.0;
  public state = 'running';
  public createGain() {
    return { gain: { value: 1, setValueAtTime: vi.fn() }, connect: vi.fn() };
  }
  public createBuffer(channels: number, length: number, sampleRate: number) {
    return { duration: length / sampleRate, copyToChannel: vi.fn() };
  }
  public createBufferSource() {
    return new MockAudioBufferSourceNode();
  }
}

describe('Barge-in Pipeline (INT-01 & INT-02)', () => {
  let driver: MockFaceDriver;
  let mockCtx: MockAudioContext;
  let engine: AudioEngine;
  let controller: FaceController;

  beforeEach(() => {
    driver = new MockFaceDriver();
    mockCtx = new MockAudioContext();
    engine = new AudioEngine(mockCtx as unknown as AudioContext);
    controller = new FaceController(driver, engine);
  });

  it('immediately stops audio and starts facial relaxation upon interruption', () => {
    // 1. Rozpoczynamy odtwarzanie dźwięku
    const pcmChunk = new Uint8Array(44100);
    engine.playChunk(pcmChunk, 44100, 0);

    expect(engine.getActiveNodesCount()).toBe(1);
    expect(engine.getTailTime()).toBeGreaterThan(5.0);

    // 2. Dodajemy wizemy do FaceControllera
    controller.onAudioChunk(
      {
        chars: ['H', 'e', 'l', 'l', 'o'],
        char_start_times_ms: [0, 50, 100, 150, 200],
        char_durations_ms: [50, 50, 50, 50, 100],
      },
      5.08,
      0
    );

    expect(controller.getState()).toBe('SPEAKING');
    expect(controller.getQueueLength()).toBe(5);

    // 3. Występuje zdarzenie interruption (Barge-in)
    engine.hardStop();
    controller.onInterruption();

    // Weryfikacja INT-01: audio milknie natychmiast, ogon czasowy wyzerowany, epoch inkrementowany
    expect(engine.getActiveNodesCount()).toBe(0);
    expect(engine.getTailTime()).toBe(0);
    expect(engine.getEpoch()).toBe(1);

    // Weryfikacja INT-02: mimika przechodzi do RELAXING, kolejka wizemów wyczyszczona
    expect(controller.getState()).toBe('RELAXING');
    expect(controller.getQueueLength()).toBe(0);

    // 4. Po upływie 160ms w stanie RELAXING twarz osiąga IDLE
    vi.useFakeTimers();
    vi.setSystemTime(performance.now() + 160);

    controller.render(0.016);

    expect(controller.getState()).toBe('IDLE');
    expect(controller.getCurrentWeight('jawOpen')).toBe(0);

    vi.useRealTimers();
  });
});
