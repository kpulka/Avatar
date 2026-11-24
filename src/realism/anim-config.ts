/**
 * Animation runtime tuning constants — the single, typed, frozen source of truth (16-04).
 *
 * Developer-facing: this is NOT the studio CalibrationProfile (calibration.ts stays the user-facing
 * mouth-tuning surface and feeds the scheduler through its own constructor path).
 *
 * Deliberately NOT here (they ARE the curve, not a tunable): the head-micro-movement harmonic
 * coefficients in head-micro-movements.ts and the per-emotion weight maps in emotion-layer.ts.
 */

type DeepReadonly<T> = { readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K] };

function deepFreeze<T extends object>(value: T): DeepReadonly<T> {
  for (const key of Object.keys(value) as Array<keyof T>) {
    const inner = value[key];
    if (inner !== null && typeof inner === 'object') deepFreeze(inner as unknown as object);
  }
  return Object.freeze(value) as DeepReadonly<T>;
}

export const ANIM_DEFAULTS = deepFreeze({
  /** RELAXING: the smooth return to neutral after a turn / interruption (wall clock). */
  relax: {
    durationMs: 150,
    /** RELAXING ends early when the largest weight falls below this. */
    finishEpsilon: 0.005,
  },

  /** Acoustic (RMS energy) fallback alignment: drives only the jaw. */
  fallback: {
    skipEnergyBelow: 0.02,
    jawScale: 2.0,
    jawCap: 0.5,
    minDurationSec: 0.035,
  },

  /** Viseme scheduler (easing, per-group damping, bilabial jaw gate). */
  viseme: {
    minDurationSec: 0.035,
    blendInSec: 0.035,
    blendOutSec: 0.045,
    /** Multipliers on the base lambda (profile.coarticulationSpeed) per muscle group. */
    lambdaTiers: { closure: 1.7, jawTongue: 1.55, smile: 0.45 },
    /** Bilabial jaw gate: active when mouthClose OR mouthPress exceeds this (Phase 11.2 SHOW-06). */
    closeJawThreshold: 0.15,
    /** Strength of the jaw damping at full closure. */
    closeJawFactor: 0.95,
    /** Effective mouthPress of a full bilabial (M/B/P) under the balanced preset. */
    pressRef: 0.35,
  },

  /** Emotion layer and its mix into speech. */
  emotion: {
    /** ONE policy for both tracks (viseme and frames): share of the base emotion kept while speaking. */
    mixFactorSpeaking: 0.3,
    /** Smile emotion is suppressed while mouthClose exceeds this (M/B/P must seal). */
    smileSuppressClose: 0.25,
    crossFadeSec: 0.4,
    decayEpsilon: 0.002,
  },

  /** Manual overrides (HUD sliders / previews). */
  manual: {
    /** Anatomical guard: mouthClose <= jawOpen + margin (lower lip must not ride onto the nose). */
    jawGuardMargin: 0.2,
  },

  /** Shared safety numbers. */
  common: {
    /** Hard ceiling of mouthClose (MetaPerson "lip on the nose" artifact) — both tracks. */
    mouthCloseCap: 0.85,
    /** Weights below this are snapped to a hard 0. */
    snapEpsilon: 0.001,
  },

  blink: {
    intervalMinSec: 2.5,
    intervalMaxSec: 6.0,
    closeSec: 0.08,
    openSec: 0.2,
    doubleBlinkChance: 0.15,
    doubleBlinkPauseSec: 0.1,
    /** Right eyelid scale (subtle asymmetry). */
    rightScale: 0.98,
  },

  gaze: {
    maxAngleRad: 0.26,
    saccadeMinSec: 0.5,
    saccadeMaxSec: 2.0,
    saccadeAmpRad: 0.087,
    /** Damping lambda of the gaze smoothing (1 - exp(-lambda*dt)). */
    lambda: 15,
    /** Share of the gaze applied to the eyeLook* morphs (the bones are the visible channel). */
    morphWeight: 0.35,
    boneYawScale: 0.9,
    bonePitchScale: 0.75,
    boneRestOffset: 0.061,
    saccadeDurationMinSec: 0.035,
    saccadeDurationMaxSec: 0.05,
    /** Duration of a forced / initial saccade. */
    saccadeDefaultDurationSec: 0.04,
  },

  head: {
    ampYawRad: 0.012,
    ampPitchRad: 0.008,
    ampRollRad: 0.004,
  },

  breath: {
    freqHz: 0.22,
    ampM: 0.002,
    chestScaleX: 0.02,
    chestScaleZ: 0.035,
  },

  frame: {
    /** Render-loop dt cap: long frames run in deliberate slow motion instead of jumping. */
    dtCapSec: 0.1,
  },
});

/** The one clamp to [0, 1] for the whole animation runtime. */
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
