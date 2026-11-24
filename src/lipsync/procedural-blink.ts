import { ANIM_DEFAULTS } from './anim-config';

const { blink: blinkConfig } = ANIM_DEFAULTS;

export interface BlinkWeights {
  left: number;
  right: number;
}

export interface BlinkOptions {
  minIntervalSec?: number; // Minimum interval between blinks (default blink.intervalMinSec)
  maxIntervalSec?: number; // Maximum interval (default blink.intervalMaxSec)
  closeDurationSec?: number; // Eyelid closing time (default blink.closeSec)
  openDurationSec?: number; // Eyelid opening time (default blink.openSec)
}

/**
 * Procedural generator of natural eyelid blinking (docs/3, docs/6)
 */
export class ProceduralBlink {
  private readonly minIntervalSec: number;
  private readonly maxIntervalSec: number;
  private readonly closeDurationSec: number;
  private readonly openDurationSec: number;
  private readonly totalBlinkDurationSec: number;

  // Reused result (BORROWED until the next update(); single consumer: FaceController.render).
  private readonly result: BlinkWeights = { left: 0, right: 0 };

  private nextBlinkTimeSec = 0;
  private isBlinking = false;
  private blinkStartTimeSec = 0;
  private isDoubleBlink = false;

  constructor(options: BlinkOptions = {}) {
    this.minIntervalSec = options.minIntervalSec ?? blinkConfig.intervalMinSec;
    this.maxIntervalSec = options.maxIntervalSec ?? blinkConfig.intervalMaxSec;
    this.closeDurationSec = options.closeDurationSec ?? blinkConfig.closeSec;
    this.openDurationSec = options.openDurationSec ?? blinkConfig.openSec;
    this.totalBlinkDurationSec = this.closeDurationSec + this.openDurationSec;

    this.scheduleNextBlink(0);
  }

  public scheduleNextBlink(currentTimeSec: number, delayBonus = 0): void {
    const range = this.maxIntervalSec - this.minIntervalSec;
    const interval = this.minIntervalSec + Math.random() * range + delayBonus;
    this.nextBlinkTimeSec = currentTimeSec + interval;
    // A chance of a double blink (a natural biological reflex)
    this.isDoubleBlink = Math.random() < blinkConfig.doubleBlinkChance;
  }

  /**
   * Returns the blink weights [0.0, 1.0] for the current point in time.
   * BORROWED: the returned object is reused on the next call — read it immediately.
   */
  public update(currentTimeSec: number): BlinkWeights {
    if (!this.isBlinking) {
      if (currentTimeSec >= this.nextBlinkTimeSec) {
        this.isBlinking = true;
        this.blinkStartTimeSec = currentTimeSec;
      } else {
        return this.setResult(0, 0);
      }
    }

    const elapsed = currentTimeSec - this.blinkStartTimeSec;

    if (elapsed >= this.totalBlinkDurationSec) {
      this.isBlinking = false;
      if (this.isDoubleBlink) {
        this.isDoubleBlink = false;
        // Second blink after a short pause
        this.nextBlinkTimeSec = currentTimeSec + blinkConfig.doubleBlinkPauseSec;
      } else {
        this.scheduleNextBlink(currentTimeSec);
      }
      return this.setResult(0, 0);
    }

    // Compute the blink weight
    let weight = 0;
    if (elapsed < this.closeDurationSec) {
      // Phase 1: fast closing (80ms)
      const t = elapsed / this.closeDurationSec;
      weight = Math.sin((t * Math.PI) / 2); // 0 -> 1
    } else {
      // Phase 2: smooth opening (200ms)
      const t = (elapsed - this.closeDurationSec) / this.openDurationSec;
      weight = Math.cos((t * Math.PI) / 2); // 1 -> 0
    }

    const clamped = Math.max(0, Math.min(1, weight));

    // Subtle eyelid asymmetry for extra realism
    return this.setResult(clamped, Math.max(0, Math.min(1, clamped * blinkConfig.rightScale)));
  }

  private setResult(left: number, right: number): BlinkWeights {
    this.result.left = left;
    this.result.right = right;
    return this.result;
  }

  public forceBlink(currentTimeSec: number): void {
    this.isBlinking = true;
    this.blinkStartTimeSec = currentTimeSec;
  }
}
