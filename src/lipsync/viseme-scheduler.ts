import { CalibrationProfile, DEFAULT_CALIBRATION_PROFILE } from './calibration';
import { ANIM_DEFAULTS } from './anim-config';

const { viseme: visemeConfig, common } = ANIM_DEFAULTS;

export interface VisemeQueueItem {
  epoch: number;
  shapes: Map<string, number>;
  startTimeSec: number;
  durationSec: number;
  char: string;
}

export interface SchedulerOptions {
  lambda?: number; // Reaction speed of the mouth muscles [1/s] (default: profile.coarticulationSpeed)
  blendInSec?: number; // Blend-in time (default viseme.blendInSec)
  blendOutSec?: number; // Blend-out time (default viseme.blendOutSec)
  calibrationProfile?: Partial<CalibrationProfile>;
}

/**
 * Speech viseme scheduling and coarticulation engine (docs/3)
 */

/**
 * Shape families visemes legitimately own. FaceController hands the scheduler ONLY these, so its
 * foundation rule (no contribution -> decay to 0) cannot clobber eye (gaze/blink) or brow
 * (emotion) regions.
 */
export const SPEECH_SHAPE_FAMILIES = ['jaw', 'mouth', 'tongue', 'cheek', 'nose'] as const;

export function isSpeechShape(shape: string): boolean {
  for (const family of SPEECH_SHAPE_FAMILIES) {
    if (shape.startsWith(family)) return true;
  }
  return false;
}

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

  // Per-frame scratch structures, reused (cleared, never reallocated) so update() allocates nothing.
  private readonly scratchTargets: Map<string, number> = new Map();
  private readonly scratchUpdated: Map<string, number> = new Map();

  constructor(options: SchedulerOptions = {}) {
    if (options.calibrationProfile) {
      this.profile = { ...this.profile, ...options.calibrationProfile };
    }
    this.lambda = options.lambda ?? this.profile.coarticulationSpeed;
    this.blendInSec = options.blendInSec ?? visemeConfig.blendInSec;
    this.blendOutSec = options.blendOutSec ?? visemeConfig.blendOutSec;
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
    this.queue.length = 0;
  }

  /**
   * Main coarticulation step, invoked every frame (dt in seconds)
   * Returns the map of updated weights for all speech keys.
   * BORROWED: the returned Map is a reused scratch instance — valid until the next update() call;
   * copy it if you need to keep it.
   */
  public update(
    nowSec: number,
    dt: number,
    activeEpoch: number,
    speechShapes: string[]
  ): Map<string, number> {
    const targets = this.scratchTargets;
    targets.clear();

    // 1. Drop expired queue items — in-place compaction (write index), no filter() copy.
    const queue = this.queue;
    let write = 0;
    for (let read = 0; read < queue.length; read++) {
      const item = queue[read];
      if (!item) continue; // read < queue.length
      if (item.epoch !== activeEpoch) continue;
      if (nowSec > item.startTimeSec + item.durationSec + this.blendOutSec) continue;
      queue[write++] = item;
    }
    queue.length = write;

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
    if (activeMouthClose > visemeConfig.closeJawThreshold || activePress > visemeConfig.closeJawThreshold) {
      const currentJaw = targets.get('jawOpen') ?? 0;
      const closeRatio = activeMouthClose / this.profile.closeScale;
      const pressRatio = activePress / visemeConfig.pressRef;
      const closure = Math.min(1, Math.max(closeRatio, pressRatio));
      targets.set('jawOpen', currentJaw * Math.max(0, 1 - closure * visemeConfig.closeJawFactor));
    }

    // 4. FPS-independent smoothing (exponential damping): alpha = 1 - exp(-lambda * dt)
    // Lambda is PER MUSCLE GROUP (closures fast, smile slow), base = coarticulationSpeed.
    const updated = this.scratchUpdated;
    updated.clear();

    for (const shape of speechShapes) {
      if (shape.startsWith('eyeBlink')) continue;

      const alpha = 1 - Math.exp(-this.lambdaForShape(shape) * dt);

      // Foundation rule: no contribution -> target = 0.0 (decay to neutral)
      const target = targets.get(shape) ?? 0.0;
      const current = this.currentWeights.get(shape) ?? 0.0;
      const next = current + (target - current) * alpha;

      // If the weight is minimal (< snapEpsilon), reset it to a hard 0
      const finalWeight = next < common.snapEpsilon ? 0 : next;
      this.currentWeights.set(shape, finalWeight);
      updated.set(shape, finalWeight);
    }

    return updated;
  }

  /**
   * Taste multiplier from the calibration profile for a single shape (LIPS-06).
   * Viseme table values are effective; the profile is a light taste correction around 1.0.
   */
  public scaleForShape(shape: string): number {
    const p = this.profile;
    if (shape === 'mouthClose' || shape === 'mouthPressLeft' || shape === 'mouthPressRight') {
      // MetaPerson safety: above ~0.85 the mouthClose morph pulls the lower lip onto the nose.
      // Hard ceiling — independent of the slider (default presets are set lower).
      return Math.min(p.closeScale, common.mouthCloseCap);
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
   * keep both in sync). Short EN consonants (closures of 40-80 ms)
   * must have time to reach their shape, while the speech smile should return slowly (docs/3).
   */
  private lambdaForShape(shape: string): number {
    const cs = this.lambda; // base = the profile's coarticulationSpeed
    const tiers = visemeConfig.lambdaTiers;
    if (shape === 'mouthClose' || shape === 'mouthPressLeft' || shape === 'mouthPressRight') return cs * tiers.closure;
    if (shape === 'jawOpen' || shape === 'tongueOut') return cs * tiers.jawTongue;
    if (shape.startsWith('mouthSmile')) return cs * tiers.smile;
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
    this.queue.length = 0;
  }
}
