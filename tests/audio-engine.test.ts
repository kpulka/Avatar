import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioEngine } from '../src/audio/audio-engine';

class MockAudioBuffer {
  public length: number;
  public sampleRate: number;
  public duration: number;
  private channelData: Float32Array;

  constructor(channels: number, length: number, sampleRate: number) {
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this.channelData = new Float32Array(length);
  }

  public copyToChannel(source: Float32Array, channel: number): void {
    this.channelData.set(source);
  }
}

class MockAudioBufferSourceNode {
  public buffer: MockAudioBuffer | null = null;
  public startTime = 0;
  public onended: (() => void) | null = null;
  public stopped = false;
  public disconnected = false;

  public connect(): void {}
  public disconnect(): void {
    this.disconnected = true;
  }
  public start(time: number): void {
    this.startTime = time;
  }
  public stop(): void {
    this.stopped = true;
  }
}

class MockGainNode {
  public gain = {
    value: 1,
    setValueAtTime: vi.fn(),
  };
  public connect(): void {}
}

class MockAudioContext {
  public currentTime = 1.0;
  public state = 'running';
  public sampleRate = 44100;
  public destination = {};

  public createGain(): MockGainNode {
    return new MockGainNode();
  }

  public createBuffer(channels: number, length: number, sampleRate: number): MockAudioBuffer {
    return new MockAudioBuffer(channels, length, sampleRate);
  }

  public createBufferSource(): MockAudioBufferSourceNode {
    return new MockAudioBufferSourceNode();
  }

  public async resume(): Promise<void> {
    this.state = 'running';
  }
}

describe('AudioEngine', () => {
  let mockCtx: MockAudioContext;
  let engine: AudioEngine;

  beforeEach(() => {
    mockCtx = new MockAudioContext();
    engine = new AudioEngine(mockCtx as unknown as AudioContext);
  });

  it('schedules audio chunk gapless with prebuffer', () => {
    // 4410 próbek = 0.1s przy 44.1kHz (Int16 to 8820 bajtów)
    const pcmBytes = new Uint8Array(8820);
    const scheduledStart = engine.playChunk(pcmBytes, 44100);

    // currentTime (1.0) + prebuffer (0.08) = 1.08
    expect(scheduledStart).toBeCloseTo(1.08);
    expect(engine.getTailTime()).toBeCloseTo(1.18); // 1.08 + 0.1s
    expect(engine.getActiveNodesCount()).toBe(1);
  });

  it('schedules consecutive chunks gaplessly against tailTime', () => {
    const chunk1 = new Uint8Array(8820); // 0.1s
    const chunk2 = new Uint8Array(8820); // 0.1s

    const start1 = engine.playChunk(chunk1, 44100);
    const start2 = engine.playChunk(chunk2, 44100);

    expect(start1).toBeCloseTo(1.08);
    // start drugiego chunka powinien zaczynać się DOKŁADNIE tam gdzie kończy pierwszy
    expect(start2).toBeCloseTo(1.18);
    expect(engine.getTailTime()).toBeCloseTo(1.28);
    expect(engine.getActiveNodesCount()).toBe(2);
  });

  it('hardStop() stops all active nodes, resets tailTime and increments epoch', () => {
    const chunk = new Uint8Array(8820);
    engine.playChunk(chunk, 44100);
    expect(engine.getEpoch()).toBe(0);
    expect(engine.getActiveNodesCount()).toBe(1);

    engine.hardStop();

    expect(engine.getEpoch()).toBe(1);
    expect(engine.getTailTime()).toBe(0);
    expect(engine.getActiveNodesCount()).toBe(0);
  });

  it('rejects stale chunks matching previous epoch', () => {
    const staleEpoch = engine.getEpoch();
    engine.hardStop(); // epoch++ -> 1

    const chunk = new Uint8Array(8820);
    const scheduled = engine.playChunk(chunk, 44100, staleEpoch);

    // Powinno zostać zignorowane
    expect(scheduled).toBe(0);
    expect(engine.getActiveNodesCount()).toBe(0);
  });
});
