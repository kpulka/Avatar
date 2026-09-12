import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelemetryManager } from '../src/prod/telemetry';
import { AudioEngine } from '../src/audio/audio-engine';

class MockAudioContext {
  public currentTime = 0;
  public state = 'running';
  public createGain() {
    return { gain: { value: 1, setValueAtTime: vi.fn() }, connect: vi.fn() };
  }
}

describe('Telemetry & Resilience (ROB-02)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('accurately measures TTFB between utterance request and first audio chunk', () => {
    const telemetry = new TelemetryManager();

    telemetry.markUtteranceRequested();
    vi.advanceTimersByTime(140);

    const ttfb = telemetry.markFirstAudioChunk();
    expect(ttfb).toBe(140);

    const report = telemetry.getReport();
    expect(report.ttfbMs).toBe(140);
  });

  it('tracks barge-in interruption events and session duration', () => {
    const telemetry = new TelemetryManager();

    telemetry.recordBargeIn();
    telemetry.recordBargeIn();

    vi.advanceTimersByTime(65000); // 1 min 5 sec

    const report = telemetry.getReport();
    expect(report.bargeInCount).toBe(2);
    expect(telemetry.getFormattedSessionDuration()).toBe('01:05');
  });

  it('dynamically adapts prebuffer window in AudioEngine during network jitter', () => {
    const mockCtx = new MockAudioContext();
    const engine = new AudioEngine(mockCtx as unknown as AudioContext);

    expect(engine.getPrebufferSeconds()).toBe(0.08);

    // Występuje jitter sieciowy
    engine.bumpPrebufferForJitter();
    expect(engine.getPrebufferSeconds()).toBe(0.12);

    engine.bumpPrebufferForJitter();
    expect(engine.getPrebufferSeconds()).toBe(0.16);

    engine.bumpPrebufferForJitter();
    expect(engine.getPrebufferSeconds()).toBe(0.2); // clamp do 0.20s
  });
});
