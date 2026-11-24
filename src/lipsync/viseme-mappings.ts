/**
 * Mapping table from characters and digraphs to ARKit blendshapes per docs/3.
 */

/**
 * Language context of the character path (17-04). Only the Polish flag exists today: in Polish "ch" is
 * the velar fricative [x], not the English affricate. Shared frozen objects, so passing a context in the
 * hot per-character loop allocates nothing.
 */
export interface CharContext {
  readonly polish?: boolean;
}
export const POLISH_CHAR_CONTEXT: CharContext = Object.freeze({ polish: true });

/**
 * Checks whether a pair of characters forms a digraph, using lookahead
 */
function tryMapDigraph(c1: string, c2: string, context?: CharContext): Map<string, number> | null {
  const pair = (c1 + c2).toUpperCase();

  switch (pair) {
    case 'SH':
      return new Map([
        ['jawOpen', 0.2],
        ['mouthFunnel', 0.5],
      ]);
    case 'CH':
      if (context?.polish) {
        // Polish "ch" = [x] (as in "chata"): open, no rounding -- the same shape as the phoneme path's PL_H.
        return new Map([
          ['jawOpen', 0.3],
          ['mouthLowerDownLeft', 0.06],
          ['mouthLowerDownRight', 0.06],
        ]);
      }
      return new Map([
        ['jawOpen', 0.25],
        ['mouthFunnel', 0.45],
      ]);
    case 'TH':
      return new Map([
        ['jawOpen', 0.2],
        ['tongueOut', 0.3],
      ]);
    case 'PH':
      return new Map([
        ['jawOpen', 0.15],
        ['mouthRollLower', 0.55],
      ]);
    case 'WH':
      return new Map([['mouthPucker', 0.4]]);
    case 'QU':
      return new Map([
        ['mouthPucker', 0.5],
        ['jawOpen', 0.35],
      ]);
    case 'NG':
      return new Map([['jawOpen', 0.25]]);

    // Polish digraphs and softenings
    case 'SZ':
    case 'CZ':
      return new Map([
        ['jawOpen', 0.14],
        ['mouthFunnel', 0.6],
        ['mouthPucker', 0.25],
        ['mouthUpperUpLeft', 0.22],
        ['mouthUpperUpRight', 0.22],
        ['mouthLowerDownLeft', 0.2],
        ['mouthLowerDownRight', 0.2],
      ]);
    case 'RZ':
    case 'DŻ':
      return new Map([
        ['jawOpen', 0.18],
        ['mouthFunnel', 0.35],
      ]);
    case 'DZ':
      return new Map([
        ['jawOpen', 0.16],
        ['mouthSmileLeft', 0.1],
        ['mouthSmileRight', 0.1],
      ]);
    case 'DŹ':
    case 'SI':
    case 'ZI':
    case 'NI':
      return new Map([
        ['jawOpen', 0.15],
        ['mouthSmileLeft', 0.18],
        ['mouthSmileRight', 0.18],
      ]);
    case 'CI':
      return new Map([
        ['jawOpen', 0.15],
        ['mouthSmileLeft', 0.15],
        ['mouthSmileRight', 0.15],
      ]);
    default:
      return null;
  }
}

/**
 * Maps a single character to ARKit weights
 */
function mapSingleChar(char: string, nextChar?: string): Map<string, number> {
  const upper = char.toUpperCase();
  const nextUpper = (nextChar ?? '').toUpperCase();

  switch (upper) {
    // Vowels
    case 'A':
      return new Map([
        ['jawOpen', 0.55],
        ['mouthSmileLeft', 0.1],
        ['mouthSmileRight', 0.1],
      ]);
    case 'E':
      return new Map([
        ['jawOpen', 0.35],
        ['mouthSmileLeft', 0.3],
        ['mouthSmileRight', 0.3],
      ]);
    case 'I':
    case 'Y':
      return new Map([
        ['jawOpen', 0.25],
        ['mouthSmileLeft', 0.2],
        ['mouthSmileRight', 0.2],
      ]);
    case 'O':
      return new Map([
        ['jawOpen', 0.4],
        ['mouthPucker', 0.6],
        ['mouthFunnel', 0.4],
      ]);
    case 'U':
      return new Map([
        ['jawOpen', 0.25],
        ['mouthPucker', 0.75],
        ['mouthFunnel', 0.5],
      ]);
    case 'W':
      return new Map([['mouthPucker', 0.4]]);

    // Bilabial consonants (FULL CLOSURE - LIPS-02)
    case 'M':
    case 'B':
    case 'P':
      return new Map([
        ['mouthClose', 1.0],
        ['mouthPressLeft', 0.15],
        ['mouthPressRight', 0.15],
      ]);

    // Labiodental consonants (F / V: upper teeth on the lower lip)
    case 'F':
    case 'V':
      return new Map([
        ['jawOpen', 0.12],
        ['mouthRollLower', 0.65],
        ['mouthUpperUpLeft', 0.5],
        ['mouthUpperUpRight', 0.5],
        ['mouthShrugLower', 0.18],
      ]);

    // Alveolar / dental (tongue-tip)
    case 'L':
      return new Map([
        ['jawOpen', 0.3],
        ['tongueOut', 0.3],
      ]);
    case 'T':
    case 'D':
    case 'N':
      return new Map([['jawOpen', 0.2]]);

    // Sibilants
    case 'S':
    case 'Z':
      return new Map([
        ['jawOpen', 0.15],
        ['mouthSmileLeft', 0.15],
        ['mouthSmileRight', 0.15],
      ]);

    // Velars
    case 'K':
    case 'G':
      return new Map([['jawOpen', 0.35]]);

    // Contextual heuristic for 'C' (docs/3)
    case 'C': {
      const isSoft = ['E', 'I', 'Y'].includes(nextUpper);
      if (isSoft) {
        // Soft pronunciation like S ("cell", "city")
        return new Map([
          ['jawOpen', 0.15],
          ['mouthSmileLeft', 0.15],
          ['mouthSmileRight', 0.15],
        ]);
      }
      // Hard pronunciation like K ("cat", "cup")
      return new Map([['jawOpen', 0.35]]);
    }

    case 'X':
      // K + S combination
      return new Map([
        ['jawOpen', 0.25],
        ['mouthSmileLeft', 0.15],
        ['mouthSmileRight', 0.15],
      ]);

    case 'H':
      return new Map([['jawOpen', 0.25]]);

    case 'R':
      return new Map([
        ['jawOpen', 0.3],
        ['mouthFunnel', 0.2],
      ]);

    case 'J':
      return new Map([
        ['jawOpen', 0.25],
        ['mouthSmileLeft', 0.15],
        ['mouthSmileRight', 0.15],
      ]);

    // Polish diacritic characters
    case 'Ą':
      return new Map([
        ['jawOpen', 0.4],
        ['mouthPucker', 0.35],
      ]);
    case 'Ę':
      return new Map([
        ['jawOpen', 0.35],
        ['mouthSmileLeft', 0.25],
        ['mouthSmileRight', 0.25],
      ]);
    case 'Ó':
      return new Map([
        ['jawOpen', 0.25],
        ['mouthPucker', 0.75],
        ['mouthFunnel', 0.4],
      ]);
    case 'Ł':
      return new Map([
        ['jawOpen', 0.2],
        ['mouthPucker', 0.45],
      ]);
    case 'Ś':
    case 'Ć':
    case 'Ź':
      return new Map([
        ['jawOpen', 0.14],
        ['mouthSmileLeft', 0.22],
        ['mouthSmileRight', 0.22],
      ]);
    case 'Ż':
      return new Map([
        ['jawOpen', 0.2],
        ['mouthFunnel', 0.4],
      ]);
    case 'Ń':
      return new Map([
        ['jawOpen', 0.18],
        ['mouthSmileLeft', 0.12],
        ['mouthSmileRight', 0.12],
      ]);

    // Space and punctuation -> natural rest (do not force mouthClose!)
    case ' ':
    case '.':
    case ',':
    case '!':
    case '?':
    case ';':
    case ':':
    case '-':
      return new Map();

    default:
      // Unknown characters -> a gentle neutral aperture
      return new Map([['jawOpen', 0.12]]);
  }
}

/**
 * Main function extracting a viseme from text, with lookahead for digraphs
 */
export function mapCharToShapes(chars: string[], index: number, context?: CharContext): Map<string, number> {
  const currentChar = chars[index] ?? '';
  const nextChar = chars[index + 1];

  // 1. Check digraphs (lookahead)
  if (nextChar) {
    const digraphShapes = tryMapDigraph(currentChar, nextChar, context);
    if (digraphShapes) {
      return digraphShapes;
    }
  }

  // 2. Check a single character
  return mapSingleChar(currentChar, nextChar);
}

// Digraphs recognised by mapCharToShapes (EN + PL) — used by the override tokenizer.
const KNOWN_DIGRAPH_PAIRS = new Set(['SH', 'CH', 'TH', 'PH', 'WH', 'QU', 'NG', 'SZ', 'CZ', 'RZ', 'DŻ', 'DZ', 'DŹ', 'SI', 'ZI', 'NI', 'CI']);

/**
 * Returns the "token" (viseme override key) for the character at the given index:
 * a digraph when recognised (2 characters), otherwise a single letter.
 * Returns null for space/punctuation/unknown (not editable).
 */
export function charTokenFor(chars: string[], index: number): string | null {
  const currentChar = chars[index];
  if (!currentChar) return null;
  const nextChar = chars[index + 1];

  if (nextChar) {
    const pair = (currentChar + nextChar).toUpperCase();
    if (KNOWN_DIGRAPH_PAIRS.has(pair)) return pair;
  }

  const upper = currentChar.toUpperCase();
  if (!/[A-ZĄĆĘŁŃÓŚŹŻ]/.test(upper)) return null; // space, punctuation, digits...
  return upper;
}

// Digraphs whose second letter is a vowel (PL softness markers: "si", "zi", "ni", "ci"). The vowel
// is still spoken, so the character path must keep enqueueing it as its own viseme.
const VOWEL_SECOND_DIGRAPHS = new Set(['SI', 'ZI', 'NI', 'CI']);

/**
 * How many alignment characters the character path consumes at `index`: 2 for a consonant
 * digraph (th/sh/ch/ph/wh/qu/ng, sz/cz/rz/dz...), otherwise 1. The caller enqueues ONE viseme for
 * the digraph and skips the second letter (otherwise "the" pulses TH, then a stray H, then E).
 */
export function charPathSpan(chars: string[], index: number): 1 | 2 {
  const token = charTokenFor(chars, index);
  return token !== null && token.length === 2 && !VOWEL_SECOND_DIGRAPHS.has(token) ? 2 : 1;
}

/**
 * Default shapes for a character-path token (without context — for C the hard variant is used).
 * Used by the Viseme Editor and the preview (viseme-overrides).
 */
export function charDefaultShapesForToken(token: string): Map<string, number> | null {
  if (!token) return null;
  if (token.length >= 2) {
    const digraph = tryMapDigraph(token.charAt(0), token.charAt(1));
    if (digraph && digraph.size > 0) return digraph;
  }
  if (token.length === 1) {
    const single = mapSingleChar(token);
    if (single.size > 0) return single;
  }
  return null;
}
