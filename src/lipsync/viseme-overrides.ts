/**
 * Viseme Editor (docs/3 v1.1): manual overrides of the blendshape pose PER VISEME.
 *
 * Rationale: the ARKit combos from the tables are guesses — on a concrete rig (MetaPerson) the same
 * values can deform the face (e.g. mouthClose pulls the lower lip onto the nose). This module lets you
 * override the pose for every viseme (key = ARPAbet phoneme for the G2P path / letter token
 * or digraph for the character path). Overrides are stored in localStorage; when there is no override,
 * the guesses from the tables (phoneme-visemes.ts / viseme-mappings.ts) apply.
 */

import { mapPhonemeToShapes } from './g2p/phoneme-visemes';
import { charDefaultShapesForToken } from './viseme-mappings';

/** Speech-apparatus shapes editable in the Viseme Editor (no eyes/brows). */
export const EDITOR_SHAPES = [
  'jawOpen',
  'mouthClose',
  'mouthPucker',
  'mouthFunnel',
  'mouthRollLower',
  'mouthShrugLower',
  'mouthUpperUpLeft',
  'mouthUpperUpRight',
  'mouthLowerDownLeft',
  'mouthLowerDownRight',
  'mouthSmileLeft',
  'mouthSmileRight',
  'mouthPressLeft',
  'mouthPressRight',
  'tongueOut',
] as const;

/** Visemes of the G2P (EN) engine — keys = ARPAbet phonemes. */
export interface VisemeRef {
  key: string;
  label: string;
}

export const EN_VISEMES: VisemeRef[] = [
  // Vowels
  { key: 'AA', label: 'AA — "father" (wide)' },
  { key: 'AE', label: 'AE — "cat"' },
  { key: 'AH', label: 'AH — "but"' },
  { key: 'AO', label: 'AO — "law / thought" (rounded)' },
  { key: 'AW', label: 'AW — "cow / how"' },
  { key: 'AY', label: 'AY — "my / time"' },
  { key: 'EH', label: 'EH — "bet / bed"' },
  { key: 'ER', label: 'ER — "her / bird" (r-colored)' },
  { key: 'EY', label: 'EY — "say / day"' },
  { key: 'IH', label: 'IH — "sit / bit"' },
  { key: 'IY', label: 'IY — "see / team"' },
  { key: 'OW', label: 'OW — "go / no"' },
  { key: 'OY', label: 'OY — "boy / toy"' },
  { key: 'UH', label: 'UH — "book / good"' },
  { key: 'UW', label: 'UW — "too / you" (pucker)' },
  // Consonants
  { key: 'P', label: 'P / B / M — "map" (closure)' },
  { key: 'B', label: 'B (shared with P/M — same pose)' },
  { key: 'M', label: 'M (shared with P/B — same pose)' },
  { key: 'F', label: 'F / V — "fine" (lip under teeth)' },
  { key: 'V', label: 'V (shared with F)' },
  { key: 'TH', label: 'TH — "think" (tongue between teeth)' },
  { key: 'DH', label: 'DH — "this" (shared with TH)' },
  { key: 'T', label: 'T / D / N — "time"' },
  { key: 'D', label: 'D (shared with T/N)' },
  { key: 'N', label: 'N (shared with T/D)' },
  { key: 'L', label: 'L — "like"' },
  { key: 'S', label: 'S / Z — "see / zoo"' },
  { key: 'Z', label: 'Z (shared with S)' },
  { key: 'SH', label: 'SH / ZH — "ship" (funnel)' },
  { key: 'ZH', label: 'ZH (shared with SH)' },
  { key: 'CH', label: 'CH / JH — "chat" (affricate)' },
  { key: 'JH', label: 'JH (shared with CH)' },
  { key: 'K', label: 'K / G — "cat / go"' },
  { key: 'G', label: 'G (shared with K)' },
  { key: 'NG', label: 'NG — "sing"' },
  { key: 'R', label: 'R — "red"' },
  { key: 'W', label: 'W — "we" (rounding)' },
  { key: 'Y', label: 'Y — "you" (palatal)' },
  { key: 'HH', label: 'HH — "hi" (aspirated)' },
];

/** Character-path visemes (PL / fallback char) — keys = tokens from viseme-mappings. */
export const CHAR_VISEMES: VisemeRef[] = [
  { key: 'A', label: 'A / Ą — wide opening' },
  { key: 'E', label: 'E / Ę — mid-open' },
  { key: 'I', label: 'I / Y — narrow' },
  { key: 'Y', label: 'Y (vowel) — like I' },
  { key: 'O', label: 'O / Ó — rounded' },
  { key: 'U', label: 'U — strong pucker' },
  { key: 'W', label: 'W (consonant) — glide' },
  { key: 'M', label: 'M / B / P — full closure' },
  { key: 'B', label: 'B (shared with M/P)' },
  { key: 'P', label: 'P (shared with M/B)' },
  { key: 'F', label: 'F / V — lower lip under teeth' },
  { key: 'V', label: 'V (shared with F)' },
  { key: 'L', label: 'L — tongue raised' },
  { key: 'T', label: 'T / D / N — dental' },
  { key: 'D', label: 'D (shared with T/N)' },
  { key: 'N', label: 'N (shared with T/D)' },
  { key: 'S', label: 'S / Z — sibilant, narrow' },
  { key: 'Z', label: 'Z (shared with S)' },
  { key: 'K', label: 'K / G — velar' },
  { key: 'G', label: 'G (shared with K)' },
  { key: 'C', label: 'C — context (soft→S / hard→K)' },
  { key: 'X', label: 'X — /ks/' },
  { key: 'H', label: 'H / CH — aspirated' },
  { key: 'R', label: 'R — approximation' },
  { key: 'J', label: 'J — palatal' },
  { key: 'Ą', label: 'Ą (nasal vowel)' },
  { key: 'Ę', label: 'Ę (nasal vowel)' },
  { key: 'Ó', label: 'Ó — like U' },
  { key: 'Ł', label: 'Ł — /w/-like' },
  { key: 'Ś', label: 'Ś / Ć / Ź — softened sibilants' },
  { key: 'Ć', label: 'Ć (shared with Ś/Ź)' },
  { key: 'Ź', label: 'Ź (shared with Ś/Ć)' },
  { key: 'Ż', label: 'Ż / RZ — like SH' },
  { key: 'Ń', label: 'Ń — palatal n' },
  { key: 'SZ', label: 'SZ / CZ — lip tube, teeth visible' },
  { key: 'CZ', label: 'CZ (shared with SZ)' },
  { key: 'RZ', label: 'RZ (shared with Ż)' },
  { key: 'DŻ', label: 'DŻ (shared with Ż/RZ)' },
  { key: 'DZ', label: 'DZ — like Z + D' },
  { key: 'DŹ', label: 'DŹ / SI / ZI / NI / CI — softened' },
  { key: 'SI', label: 'SI (shared with DŹ)' },
  { key: 'ZI', label: 'ZI (shared with DŹ)' },
  { key: 'NI', label: 'NI (shared with DŹ)' },
  { key: 'CI', label: 'CI (shared with DŹ)' },
  { key: 'SH', label: 'SH (EN digraph — like PL SZ)' },
  { key: 'CH', label: 'CH (EN digraph — like SH + stop)' },
  { key: 'TH', label: 'TH — tongue between teeth' },
  { key: 'PH', label: 'PH — like F' },
  { key: 'WH', label: 'WH — like W' },
  { key: 'QU', label: 'QU — /kw/' },
  { key: 'NG', label: 'NG — velar' },
];

export const VISEME_GROUPS = [
  { id: 'en', label: 'EN engine (G2P phonemes)', visemes: EN_VISEMES },
  { id: 'char', label: 'Character path (PL / fallback)', visemes: CHAR_VISEMES },
] as const;

export type VisemeOverrideMap = Record<string, Record<string, number>>;

const STORAGE_KEY = 'avatar_viseme_overrides_v1';

/** Reads viseme overrides from localStorage (empty when none). */
export function loadVisemeOverrides(): VisemeOverrideMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as VisemeOverrideMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    console.warn('[VisemeOverrides] Error reading overrides:', e);
    return {};
  }
}

/** Saves the whole viseme override map. */
export function saveVisemeOverrides(overrides: VisemeOverrideMap): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch (e) {
    console.warn('[VisemeOverrides] Error saving overrides:', e);
  }
}

/** Clears all overrides. */
export function clearVisemeOverrides(): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Default shape pose for a given viseme (used by the preview and when there is no override).
 * Returns null for visemes without shapes (e.g. space) or unknown ones.
 */
export function defaultVisemeShapes(key: string): Map<string, number> | null {
  const fromPhoneme = mapPhonemeToShapes(key);
  if (fromPhoneme) return fromPhoneme;
  const fromChar = charDefaultShapesForToken(key);
  return fromChar;
}

/** Checks whether the key is overridable (has default shapes). */
export function isEditableViseme(key: string): boolean {
  return defaultVisemeShapes(key) !== null;
}
