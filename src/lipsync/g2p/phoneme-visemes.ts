/**
 * ARPAbet phoneme → ARKit viseme table (docs/3, v1.x, Phase 7; table extracted in Phase 17).
 *
 * Values are EFFECTIVE TARGETS — after the scale-semantics change (07-02) the scheduler multiplies them
 * exactly once by the profile scale (default 1.0). Mirrored keys (L/R) are symmetric.
 *
 * v1.3 (2026-09): more "power" (larger jaw/smile/rounding amplitudes) + "flavour"
 * from extra blendshapes, so visemes are not "bare" 1-2 shapes:
 *   - open vowels (AA/AE/AH/AW): lowerDown → clearer opening + lower teeth,
 *   - front vowels (EY/IY): upperUp (upper teeth) strengthened,
 *   - puckers (UW/W): shrugLower boosts lip protrusion,
 *   - sibilants SZ / funnel SH: more exposed teeth,
 *   - K/G/NG/T/D/N/L: gentle lowerDown/upperUp, so "neutral" visemes are not empty.
 *
 * SINGLE SOURCE OF TRUTH (17-02): the poses live in `PHONEME_POSES` below. `mapPhonemeToShapes`, the
 * Calibrator preview (`FaceController.testPhoneme`), tests and docs/en-visemes.md all read this table.
 *
 * EFFECTIVE-VALUE LAYERING (what the mouth actually does):
 *
 *   effective = table value  x  profile scale for that shape (scheduler `scaleForShape`)
 *
 *   - jawOpen x jawScale, smile x smileScale, pucker x puckerScale, funnel x funnelScale,
 *     rollLower/shrug x rollScale, upperUp/lowerDown x teethExposureScale, tongue x 1.0
 *   - mouthClose AND mouthPress x min(closeScale, ANIM_DEFAULTS.common.mouthCloseCap = 0.85):
 *     the cap limits the SCALE, so the slider can never push the lip onto the nose
 *
 *   Bilabial closure (M/B/P) is PERCEIVED closure, not mouthClose alone. Since 11.2 SHOW-06 the pose
 *   is jawOpen ~ 0 + mouthPress + mouthRollLower/Upper with a deliberately LOW mouthClose (a high
 *   mouthClose pulls the lower lip onto the nose on MetaPerson). Under the balanced preset
 *   (closeScale 0.60): close 0.50 x 0.60 = 0.30, press 0.58 x 0.60 = 0.348, jaw 0.02. The scheduler
 *   then damps jawOpen by the closure ratio (closeJawThreshold / pressRef in anim-config).
 */

export interface LipPose {
  jaw?: number;
  close?: number;
  press?: number;
  pucker?: number;
  funnel?: number;
  roll?: number;
  /** mouthRollLower (alias of `roll`, explicit name for bilabial closure) */
  rollLower?: number;
  /** mouthRollUpper — upper lip tucked in, helps the lips meet without mouthClose */
  rollUpper?: number;
  shrug?: number;
  upperUp?: number;
  lowerDown?: number;
  smile?: number;
  tongue?: number;
}

/** Builds a Map<shape, weight> from a pose; mirrored keys (L/R) are set symmetrically. */
export function lipPoseToShapes(p: LipPose): Map<string, number> {
  const m = new Map<string, number>();
  const set = (k: string, v?: number) => {
    if (v && v > 0) m.set(k, v);
  };
  set('jawOpen', p.jaw);
  set('mouthClose', p.close);
  set('mouthPucker', p.pucker);
  set('mouthFunnel', p.funnel);
  set('mouthRollLower', p.rollLower ?? p.roll);
  set('mouthRollUpper', p.rollUpper);
  set('mouthShrugLower', p.shrug);
  set('tongueOut', p.tongue);
  const sym = (base: string, v?: number) => {
    if (v && v > 0) {
      m.set(`${base}Left`, v);
      m.set(`${base}Right`, v);
    }
  };
  sym('mouthPress', p.press);
  sym('mouthUpperUp', p.upperUp);
  sym('mouthLowerDown', p.lowerDown);
  sym('mouthSmile', p.smile);
  return m;
}

/**
 * Bilabial pose shared by P / B / M.
 * Phase 11.2 SHOW-06 (D-7): closure with jaw ≈ 0 + lip press (press) + roll-in (roll),
 * with a LOW mouthClose. Table values x the 'balanced' profile scale (closeScale 0.60 applies to
 * mouthClose AND mouthPress*; roll/jaw scale 1.0):
 *   jawOpen        0.02 x 1.0  = 0.02  (<= 0.03)
 *   mouthClose     0.50 x 0.60 = 0.30  (<= 0.35)
 *   mouthPress L/R 0.58 x 0.60 = 0.348 (0.35 +- 0.05)
 *   mouthRollLower 0.25 x 1.0  = 0.25
 *   mouthRollUpper 0.15 x 1.0  = 0.15
 */
const BILABIAL: LipPose = { jaw: 0.02, close: 0.5, press: 0.58, rollLower: 0.25, rollUpper: 0.15 };

/** Sibilant pose shared by S / Z (and by the Polish dental affricates PL_TS / PL_DZ). */
const SIBILANT: LipPose = { jaw: 0.16, smile: 0.2, upperUp: 0.16, lowerDown: 0.16 };

/** ARPAbet phoneme → pose. The ONE table every consumer reads (see the module doc for layering). */
export const PHONEME_POSES: Readonly<Record<string, Readonly<LipPose>>> = {
  // ---- Front vowels (ladder: jaw + smile + teeth; the higher, the more "speech smile") ----
  IY: { jaw: 0.25, smile: 0.38, upperUp: 0.12 }, // "see" — the brightest speech smile + upper teeth
  IH: { jaw: 0.26, smile: 0.16 }, // "bit" — relaxed, almost no smile
  EY: { jaw: 0.34, smile: 0.34, upperUp: 0.14 }, // "say" — strong half-smile + upper teeth
  EH: { jaw: 0.42, smile: 0.24, lowerDown: 0.08 }, // "bed" — open, lower teeth slightly shown
  AE: { jaw: 0.52, smile: 0.18, lowerDown: 0.12 }, // "cat" — wide, lower teeth visible
  AA: { jaw: 0.6, smile: 0.1, lowerDown: 0.15 }, // "father" — max opening + lower teeth (power)
  AH: { jaw: 0.44, lowerDown: 0.08 }, // "but" — mid-open, neutral

  // ---- Back vowels (oval → funnel; UW/W get a shrug that boosts protrusion) ----
  AO: { jaw: 0.4, pucker: 0.5, funnel: 0.3, lowerDown: 0.08 }, // "thought" — open oval
  OW: { jaw: 0.34, pucker: 0.6, funnel: 0.5 }, // "go" — tight rounding (power)
  AW: { jaw: 0.46, pucker: 0.52, lowerDown: 0.12 }, // "how" — wide → rounding (open start: lower teeth)
  UH: { jaw: 0.24, pucker: 0.5, funnel: 0.22 }, // "book" — slight pucker
  UW: { jaw: 0.2, pucker: 0.7, funnel: 0.45, shrug: 0.08 }, // "too" — max pucker + lower lip raise (protrusion)

  // ---- R-coloured / diphthongs ----
  ER: { jaw: 0.32, funnel: 0.22, pucker: 0.16 }, // "her" — r-coloured with gentle rounding
  AY: { jaw: 0.46, smile: 0.26, lowerDown: 0.08 }, // "my" — wide → smile (start pose; glide ends on IH)
  OY: { jaw: 0.42, pucker: 0.45, smile: 0.1 }, // "boy" — rounding → smile

  // ---- Bilabial consonants (MetaPerson: a high mouthClose pulls the lower lip onto the nose) ----
  P: BILABIAL,
  B: BILABIAL,
  M: BILABIAL,

  // ---- Labiodentals (lower lip under the upper teeth; strong roll) ----
  F: { jaw: 0.12, roll: 0.7, upperUp: 0.55, shrug: 0.2, lowerDown: 0.05 },
  V: { jaw: 0.12, roll: 0.7, upperUp: 0.55, shrug: 0.2, lowerDown: 0.05 },

  // ---- Interdentals (visible tongue) ----
  TH: { jaw: 0.22, tongue: 0.38 },
  DH: { jaw: 0.22, tongue: 0.38 },

  // ---- Alveolar / nasal (slight teeth presence so they are not "empty") ----
  T: { jaw: 0.2, upperUp: 0.06, lowerDown: 0.06 },
  D: { jaw: 0.2, upperUp: 0.06, lowerDown: 0.06 },
  N: { jaw: 0.2, upperUp: 0.06, lowerDown: 0.06 },
  L: { jaw: 0.32, tongue: 0.12, lowerDown: 0.08 }, // L = tongue UP; tongueOut only symbolic

  // ---- Sibilants (strong teeth exposure) ----
  S: SIBILANT,
  Z: SIBILANT,

  // ---- Palatals / affricates (funnel + teeth; CH has a closed start) ----
  SH: { jaw: 0.22, funnel: 0.55, pucker: 0.16, upperUp: 0.14, lowerDown: 0.14 },
  ZH: { jaw: 0.22, funnel: 0.55, pucker: 0.16, upperUp: 0.14, lowerDown: 0.14 },
  CH: { jaw: 0.3, funnel: 0.45, pucker: 0.1, lowerDown: 0.1 },
  JH: { jaw: 0.3, funnel: 0.45, pucker: 0.1, lowerDown: 0.1 },

  // ---- Velars (opening + lower teeth) ----
  K: { jaw: 0.4, lowerDown: 0.12 },
  G: { jaw: 0.4, lowerDown: 0.12 },
  NG: { jaw: 0.3, lowerDown: 0.06 },

  // ---- Approximants ----
  R: { jaw: 0.32, funnel: 0.22, pucker: 0.14 }, // /ɹ/ labialized — rounding
  W: { jaw: 0.16, pucker: 0.6, funnel: 0.18, shrug: 0.08 }, // /w/ — strong pucker + lower lip raise
  Y: { jaw: 0.26, smile: 0.28 }, // /j/ — like a short [i]

  // ---- Aspiration (low amplitude, neutral) ----
  HH: { jaw: 0.22 },
};

/**
 * Polish-only viseme classes (17-04). The Polish G2P (`g2p-pl.ts`) emits the shared ARPAbet class keys
 * above wherever the mouth shape coincides (AA, EH, IY, AO, UW, IH, SH, ZH, CH, JH, W, Y, ...) and
 * these `PL_*` keys for the classes English has no pose for. Kept apart from `PHONEME_POSES` so the
 * English table (and its snapshot / distinctness guards) is untouched.
 */
const SOFT_SIBILANT: LipPose = { jaw: 0.16, smile: 0.22, funnel: 0.18, upperUp: 0.12, lowerDown: 0.1 };

export const PL_PHONEME_POSES: Readonly<Record<string, Readonly<LipPose>>> = {
  // Velar fricative [x] (ch, h): open, no smile, no rounding - NOT the English CH funnel.
  PL_H: { jaw: 0.3, lowerDown: 0.06 },
  // Soft sibilants / affricates (the acute letters and the i-softened clusters): smile + a little funnel.
  PL_SI: SOFT_SIBILANT,
  PL_ZI: SOFT_SIBILANT,
  PL_CI: SOFT_SIBILANT,
  PL_DZI: SOFT_SIBILANT,
  PL_NI: { jaw: 0.18, smile: 0.12, upperUp: 0.05 },
  // Dental affricates c / dz share the English sibilant pose.
  PL_TS: SIBILANT,
  PL_DZ: SIBILANT,
  // Nasal vowels: open + slight funnel (a), half-open + slight smile and funnel (e).
  PL_AN: { jaw: 0.42, funnel: 0.2, pucker: 0.1 },
  PL_EN: { jaw: 0.36, smile: 0.14, funnel: 0.12 },
};

/**
 * Diphthong glide targets (docs/en-visemes.md section 5.5, option 2 for AY and AW): the merge layer
 * emits the diphthong's own pose first and then this end pose, so the mouth visibly MOVES instead of
 * holding one static shape. AY glides to [ɪ], AW to [ʊ]. EY/OW/OY stay single static poses.
 * Removing an entry here reverts that diphthong to one span (the whole feature is this map).
 */
export const DIPHTHONG_END_POSES: Readonly<Record<string, string>> = {
  AY: 'IH',
  AW: 'UH',
};

/** Own-property lookup (a phoneme named `constructor` must not resolve through the prototype chain). */
function ownPose(table: Readonly<Record<string, Readonly<LipPose>>>, phoneme: string): Readonly<LipPose> | undefined {
  return Object.prototype.hasOwnProperty.call(table, phoneme) ? table[phoneme] : undefined;
}

/**
 * Maps an ARPAbet phoneme to target ARKit weights.
 * Returns null for an unknown phoneme (the queue consumer skips it without an error).
 */
export function mapPhonemeToShapes(phoneme: string): Map<string, number> | null {
  const pose = ownPose(PHONEME_POSES, phoneme) ?? ownPose(PL_PHONEME_POSES, phoneme);
  return pose ? lipPoseToShapes(pose) : null; // unknown phoneme -> no viseme
}
