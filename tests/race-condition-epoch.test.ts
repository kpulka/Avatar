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
    return ['jawOpen', 'mouthClose', 'mouthFunnel', 'eyeBlinkLeft', 'eyeBlinkRight'];
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
  public currentTime = 10.0;
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

describe('Race Condition & Epoch Invalidation (INT-01)', () => {
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

  it('silently ignores delayed audio chunks and visemes from previous epoch', () => {
    // 1. Rozpoczynamy wypowiedź w epoce 0
    const chunk0 = new Uint8Array(44100);
    const start0 = engine.playChunk(chunk0, 44100, 0);
    expect(start0).toBeGreaterThan(0);
    expect(engine.getActiveNodesCount()).toBe(1);

    controller.onAudioChunk(
      {
        chars: ['A'],
        char_start_times_ms: [0],
        char_durations_ms: [100],
      },
      start0,
      0
    );
    expect(controller.getQueueLength()).toBe(1);

    // 2. Występuje przerwanie (barge-in): epoka przechodzi na 1
    engine.hardStop();
    controller.onInterruption();
    expect(engine.getEpoch()).toBe(1);
    expect(controller.getQueueLength()).toBe(0);

    // 3. Spóźniony pakiet sieciowy z epoki 0 dociera do klienta (jitter sieciowy)
    const delayedPcm = new Uint8Array(22050);
    const delayedStart = engine.playChunk(delayedPcm, 44100, 0); // epoka 0

    // Odrzucenie audio
    expect(delayedStart).toBe(0);
    expect(engine.getActiveNodesCount()).toBe(0);

    // Odrzucenie mimiki
    controller.onAudioChunk(
      {
        chars: ['Z'],
        char_start_times_ms: [0],
        char_durations_ms: [80],
      },
      10.5,
      0 // epoka 0
    );
    expect(controller.getQueueLength()).toBe(0);

    // 4. Nowy, prawidłowy chunk z epoki 1 zostaje pomyślnie zaakceptowany
    const newPcm = new Uint8Array(22050);
    const newStart = engine.playChunk(newPcm, 44100, 1); // epoka 1
    expect(newStart).toBeGreaterThan(0);
    expect(engine.getActiveNodesCount()).toBe(1);

    controller.onAudioChunk(
      {
        chars: ['N', 'e', 'w'],
        char_start_times_ms: [0, 50, 100],
        char_durations_ms: [50, 50, 80],
      },
      newStart,
      1 // epoka 1
    );
    expect(controller.getQueueLength()).toBe(3);
    expect(controller.getState()).toBe('SPEAKING');
  });
});
