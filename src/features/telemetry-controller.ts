/**
 * TelemetryController (Phase 11, 11-02) — the only place where telemetry is stamped.
 *
 * Subscribes to state events and feeds `TelemetryManager`; `sample()` delivers a
 * ready-made package for the render loop (legacy HUD or panels).
 */
import { TelemetryManager } from '../prod/telemetry';
import { TypedEventBus, Unsub } from '../app/events';
import { AppEvents, TelemetrySample } from '../app/app-types';

export class TelemetryController {
  private readonly subscriptions: Unsub[] = [];

  constructor(
    private readonly telemetry: TelemetryManager,
    events: TypedEventBus<AppEvents>
  ) {
    this.subscriptions.push(
      events.on('transcript:user', () => this.telemetry.markUtteranceRequested()),
      events.on('audio:chunk', (chunk) => {
        this.telemetry.markFirstAudioChunk();
        this.telemetry.recordAlignmentChunk(chunk.alignment.source ?? 'elevenlabs');
      }),
      events.on('speech:interruption', () => this.telemetry.recordBargeIn()),
      events.on('a2f:stats', (stats) => {
        if (stats.source === 'local' || stats.source === 'cloud') {
          this.telemetry.recordA2fRequest({
            predictMs: stats.predictMs ?? 0,
            frames: stats.frames ?? 0,
            source: stats.source,
          });
        }
      })
    );
  }

  public sample(): TelemetrySample {
    const report = this.telemetry.getReport();
    return {
      ttfbMs: report.ttfbMs,
      bargeInCount: report.bargeInCount,
      session: this.telemetry.getFormattedSessionDuration(),
      align: this.telemetry.getAlignmentStats(),
      fps: report.fps,
      frameTimeMs: report.frameTimeMs,
    };
  }

  public dispose(): void {
    for (const unsub of this.subscriptions.splice(0)) {
      unsub();
    }
  }
}
