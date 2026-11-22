import { CalibrationProfile, DEFAULT_CALIBRATION_PROFILE } from './calibration';

export interface VisemeQueueItem {
  epoch: number;
  shapes: Map<string, number>;
  startTimeSec: number;
  durationSec: number;
  char: string;
}

export interface SchedulerOptions {
  lambda?: number; // Reaction speed of the mouth muscles (default 18 [1/s])
  blendInSec?: number; // Blend-in time (default 35ms)
  blendOutSec?: number; // Blend-out time (default 45ms)
  calibrationProfile?: Partial<CalibrationProfile>;
}

/**
 * Speech viseme scheduling and coarticulation engine (docs/3)
 */

/** Hard ceiling of the effective mouthClose — protects MetaPerson from the "lip on the nose" deformation. */
const CLOSE_SAFETY_CAP = 0.85;

/** Effective mouthPress of a full bilabial (M/B/P) under the balanced preset (Phase 11.2 SHOW-06). */
const PRESS_REF = 0.35;

export class VisemeScheduler {
  private queue: VisemeQueueItem[] = [];
  /** Coarticulation lambda base [1/s] — mirrors profile.coarticulationSpeed (LIPS-06);
   *  the smoothing loop uses the per-group lambdaForShape tiers. */
  private lambda: number;
  private readonly blendInSec: number;
  private readonly blendOutSec: number;
  private profile: CalibrationProfile = { ...DEFAULT_CALIBRATION_PROFILE };

  // Smoothed weights of the current frame (shape -> weight)
  private readonly currentWeights: Map<string, number> = new Map();

  constructor(options: SchedulerOptions = {}) {
    if (options.calibrationProfile) {
      this.profile = { ...this.profile, ...options.calibrationProfile };
    }
    this.lambda = options.lambda ?? this.profile.coarticulationSpeed ?? 18;
    this.blendInSec = options.blendInSec ?? 0.035;
    this.blendOutSec = options.blendOutSec ?? 0.045;
  }

  public setCalibrationProfile(profile: Partial<CalibrationProfile>): void {
    this.profile = { ...this.profile, ...profile };
    if (profile.coarticulationSpeed !== undefined) {
      this.lambda = profile.coarticulationSpeed;
    }
  }

  public getCalibrationProfile(): CalibrationProfile {
    return { ...this.profile };
  }

  public enqueue(item: VisemeQueueItem): void {
    this.queue.push(item);
  }

  public clear(): void {
    this.queue = [];
  }

  public purgeStaleEpochs(activeEpoch: number): void {
    this.queue = this.queue.filter((item) => item.epoch === activeEpoch);
  }

  /**
   * Main coarticulation step, invoked every frame (dt in seconds)
   * Returns the map of updated weights for all speech keys.
   */
  public update(
    nowSec: number,
    dt: number,
    activeEpoch: number,
    speechShapes: string[]
  ): Map<string, number> {
    const targets = new Map<string, number>();

    // 1. Drop expired queue items
    this.queue = this.queue.filter((item) => {
      if (item.epoch !== activeEpoch) return false;
      return nowSec <= item.startTimeSec + item.durationSec + this.blendOutSec;
    });

    let activeMouthClose = 0;
    let activePress = 0;

    // 2. Sum the contributions of active visemes (additive blending capped at 1.0)
    for (const item of this.queue) {
      if (item.epoch !== activeEpoch) continue;

      const elapsed = nowSec - item.startTimeSec;
      if (elapsed < -this.blendInSec || elapsed > item.durationSec + this.blendOutSec) continue;

      const weight = this.computeEasing(elapsed, item.durationSec);

      for (const [shape, maxVal] of item.shapes.entries()) {
        // Viseme table values (docs/3) are EFFECTIVE values (LIPS-06):
        // the scheduler multiplies them EXACTLY ONCE by the taste multiplier of the calibration profile.
        // All other shapes (tongueOut etc.) get no extra damping (1.0).
        const contribution = maxVal * this.scaleForShape(shape) * weight;
        const currentTarget = targets.get(shape) ?? 0;
        targets.set(shape, Math.max(currentTarget, contribution));

        if (shape === 'mouthClose') {
          activeMouthClose = Math.max(activeMouthClose, targets.get(shape)!);
        } else if (shape === 'mouthPressLeft') {
          activePress = Math.max(activePress, targets.get(shape)!);
        }
      }
    }

    // 3. Priority mouth closure: mouthClose AND lip press (press) damp jawOpen (LIPS-02).
    // Bilabials M/B/P have a low mouthClose (MetaPerson), so closeRatio alone would weaken
    // the jaw damping after the previous vowel — press (Phase 11.2 SHOW-06) complements it.
    if (activeMouthClose > 0.15 || activePress > 0.15) {
      const currentJaw = targets.get('jawOpen') ?? 0;
      const closeRatio = activeMouthClose / this.profile.closeScale;
      const pressRatio = activePress / PRESS_REF;
      const closure = Math.min(1, Math.max(closeRatio, pressRatio));
      targets.set('jawOpen', currentJaw * Math.max(0, 1 - closure * 0.95));
    }

    // 4. FPS-independent smoothing (exponential damping): alpha = 1 - exp(-lambda * dt)
    // Lambda is PER MUSCLE GROUP (closures fast, smile slow), base = coarticulationSpeed.
    const updated = new Map<string, number>();

    for (const shape of speechShapes) {
      if (shape.startsWith('eyeBlink')) continue;

      const alpha = 1 - Math.exp(-this.lambdaForShape(shape) * dt);

      // Foundation rule: no contribution -> target = 0.0 (decay to neutral)
      const target = targets.get(shape) ?? 0.0;
      const current = this.currentWeights.get(shape) ?? 0.0;
      const next = current + (target - current) * alpha;

      // If the weight is minimal (< 0.001), reset it to a hard 0
      const finalWeight = next < 0.001 ? 0 : next;
      this.currentWeights.set(shape, finalWeight);
      updated.set(shape, finalWeight);
    }

    return updated;
  }

  /**
   * Taste multiplier from the calibration profile for a single shape (LIPS-06).
   * Viseme table values are effective; the profile is a light taste correction around 1.0.
   */
  private scaleForShape(shape: string): number {
    const p = this.profile;
    if (shape === 'mouthClose' || shape === 'mouthPressLeft' || shape === 'mouthPressRight') {
      // MetaPerson safety: above ~0.85 the mouthClose morph pulls the lower lip onto the nose.
      // Hard ceiling — independent of the slider (default presets are set lower).
      return Math.min(p.closeScale, CLOSE_SAFETY_CAP);
    }
    if (shape === 'jawOpen') return p.jawScale;
    if (shape.startsWith('mouthSmile')) return p.smileScale;
    if (shape === 'mouthPucker') return p.puckerScale;
    if (shape === 'mouthFunnel') return p.funnelScale;
    if (shape === 'mouthRollLower' || shape.startsWith('mouthShrug')) return p.rollScale;
    if (shape.startsWith('mouthUpperUp') || shape.startsWith('mouthLowerDown')) return p.teethExposureScale;
    return 1.0; // tongueOut and the rest — no extra damping
  }

  /**
   * Smoothing lambda per muscle group. Base = this.lambda — a mirror of
   * coarticulationSpeed from the profile (the constructor and setCalibrationProfile
   * keep both in sync; default 18). Short EN consonants (closures of 40-80 ms)
   * must have time to reach their shape, while the speech smile should return slowly (docs/3).
   */
  private lambdaForShape(shape: string): number {
    const cs = this.lambda; // base = the profile's coarticulationSpeed, default 18
    if (shape === 'mouthClose' || shape === 'mouthPressLeft' || shape === 'mouthPressRight') return cs * 1.7;
    if (shape === 'jawOpen' || shape === 'tongueOut') return cs * 1.55;
    if (shape.startsWith('mouthSmile')) return cs * 0.45;
    return cs; // pucker, funnel, roll, shrug, upperUp, lowerDown
  }

  /**
   * Computes the weight from cosine blend-in, hold and blend-out
   */
  public computeEasing(elapsed: number, duration: number): number {
    if (elapsed < 0) {
      // Blend-in
      const t = (elapsed + this.blendInSec) / this.blendInSec;
      return Math.sin((Math.max(0, Math.min(1, t)) * Math.PI) / 2);
    }

    if (elapsed <= duration) {
      // Hold
      return 1.0;
    }

    // Blend-out
    const outElapsed = elapsed - duration;
    const t = 1 - outElapsed / this.blendOutSec;
    return Math.sin((Math.max(0, Math.min(1, t)) * Math.PI) / 2);
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public getWeight(shape: string): number {
    return this.currentWeights.get(shape) ?? 0;
  }

  public resetAll(): void {
    this.currentWeights.clear();
    this.queue = [];
  }
}
