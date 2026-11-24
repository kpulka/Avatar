/**
 * Rule-based G2P for Polish (Phase 17-04, LIP-05).
 *
 * Polish orthography is nearly phonemic, so a deterministic left-to-right rules engine beats the
 * character table and needs NO lexicon (it works before the English dictionary has loaded).
 *
 * Output contract: VISEME-CLASS tokens, not IPA. Every token is a key of `PHONEME_POSES` (shared
 * with English, e.g. AA / SH / ZH / CH / W) or of `PL_PHONEME_POSES` (`PL_*` classes with no English
 * counterpart: soft sibilants, the velar fricative, nasal vowels). Diacritics are written as \uXXXX
 * escapes so this file stays inside the English-only language gate without allowlist entries.
 *
 * Rules (ordered, longest match first):
 *  - digraphs: sz -> SH, cz -> CH, rz -> ZH, ch -> PL_H (velar [x], NOT the English CH pose),
 *    dz -> PL_DZ, dz-with-acute / dzi+vowel -> PL_DZI, dz-with-dot -> JH
 *  - softness-i: ci / ni / si / zi / dzi are consumed into ONE soft consonant (PL_CI, PL_NI, PL_SI,
 *    PL_ZI, PL_DZI) ONLY when a vowel follows ("ziarno" -> PL_ZI AA ...). Before a consonant or at the
 *    word end the i stays a vowel: "zima" -> Z IY M AA (plain z + i, no false softening).
 *  - diacritics: the acute letters s/c/z/n are always soft; the dotted z is ZH; the stroked l is W;
 *    o-acute is UW; the nasal vowels are PL_AN / PL_EN (a word-final nasal e is spoken plain: EH)
 *  - final devoicing on the LAST token of the word (b->p, d->t, w->f, z->s, g->k, soft/dotted
 *    voiced variants -> their voiceless partner), e.g. "chleb" ends in P
 */

/** Polish letters as escapes (lower case). */
const A_NASAL = '\u0105'; // a with ogonek
const C_ACUTE = '\u0107';
const E_NASAL = '\u0119'; // e with ogonek
const L_STROKE = '\u0142';
const N_ACUTE = '\u0144';
const O_ACUTE = '\u00F3';
const S_ACUTE = '\u015B';
const Z_ACUTE = '\u017A';
const Z_DOT = '\u017C';

/** Letters the engine understands (everything else, e.g. digits and punctuation, is dropped). */
const LETTER = new RegExp(`[a-z${A_NASAL}${C_ACUTE}${E_NASAL}${L_STROKE}${N_ACUTE}${O_ACUTE}${S_ACUTE}${Z_ACUTE}${Z_DOT}]`);

/** Vowel letters that make a preceding "i" a pure softness marker. */
const SOFTNESS_VOWELS = new Set(['a', 'e', 'o', 'u', A_NASAL, E_NASAL, O_ACUTE]);

/** Plain (single-letter) mapping. */
const SINGLE: Readonly<Record<string, readonly string[]>> = {
  a: ['AA'],
  e: ['EH'],
  i: ['IY'],
  o: ['AO'],
  u: ['UW'],
  y: ['IH'],
  [O_ACUTE]: ['UW'],
  [A_NASAL]: ['PL_AN'],
  [E_NASAL]: ['PL_EN'],
  b: ['B'],
  c: ['PL_TS'],
  d: ['D'],
  f: ['F'],
  g: ['G'],
  h: ['PL_H'],
  j: ['Y'],
  k: ['K'],
  l: ['L'],
  [L_STROKE]: ['W'],
  m: ['M'],
  n: ['N'],
  p: ['P'],
  q: ['K'],
  r: ['R'],
  s: ['S'],
  t: ['T'],
  v: ['V'],
  w: ['V'],
  x: ['K', 'S'],
  z: ['Z'],
  [S_ACUTE]: ['PL_SI'],
  [C_ACUTE]: ['PL_CI'],
  [N_ACUTE]: ['PL_NI'],
  [Z_ACUTE]: ['PL_ZI'],
  [Z_DOT]: ['ZH'],
};

/** Letter -> soft token, for the consonants that "i" can soften (only before a vowel). */
const SOFTENABLE: Readonly<Record<string, string>> = {
  c: 'PL_CI',
  n: 'PL_NI',
  s: 'PL_SI',
  z: 'PL_ZI',
};

/** Voiced -> voiceless partner for the last token of a word. */
const FINAL_DEVOICING: Readonly<Record<string, string>> = {
  B: 'P',
  D: 'T',
  G: 'K',
  V: 'F',
  Z: 'S',
  ZH: 'SH',
  JH: 'CH',
  PL_ZI: 'PL_SI',
  PL_DZI: 'PL_CI',
  PL_DZ: 'PL_TS',
};

/** Whether the letters starting at `i` are the given string. */
function at(letters: readonly string[], i: number, text: string): boolean {
  for (let k = 0; k < text.length; k++) if (letters[i + k] !== text[k]) return false;
  return true;
}

/**
 * Turns one Polish word into viseme-class tokens. Never throws; returns [] for input without letters.
 * Case-insensitive; apostrophes, hyphens, digits and other characters are ignored.
 */
export function g2pPl(word: string): string[] {
  const letters = Array.from(word.toLowerCase()).filter((ch) => LETTER.test(ch));
  const out: string[] = [];
  const n = letters.length;

  let i = 0;
  while (i < n) {
    // '' = past the end (no undefined under noUncheckedIndexedAccess); c is always defined since i < n
    const c = letters[i] ?? '';
    const next = letters[i + 1] ?? '';
    const afterNext = letters[i + 2] ?? '';

    if (c === 'd') {
      // d + z-acute -> one soft affricate; d + z-dot -> JH (both are two letters);
      // dzi + vowel -> the soft affricate again (consumes the i); plain dz -> PL_DZ.
      if (next === Z_ACUTE) {
        out.push('PL_DZI');
        i += 2;
        continue;
      }
      if (next === Z_DOT) {
        out.push('JH');
        i += 2;
        continue;
      }
      if (next === 'z' && afterNext === 'i' && SOFTNESS_VOWELS.has(letters[i + 3] ?? '')) {
        out.push('PL_DZI');
        i += 3;
        continue;
      }
      if (next === 'z') {
        out.push('PL_DZ');
        i += 2;
        continue;
      }
    }

    if (next !== undefined) {
      if (at(letters, i, 'sz')) {
        out.push('SH');
        i += 2;
        continue;
      }
      if (at(letters, i, 'cz')) {
        out.push('CH');
        i += 2;
        continue;
      }
      if (at(letters, i, 'rz')) {
        out.push('ZH');
        i += 2;
        continue;
      }
      if (at(letters, i, 'ch')) {
        out.push('PL_H');
        i += 2;
        continue;
      }
    }

    // Softness-i: c / n / s / z + i + VOWEL -> one soft consonant, the i is consumed.
    const soft = SOFTENABLE[c];
    if (soft !== undefined && next === 'i' && SOFTNESS_VOWELS.has(afterNext)) {
      out.push(soft);
      i += 2;
      continue;
    }

    // A word-final nasal e (e with ogonek) is spoken as a plain e.
    if (c === E_NASAL && i === n - 1) {
      out.push('EH');
      i += 1;
      continue;
    }

    const mapped = SINGLE[c];
    if (mapped !== undefined) out.push(...mapped);
    i += 1;
  }

  // Final devoicing: only the last token of the word.
  if (out.length > 0) {
    const last = out[out.length - 1] ?? '';
    const devoiced = FINAL_DEVOICING[last];
    if (devoiced !== undefined) out[out.length - 1] = devoiced;
  }
  return out;
}
