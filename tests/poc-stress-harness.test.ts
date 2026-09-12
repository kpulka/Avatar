import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
      'mouthRollLower',
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
  public startTime = 0;
  public buffer: { duration: number } | null = null;

  public connect(): void {}
  public disconnect(): void {
    this.disconnected = true;
  }
  public start(t = 0): void {
    this.startTime = t;
  }
  public stop(): void {
    this.stopped = true;
    if (this.onended) this.onended();
  }
  public checkEnded(now: number): void {
    const duration = this.buffer?.duration ?? 1.0;
    if (!this.stopped && now >= this.startTime + duration) {
      this.stopped = true;
      if (this.onended) this.onended();
    }
  }
}

class MockAudioContext {
  public currentTime = 0;
  public state = 'running';
  public sources: MockAudioBufferSourceNode[] = [];

  public createGain() {
    return { gain: { value: 1, setValueAtTime: vi.fn() }, connect: vi.fn() };
  }
  public createBuffer(channels: number, length: number, sampleRate: number) {
    return { duration: length / sampleRate, copyToChannel: vi.fn() };
  }
  public createBufferSource() {
    const src = new MockAudioBufferSourceNode();
    this.sources.push(src);
    return src;
  }

  public advanceTime(dt: number): void {
    this.currentTime += dt;
    for (const src of this.sources) {
      src.checkEnded(this.currentTime);
    }
  }
}

describe('PoC Stress Test Harness (5 Phased Interruptions & Leak-Free Lifecycle)', () => {
  let driver: MockFaceDriver;
  let mockCtx: MockAudioContext;
  let engine: AudioEngine;
  let controller: FaceController;

  beforeEach(() => {
    driver = new MockFaceDriver();
    mockCtx = new MockAudioContext();
    engine = new AudioEngine(mockCtx as unknown as AudioContext);
    controller = new FaceController(driver, engine);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs 5 rapid speech utterances with interruptions across varied phonetic phases with 0 node leaks', () => {
    const speechChunks = [
      // 1. Przerwanie podczas blend-in (t = 30ms)
      {
        chars: ['h', 'e', 'l', 'l', 'o'],
        interruptAtMs: 30,
      },
      // 2. Przerwanie w szczycie otwartej samogłoski 'A'
      {
        chars: ['a', 'h', 'h', 'h'],
        interruptAtMs: 80,
      },
      // 3. Przerwanie podczas pełnego domknięcia warg 'M' (mouthClose: 1.0)
      {
        chars: ['m', 'o', 'm'],
        interruptAtMs: 40,
      },
      // 4. Przerwanie i natychmiastowa kolejna mowa
      {
        chars: ['q', 'u', 'i', 'c', 'k'],
        interruptAtMs: 60,
      },
      // 5. Pełna wypowiedź bez przerwania (do naturalnego wygaszenia)
      {
        chars: ['d', 'o', 'n', 'e'],
        interruptAtMs: -1, // brak przerwania
      },
    ];

    for (let i = 0; i < speechChunks.length; i++) {
      const scenario = speechChunks[i];
      const epoch = engine.getEpoch();

      // Start wypowiedzi
      const pcm = new Uint8Array(44100 * 2); // 1 sekunda audio
      const scheduledStart = engine.playChunk(pcm, 44100, epoch);

      controller.onAudioChunk(
        {
          chars: scenario.chars,
          char_start_times_ms: scenario.chars.map((_, idx) => idx * 60),
          char_durations_ms: scenario.chars.map(() => 60),
        },
        scheduledStart,
        epoch
      );

      expect(controller.getState()).toBe('SPEAKING');

      // Animujemy przez klika klatek
      for (let f = 0; f < 5; f++) {
        mockCtx.advanceTime(0.016);
        controller.render(0.016);
      }

      if (scenario.interruptAtMs > 0) {
        // Występuje przerwanie w zadanej milisekundzie
        mockCtx.advanceTime(scenario.interruptAtMs / 1000);
        engine.hardStop();
        controller.onInterruption();

        expect(controller.getState()).toBe('RELAXING');
        expect(engine.getActiveNodesCount()).toBe(0);

        // Odczekaj czas relaksacji (160ms)
        vi.advanceTimersByTime(160);
        controller.render(0.016);
        expect(controller.getState()).toBe('IDLE');
      } else {
        // Naturalne zakończenie wypowiedzi
        mockCtx.advanceTime(2.0); // koniec audio
        vi.advanceTimersByTime(2000);
        controller.render(0.016);

        // Po wygaszeniu stan powinien być IDLE
        vi.advanceTimersByTime(200);
        controller.render(0.016);
        expect(controller.getState()).toBe('IDLE');
      }
    }

    // Weryfikacja końcowa całego testu obciążeniowego
    expect(engine.getActiveNodesCount()).toBe(0);
    expect(engine.hasPendingAudio()).toBe(false);
    expect(controller.getState()).toBe('IDLE');

    // Reguła fundamentu: wszystkie wagi mowy muszą być bezwzględnie 0.0
    for (const shape of driver.listAvailableShapes()) {
      if (shape.startsWith('eyeBlink')) continue;
      expect(controller.getCurrentWeight(shape)).toBe(0.0);
    }
  });
});
