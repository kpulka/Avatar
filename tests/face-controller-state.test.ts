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
    return ['jawOpen', 'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthSmileLeft', 'mouthSmileRight', 'eyeBlinkLeft', 'eyeBlinkRight'];
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

describe('FaceController State Machine', () => {
  let driver: MockFaceDriver;
  let engine: MockAudioEngine;
  let controller: FaceController;

  beforeEach(() => {
    driver = new MockFaceDriver();
    engine = new MockAudioEngine();
    controller = new FaceController(driver, engine as unknown as AudioEngine);
  });

  it('starts in IDLE state', () => {
    expect(controller.getState()).toBe('IDLE');
  });

  it('transitions from IDLE to SPEAKING on valid audio chunk', () => {
    controller.onAudioChunk(
      {
        chars: ['H', 'i'],
        char_start_times_ms: [0, 50],
        char_durations_ms: [50, 50],
      },
      0.0,
      0
    );

    expect(controller.getState()).toBe('SPEAKING');
    expect(controller.getQueueLength()).toBe(2);
  });

  it('rejects chunks with outdated epoch', () => {
    engine.epoch = 2; // Server/engine is on epoch 2

    controller.onAudioChunk(
      {
        chars: ['O', 'l', 'd'],
        char_start_times_ms: [0, 50, 100],
        char_durations_ms: [50, 50, 50],
      },
      0.0,
      1 // Stale chunk from epoch 1
    );

    expect(controller.getState()).toBe('IDLE');
    expect(controller.getQueueLength()).toBe(0);
  });

  it('transitions immediately to RELAXING on interruption and clears queue', () => {
    controller.onAudioChunk(
      {
        chars: ['A', 'B', 'C'],
        char_start_times_ms: [0, 50, 100],
        char_durations_ms: [50, 50, 50],
      },
      0.0,
      0
    );

    expect(controller.getQueueLength()).toBe(3);

    controller.onInterruption();

    expect(controller.getState()).toBe('RELAXING');
    expect(controller.getQueueLength()).toBe(0);
  });

  it('energy-fallback moves only the jaw (jawOpen > 0, rest 0)', () => {
    // Chunk from the acoustic fallback: energy in window 1, silence in window 2.
    controller.onAudioChunk(
      {
        chars: [' ', ' '],
        char_start_times_ms: [0, 70],
        char_durations_ms: [70, 70],
        source: 'energy-fallback',
        energies: [0.5, 0.0],
      },
      -0.12, // compensates the default syncOffset +100ms so the window is active at render(0)
      0
    );

    expect(controller.getState()).toBe('SPEAKING');
    // Only the window with energy > 0.02 enters the queue
    expect(controller.getQueueLength()).toBe(1);

    // Render at window start: jawOpen active, other speech shapes = 0
    controller.render(0.016);

    expect(driver.appliedWeights['jawOpen']).toBeGreaterThan(0);
    expect(driver.appliedWeights['mouthPucker'] ?? 0).toBe(0);
    expect(driver.appliedWeights['mouthSmileLeft'] ?? 0).toBe(0);
  });
});
