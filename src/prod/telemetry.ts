export interface TelemetryReport {
  sessionDurationSec: number;
  fps: number;
  frameTimeMs: number;
  ttfbMs: number | null;
  bargeInCount: number;
  jitterEvents: number;
}

/**
 * Moduł telemetrii i analityki wydajności w czasie rzeczywistym (ROB-02, docs/0)
 */
export class TelemetryManager {
  private sessionStartTime: number;
  private currentFps = 60;
  private currentFrameTimeMs = 16.6;
  private utteranceStartTime: number | null = null;
  private lastTtfbMs: number | null = null;
  private bargeInCount = 0;
  private jitterEvents = 0;
  private alignmentElevenlabs = 0;
  private alignmentFallback = 0;
  private a2fRequests = 0;
  private lastA2fPredictMs: number | null = null;
  private lastA2fFrames: number | null = null;
  private a2fSource: 'local' | 'cloud' | null = null;

  constructor() {
    this.sessionStartTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  public markUtteranceRequested(): void {
    this.utteranceStartTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  public markFirstAudioChunk(): number | null {
    if (this.utteranceStartTime !== null) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this.lastTtfbMs = Math.round(now - this.utteranceStartTime);
      this.utteranceStartTime = null;
      return this.lastTtfbMs;
    }
    return null;
  }

  public recordBargeIn(): void {
    this.bargeInCount++;
  }

  public recordJitterEvent(): void {
    this.jitterEvents++;
  }

  /**
   * Zlicza chunk audio wg źródła alignmentu ('elevenlabs' vs 'energy-fallback') — LIPS-07
   */
  public recordAlignmentChunk(source: 'elevenlabs' | 'energy-fallback' | string): void {
    if (source === 'energy-fallback') {
      this.alignmentFallback++;
    } else {
      this.alignmentElevenlabs++;
    }
  }

  public getAlignmentStats(): { elevenlabs: number; fallback: number } {
    return { elevenlabs: this.alignmentElevenlabs, fallback: this.alignmentFallback };
  }

  /**
   * Rejestruje predict A2F (09-03/09-04): czas /predict, liczba ramek, źródło.
   */
  public recordA2fRequest(info: { predictMs: number; frames: number; source: 'local' | 'cloud' }): void {
    this.a2fRequests++;
    this.lastA2fPredictMs = info.predictMs;
    this.lastA2fFrames = info.frames;
    this.a2fSource = info.source;
  }

  public getA2fStats(): {
    requests: number;
    lastPredictMs: number | null;
    lastFrames: number | null;
    source: 'local' | 'cloud' | null;
  } {
    return {
      requests: this.a2fRequests,
      lastPredictMs: this.lastA2fPredictMs,
      lastFrames: this.lastA2fFrames,
      source: this.a2fSource,
    };
  }

  public updateFps(fps: number, frameTimeMs: number): void {
    this.currentFps = fps;
    this.currentFrameTimeMs = frameTimeMs;
  }

  public getSessionDurationSec(): number {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return Math.floor((now - this.sessionStartTime) / 1000);
  }

  public getFormattedSessionDuration(): string {
    const totalSec = this.getSessionDurationSec();
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  public getReport(): TelemetryReport {
    return {
      sessionDurationSec: this.getSessionDurationSec(),
      fps: this.currentFps,
      frameTimeMs: this.currentFrameTimeMs,
      ttfbMs: this.lastTtfbMs,
      bargeInCount: this.bargeInCount,
      jitterEvents: this.jitterEvents,
    };
  }

  public reset(): void {
    this.sessionStartTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.utteranceStartTime = null;
    this.lastTtfbMs = null;
    this.bargeInCount = 0;
    this.jitterEvents = 0;
    this.alignmentElevenlabs = 0;
    this.alignmentFallback = 0;
    this.a2fRequests = 0;
    this.lastA2fPredictMs = null;
    this.lastA2fFrames = null;
    this.a2fSource = null;
  }
}
