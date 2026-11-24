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
  public createBuffer(_channels: number, length: number, sampleRate: number) {
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
  let wallMs = 0; // hand-driven wall clock (injected nowMs) — no fake timers

  beforeEach(() => {
    wallMs = 0;
    driver = new MockFaceDriver();
    mockCtx = new MockAudioContext();
    engine = new AudioEngine(mockCtx as unknown as AudioContext);
    controller = new FaceController(driver, engine, { nowMs: () => wallMs });
  });

  it('immediately stops audio and starts facial relaxation upon interruption', () => {
    // 1. Start audio playback
    const pcmChunk = new Uint8Array(44100);
    engine.playChunk(pcmChunk, 44100, 0);

    expect(engine.getActiveNodesCount()).toBe(1);
    expect(engine.getTailTime()).toBeGreaterThan(5.0);

    // 2. Add visemes to the FaceController
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
    expect(controller.getVisemeQueueLength()).toBe(5);

    // 3. The interruption event occurs (barge-in)
    engine.hardStop();
    controller.onInterruption();

    // Verify INT-01: audio stops immediately, time tail zeroed, epoch incremented
    expect(engine.getActiveNodesCount()).toBe(0);
    expect(engine.getTailTime()).toBe(0);
    expect(engine.getEpoch()).toBe(1);

    // Verify INT-02: the expression moves to RELAXING, the viseme queue is cleared
    expect(controller.getState()).toBe('RELAXING');
    expect(controller.getVisemeQueueLength()).toBe(0);

    // 4. After the relax duration (160 ms on the injected wall clock) the face reaches IDLE
    wallMs += 160;
    controller.render(0.016);

    expect(controller.getState()).toBe('IDLE');
    expect(controller.getCurrentWeight('jawOpen')).toBe(0);
  });
});
