export interface AdaptiveResolutionOptions {
  min: number;
  max: number;
  step: number;
  lowFps: number;
  highFps: number;
  lowForMs: number;
  highForMs: number;
  holdMs: number;
}

/**
 * Pure pixel-ratio governor. Feed it the 500 ms FPS samples; it returns a new ratio or null (no change).
 * Below `lowFps` for `lowForMs` -> ratio - step (floor `min`); above `highFps` for `highForMs` -> ratio + step
 * (cap `max`); `holdMs` of silence after every change.
 */
export class AdaptiveResolution {
  private ratio: number;
  private lowSince: number | null = null;
  private highSince: number | null = null;
  private holdUntil = 0;

  constructor(private readonly o: AdaptiveResolutionOptions) {
    this.ratio = o.max;
  }

  static create(max: number): AdaptiveResolution {
    return new AdaptiveResolution({
      min: 1,
      max,
      step: 0.25,
      lowFps: 50,
      highFps: 58,
      lowForMs: 2000,
      highForMs: 4000,
      holdMs: 3000,
    });
  }

  get current(): number {
    return this.ratio;
  }

  update(fps: number, nowMs: number): number | null {
    if (nowMs < this.holdUntil) return null;
    this.lowSince = fps < this.o.lowFps ? (this.lowSince ?? nowMs) : null;
    this.highSince = fps > this.o.highFps ? (this.highSince ?? nowMs) : null;

    let next = this.ratio;
    if (this.lowSince !== null && nowMs - this.lowSince >= this.o.lowForMs) {
      next = Math.max(this.o.min, this.ratio - this.o.step);
    } else if (this.highSince !== null && nowMs - this.highSince >= this.o.highForMs) {
      next = Math.min(this.o.max, this.ratio + this.o.step);
    }
    if (next === this.ratio) return null;

    this.ratio = next;
    this.lowSince = null;
    this.highSince = null;
    this.holdUntil = nowMs + this.o.holdMs;
    return next;
  }
}
