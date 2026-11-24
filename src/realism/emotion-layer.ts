import { ANIM_DEFAULTS } from '../lipsync/anim-config';
import { allocProbe } from '../lipsync/alloc-probe';

const { emotion: emotionConfig } = ANIM_DEFAULTS;

export type EmotionType = 'neutral' | 'happy' | 'surprised' | 'focused';

export interface EmotionProfile {
  type: EmotionType;
  weights: Map<string, number>;
}

const EMOTION_PROFILES: Record<EmotionType, Map<string, number>> = {
  neutral: new Map(),
  happy: new Map([
    ['mouthSmileLeft', 0.22],
    ['mouthSmileRight', 0.22],
    ['cheekSquintLeft', 0.12],
    ['cheekSquintRight', 0.12],
  ]),
  surprised: new Map([
    ['browInnerUp', 0.25],
    ['eyeWideLeft', 0.15],
    ['eyeWideRight', 0.15],
  ]),
  focused: new Map([
    ['browDownLeft', 0.12],
    ['browDownRight', 0.12],
  ]),
};

/** Lexical sentiment keyword lists (module consts: no per-call array allocation). */
const HAPPY_KEYWORDS: readonly string[] = [
  'great',
  'happy',
  'wonderful',
  'glad',
  'awesome',
  'pleasure',
  'super',
  'dobrze',
  'świetnie',
  'nice',
  'love',
  'excellent',
  'welcome',
];
const SURPRISED_KEYWORDS: readonly string[] = [
  'wow',
  'really?',
  'amazing',
  'tell me',
  'interesting',
  'incredible',
  'surprise',
  'whoa',
  'extraordinary',
];
const FOCUSED_KEYWORDS: readonly string[] = [
  'think',
  'consider',
  'important',
  'problem',
  'solve',
  'let me',
  'analyzing',
  'focus',
  'critical',
];

/**
 * Emotion layer (EmotionLayer) analysing the utterance sentiment (REAL-03, docs/3, docs/5)
 */
export class EmotionLayer {
  private currentEmotion: EmotionType = 'neutral';
  private targetEmotion: EmotionType = 'neutral';

  // Current cross-fade weights
  private readonly activeWeights: Map<string, number> = new Map();
  private readonly crossFadeDurationSec = emotionConfig.crossFadeSec; // cross-fade between states
  private crossFadeElapsed = emotionConfig.crossFadeSec;

  /**
   * Analyses the utterance text for lexical sentiment
   */
  public analyzeText(text: string): EmotionType {
    const lower = text.toLowerCase();

    if (HAPPY_KEYWORDS.some((w) => lower.includes(w))) {
      return 'happy';
    }
    if (SURPRISED_KEYWORDS.some((w) => lower.includes(w))) {
      return 'surprised';
    }
    if (FOCUSED_KEYWORDS.some((w) => lower.includes(w))) {
      return 'focused';
    }

    return 'neutral';
  }

  public setEmotion(type: EmotionType): void {
    if (this.targetEmotion !== type) {
      this.targetEmotion = type;
      this.crossFadeElapsed = 0;
    }
  }

  /**
   * Updates the emotion weights taking the cross-fade into account.
   * BORROWED: returns the layer's internal Map (zero allocation) — read it immediately, never
   * mutate or retain it; use takeWeights() for an owned copy.
   */
  public update(dt: number): ReadonlyMap<string, number> {
    this.crossFadeElapsed = Math.min(this.crossFadeDurationSec, this.crossFadeElapsed + dt);
    const progress = this.crossFadeElapsed / this.crossFadeDurationSec;
    // Cosine ease for emotion smoothing
    const ease = Math.sin((progress * Math.PI) / 2);

    const targetProfile = EMOTION_PROFILES[this.targetEmotion];
    // Pass 1: shapes already active (updating/deleting the current key while iterating a Map is safe).
    for (const [shape, currentVal] of this.activeWeights) {
      this.stepShape(shape, currentVal, targetProfile.get(shape) ?? 0.0, ease);
    }
    // Pass 2: profile shapes not active yet (no Set union needed, nothing allocated).
    for (const [shape, targetVal] of targetProfile) {
      if (!this.activeWeights.has(shape)) this.stepShape(shape, 0.0, targetVal, ease);
    }

    if (progress >= 1.0) {
      this.currentEmotion = this.targetEmotion;
    }

    return this.activeWeights;
  }

  private stepShape(shape: string, currentVal: number, targetVal: number, ease: number): void {
    const nextVal = currentVal + (targetVal - currentVal) * ease;
    if (nextVal < emotionConfig.decayEpsilon && targetVal === 0) {
      this.activeWeights.delete(shape);
    } else {
      this.activeWeights.set(shape, nextVal);
    }
  }

  /** Owned copy of the current weights — for non-hot paths that must keep or mutate the result. */
  public takeWeights(): Map<string, number> {
    if (allocProbe.enabled) allocProbe.record();
    return new Map(this.activeWeights);
  }

  public getCurrentEmotion(): EmotionType {
    return this.currentEmotion;
  }

  public getTargetEmotion(): EmotionType {
    return this.targetEmotion;
  }

  public getWeight(shape: string): number {
    return this.activeWeights.get(shape) ?? 0.0;
  }
}
