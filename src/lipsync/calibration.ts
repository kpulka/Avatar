/**
 * Phonetic calibration configuration and profiles module (Lip-Sync Calibrator)
 */

export interface CalibrationProfile {
  /** Taste multiplier of jaw-open depth (jawOpen) [0.5 - 1.3] — viseme table values are effective */
  jawScale: number;
  /** Taste multiplier of lip closure (mouthClose) for M/B/P [0.5 - 1.2] */
  closeScale: number;
  /** Taste multiplier of lip rounding (mouthPucker) for O/U/W [0.4 - 1.3] */
  puckerScale: number;
  /** Taste multiplier of the lip funnel (mouthFunnel) for O/SZ/CZ [0.4 - 1.3] */
  funnelScale: number;
  /** Taste multiplier of lower-lip roll (mouthRollLower) for F/V [0.4 - 1.3] */
  rollScale: number;
  /** Taste multiplier of teeth exposure / lip raise (mouthUpperUp + mouthLowerDown) for F/V and SZ/CZ [0.4 - 1.3] */
  teethExposureScale: number;
  /** Taste multiplier of mouth-corner stretch in speech smile (mouthSmile) [0.4 - 1.3] */
  smileScale: number;
  /** Reaction speed of the speech-apparatus muscles (coarticulation lambda) [8 - 35] */
  coarticulationSpeed: number;
  /**
   * Audio-Video sync offset in milliseconds [-150ms .. +400ms].
   * POSITIVE = mouth later relative to the sound (audio leads). Live observation (2026-09-02):
   * the EL text alignment is sometimes earlier than the audio → the mouth leads the sound, so typically
   * positive values (~+100..+250) are needed. See docs/3 (rescale/AV offset).
   */
  syncOffsetMs: number;
  /**
   * Version of the A/V sync clock semantics the stored syncOffsetMs refers to.
   * Absent / < SYNC_CLOCK_VERSION = legacy value tuned against ctx.currentTime (migrated once on load).
   */
  clockVersion: number;
}

/** Legacy hand-tuned preset offsets (stand-in for output latency, pre Phase 11.2 D-6). */
export const LEGACY_SYNC_OFFSETS = [90, 100, 120] as const;
/** Current sync-clock semantics: mouth timing follows the audible time (Phase 11.2 D-6). */
export const SYNC_CLOCK_VERSION = 2;

export type CalibrationPresetName = 'subtle' | 'balanced' | 'expressive';

// Presets are TASTE MULTIPLIERS around 1.0 — the viseme table values (docs/3) are already
// effective values (LIPS-06). balanced (1.0) = exactly the table, no damping.
export const CALIBRATION_PRESETS: Record<CalibrationPresetName, CalibrationProfile> = {
  subtle: {
    jawScale: 0.85,
    closeScale: 0.50, // MetaPerson: a high mouthClose pulls the lower lip onto the nose — keep it low
    puckerScale: 0.85,
    funnelScale: 0.85,
    rollScale: 0.85,
    teethExposureScale: 0.85,
    smileScale: 0.85,
    coarticulationSpeed: 30, // user setting (sharp, distinct transitions)
    // Residual A/V offset after audible-clock compensation (Phase 11.2 D-6); was a stand-in for output latency.
    syncOffsetMs: 20,
    clockVersion: SYNC_CLOCK_VERSION,
  },
  balanced: {
    jawScale: 1.00,
    closeScale: 0.60, // safe M/B/P closure — no "lip on the nose" deformation
    puckerScale: 1.00,
    funnelScale: 1.00,
    rollScale: 1.00,
    teethExposureScale: 1.00,
    smileScale: 1.00,
    coarticulationSpeed: 30,
    // Residual A/V offset after audible-clock compensation (Phase 11.2 D-6); was a stand-in for output latency.
    syncOffsetMs: 30,
    clockVersion: SYNC_CLOCK_VERSION,
  },
  expressive: {
    jawScale: 1.15,
    closeScale: 0.70,
    puckerScale: 1.15,
    funnelScale: 1.15,
    rollScale: 1.15,
    teethExposureScale: 1.15,
    smileScale: 1.15,
    coarticulationSpeed: 30,
    // Residual A/V offset after audible-clock compensation (Phase 11.2 D-6); was a stand-in for output latency.
    syncOffsetMs: 40,
    clockVersion: SYNC_CLOCK_VERSION,
  },
};

export const DEFAULT_CALIBRATION_PROFILE: CalibrationProfile = CALIBRATION_PRESETS.balanced;

const STORAGE_KEY = 'avatar_lip_calibration_profile_v3';

/**
 * Loads the saved calibration profile from localStorage or returns the default
 */
export function loadCalibrationProfile(): CalibrationProfile {
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<CalibrationProfile>;
        return { ...DEFAULT_CALIBRATION_PROFILE, ...parsed };
      }
    } catch (e) {
      console.warn('[Calibration] Could not read the profile from localStorage:', e);
    }
  }
  return { ...DEFAULT_CALIBRATION_PROFILE };
}

/**
 * Saves the active calibration profile to localStorage
 */
export function saveCalibrationProfile(profile: CalibrationProfile): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.warn('[Calibration] Error saving the profile to localStorage:', e);
    }
  }
}

/**
 * Resets the saved localStorage profile to factory values
 */
export function resetCalibrationProfile(): CalibrationProfile {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('[Calibration] Error resetting localStorage:', e);
    }
  }
  return { ...DEFAULT_CALIBRATION_PROFILE };
}
