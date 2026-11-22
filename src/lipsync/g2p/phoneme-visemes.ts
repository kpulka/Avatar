/**
 * ARPAbet phoneme → ARKit viseme table (docs/3, v1.x, Phase 7).
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
function pose(p: LipPose): Map<string, number> {
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
 * Maps an ARPAbet phoneme to target ARKit weights.
 * Returns null for an unknown phoneme (the queue consumer skips it without an error).
 */
export function mapPhonemeToShapes(phoneme: string): Map<string, number> | null {
  switch (phoneme) {
    // ---- Front vowels (ladder: jaw + smile + teeth; the higher, the more "speech smile") ----
    case 'IY': // "see" — the brightest speech smile + upper teeth
      return pose({ jaw: 0.25, smile: 0.38, upperUp: 0.12 });
    case 'IH': // "bit" — relaxed, almost no smile
      return pose({ jaw: 0.26, smile: 0.16 });
    case 'EY': // "say" — strong half-smile + upper teeth
      return pose({ jaw: 0.34, smile: 0.34, upperUp: 0.14 });
    case 'EH': // "bed" — open, lower teeth slightly shown
      return pose({ jaw: 0.42, smile: 0.24, lowerDown: 0.08 });
    case 'AE': // "cat" — wide, lower teeth visible
      return pose({ jaw: 0.52, smile: 0.18, lowerDown: 0.12 });
    case 'AA': // "father" — max opening + lower teeth (power)
      return pose({ jaw: 0.6, smile: 0.1, lowerDown: 0.15 });
    case 'AH': // "but" — mid-open, neutral
      return pose({ jaw: 0.44, lowerDown: 0.08 });

    // ---- Back vowels (oval → funnel; UW/W get a shrug that boosts protrusion) ----
    case 'AO': // "thought" — open oval
      return pose({ jaw: 0.4, pucker: 0.5, funnel: 0.3, lowerDown: 0.08 });
    case 'OW': // "go" — tight rounding (power)
      return pose({ jaw: 0.34, pucker: 0.6, funnel: 0.5 });
    case 'AW': // "how" — wide → rounding (open start: lower teeth)
      return pose({ jaw: 0.46, pucker: 0.52, lowerDown: 0.12 });
    case 'UH': // "book" — slight pucker
      return pose({ jaw: 0.24, pucker: 0.5, funnel: 0.22 });
    case 'UW': // "too" — max pucker + lower lip raise (protrusion)
      return pose({ jaw: 0.2, pucker: 0.7, funnel: 0.45, shrug: 0.08 });

    // ---- R-coloured / diphthongs ----
    case 'ER': // "her" — r-coloured with gentle rounding
      return pose({ jaw: 0.32, funnel: 0.22, pucker: 0.16 });
    case 'AY': // "my" — wide → smile
      return pose({ jaw: 0.46, smile: 0.26, lowerDown: 0.08 });
    case 'OY': // "boy" — rounding → smile
      return pose({ jaw: 0.42, pucker: 0.45, smile: 0.1 });

    // ---- Bilabial consonants (MetaPerson: a high mouthClose pulls the lower lip onto the nose) ----
    // Phase 11.2 SHOW-06 (D-7): closure with jaw ≈ 0 + lip press (press) + roll-in (roll),
    // with a LOW mouthClose. Table values x the 'balanced' profile scale (closeScale 0.60 applies to
    // mouthClose AND mouthPress*; roll/jaw scale 1.0):
    //   jawOpen        0.02 x 1.0  = 0.02  (<= 0.03)
    //   mouthClose     0.50 x 0.60 = 0.30  (<= 0.35)
    //   mouthPress L/R 0.58 x 0.60 = 0.35  (0.35 +- 0.05)
    //   mouthRollLower 0.25 x 1.0  = 0.25
    //   mouthRollUpper 0.15 x 1.0  = 0.15
    case 'P':
    case 'B':
    case 'M':
      return pose({ jaw: 0.02, close: 0.5, press: 0.58, rollLower: 0.25, rollUpper: 0.15 });

    // ---- Labiodentals (lower lip under the upper teeth; strong roll) ----
    case 'F':
    case 'V':
      return pose({ jaw: 0.12, roll: 0.7, upperUp: 0.55, shrug: 0.2, lowerDown: 0.05 });

    // ---- Interdentals (visible tongue) ----
    case 'TH':
    case 'DH':
      return pose({ jaw: 0.22, tongue: 0.38 });

    // ---- Alveolar / nasal (slight teeth presence so they are not "empty") ----
    case 'T':
    case 'D':
    case 'N':
      return pose({ jaw: 0.2, upperUp: 0.06, lowerDown: 0.06 });
    case 'L': // L = tongue UP; tongueOut only symbolic
      return pose({ jaw: 0.32, tongue: 0.12, lowerDown: 0.08 });

    // ---- Sibilants (strong teeth exposure) ----
    case 'S':
    case 'Z':
      return pose({ jaw: 0.16, smile: 0.2, upperUp: 0.16, lowerDown: 0.16 });

    // ---- Palatals / affricates (funnel + teeth; CH has a closed start) ----
    case 'SH':
    case 'ZH':
      return pose({ jaw: 0.22, funnel: 0.55, pucker: 0.16, upperUp: 0.14, lowerDown: 0.14 });
    case 'CH':
    case 'JH':
      return pose({ jaw: 0.3, funnel: 0.45, pucker: 0.1, lowerDown: 0.1 });

    // ---- Velars (opening + lower teeth) ----
    case 'K':
    case 'G':
      return pose({ jaw: 0.4, lowerDown: 0.12 });
    case 'NG':
      return pose({ jaw: 0.3, lowerDown: 0.06 });

    // ---- Approximants ----
    case 'R': // /ɹ/ labialized — rounding
      return pose({ jaw: 0.32, funnel: 0.22, pucker: 0.14 });
    case 'W': // /w/ — strong pucker + lower lip raise
      return pose({ jaw: 0.16, pucker: 0.6, funnel: 0.18, shrug: 0.08 });
    case 'Y': // /j/ — like a short [i]
      return pose({ jaw: 0.26, smile: 0.28 });

    // ---- Aspiration (low amplitude, neutral) ----
    case 'HH':
      return pose({ jaw: 0.22 });

    default:
      return null; // unknown phoneme -> no viseme
  }
}
