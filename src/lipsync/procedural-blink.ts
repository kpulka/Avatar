export interface BlinkWeights {
  left: number;
  right: number;
}

export interface BlinkOptions {
  minIntervalSec?: number; // Minimalny odstęp między mrugnięciami (domyślnie 2.5s)
  maxIntervalSec?: number; // Maksymalny odstęp (domyślnie 6.0s)
  closeDurationSec?: number; // Czas zamykania powiek (domyślnie 80ms)
  openDurationSec?: number; // Czas otwierania powiek (domyślnie 200ms)
}

/**
 * Proceduralny generator naturalnego mrugania powiekami (docs/3, docs/6)
 */
export class ProceduralBlink {
  private readonly minIntervalSec: number;
  private readonly maxIntervalSec: number;
  private readonly closeDurationSec: number;
  private readonly openDurationSec: number;
  private readonly totalBlinkDurationSec: number;

  private nextBlinkTimeSec = 0;
  private isBlinking = false;
  private blinkStartTimeSec = 0;
  private isDoubleBlink = false;

  constructor(options: BlinkOptions = {}) {
    this.minIntervalSec = options.minIntervalSec ?? 2.5;
    this.maxIntervalSec = options.maxIntervalSec ?? 6.0;
    this.closeDurationSec = options.closeDurationSec ?? 0.08; // 80ms
    this.openDurationSec = options.openDurationSec ?? 0.2; // 200ms
    this.totalBlinkDurationSec = this.closeDurationSec + this.openDurationSec; // 280ms

    this.scheduleNextBlink(0);
  }

  public scheduleNextBlink(currentTimeSec: number, delayBonus = 0): void {
    const range = this.maxIntervalSec - this.minIntervalSec;
    const interval = this.minIntervalSec + Math.random() * range + delayBonus;
    this.nextBlinkTimeSec = currentTimeSec + interval;
    // 15% szansy na podwójne mrugnięcie (naturalny biologiczny odruch)
    this.isDoubleBlink = Math.random() < 0.15;
  }

  /**
   * Zwraca wagi mrugania [0.0, 1.0] dla bieżącej chwili czasowej
   */
  public update(currentTimeSec: number): BlinkWeights {
    if (!this.isBlinking) {
      if (currentTimeSec >= this.nextBlinkTimeSec) {
        this.isBlinking = true;
        this.blinkStartTimeSec = currentTimeSec;
      } else {
        return { left: 0, right: 0 };
      }
    }

    const elapsed = currentTimeSec - this.blinkStartTimeSec;

    if (elapsed >= this.totalBlinkDurationSec) {
      this.isBlinking = false;
      if (this.isDoubleBlink) {
        this.isDoubleBlink = false;
        // Drugie mrugnięcie po krótkiej pauzie ~100ms
        this.nextBlinkTimeSec = currentTimeSec + 0.1;
      } else {
        this.scheduleNextBlink(currentTimeSec);
      }
      return { left: 0, right: 0 };
    }

    // Obliczenie wagi mrugnięcia
    let weight = 0;
    if (elapsed < this.closeDurationSec) {
      // Faza 1: Szybkie zamykanie (80ms)
      const t = elapsed / this.closeDurationSec;
      weight = Math.sin((t * Math.PI) / 2); // 0 -> 1
    } else {
      // Faza 2: Płynne otwieranie (200ms)
      const t = (elapsed - this.closeDurationSec) / this.openDurationSec;
      weight = Math.cos((t * Math.PI) / 2); // 1 -> 0
    }

    const clamped = Math.max(0, Math.min(1, weight));

    // Subtelna asymetria powiek (~2%) dla wyższego realizmu
    return {
      left: clamped,
      right: Math.max(0, Math.min(1, clamped * 0.98)),
    };
  }

  public forceBlink(currentTimeSec: number): void {
    this.isBlinking = true;
    this.blinkStartTimeSec = currentTimeSec;
  }
}
