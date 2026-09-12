/**
 * Edytor Wizemów (docs/3 v1.1): ręczne nadpisania ułożenia blendshape'ów PER WIZEM.
 *
 * Uzasadnienie: combosy ARKit z tabel to domysły — na konkretnym riggu (MetaPerson) te same
 * wartości potrafią deformować (np. mouthClose ciągnie dolną wargę na nos). Ten moduł pozwala
 * nadpisać ułożenie dla każdego wizemu (klucz = fonem ARPAbet dla ścieżki G2P / token litery
 * lub dwuznaku dla ścieżki znakowej). Nadpisania zapisywane w localStorage; gdy brak nadpisania,
 * obowiązują domysły z tabel (phoneme-visemes.ts / viseme-mappings.ts).
 */

import { mapPhonemeToShapes } from './g2p/phoneme-visemes';
import { charTokenFor, charDefaultShapesForToken } from './viseme-mappings';

/** Kształty aparatu mowy edytowalne w Edytorze Wizemów (bez oczu/brwi). */
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

/** Wizemy silnika G2P (EN) — klucze = fonemy ARPAbet. */
export interface VisemeRef {
  key: string;
  label: string;
}

export const EN_VISEMES: VisemeRef[] = [
  // Samogłoski
  { key: 'AA', label: 'AA — "father" (szeroko)' },
  { key: 'AE', label: 'AE — "cat"' },
  { key: 'AH', label: 'AH — "but"' },
  { key: 'AO', label: 'AO — "law / thought" (zaokrąglone)' },
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
  { key: 'UW', label: 'UW — "too / you" (dzióbek)' },
  // Spółgłoski
  { key: 'P', label: 'P / B / M — "map" (domknięcie)' },
  { key: 'B', label: 'B (dzielone z P/M — ta sama poza)' },
  { key: 'M', label: 'M (dzielone z P/B — ta sama poza)' },
  { key: 'F', label: 'F / V — "fine" (warga pod zęby)' },
  { key: 'V', label: 'V (dzielone z F)' },
  { key: 'TH', label: 'TH — "think" (język między zębami)' },
  { key: 'DH', label: 'DH — "this" (dzielone z TH)' },
  { key: 'T', label: 'T / D / N — "time"' },
  { key: 'D', label: 'D (dzielone z T/N)' },
  { key: 'N', label: 'N (dzielone z T/D)' },
  { key: 'L', label: 'L — "like"' },
  { key: 'S', label: 'S / Z — "see / zoo"' },
  { key: 'Z', label: 'Z (dzielone z S)' },
  { key: 'SH', label: 'SH / ZH — "ship" (tuba)' },
  { key: 'ZH', label: 'ZH (dzielone z SH)' },
  { key: 'CH', label: 'CH / JH — "chat" (afrykata)' },
  { key: 'JH', label: 'JH (dzielone z CH)' },
  { key: 'K', label: 'K / G — "cat / go"' },
  { key: 'G', label: 'G (dzielone z K)' },
  { key: 'NG', label: 'NG — "sing"' },
  { key: 'R', label: 'R — "red"' },
  { key: 'W', label: 'W — "we" (zaokrąglenie)' },
  { key: 'Y', label: 'Y — "you" (palatalne)' },
  { key: 'HH', label: 'HH — "hi" (przydech)' },
];

/** Wizemy ścieżki znakowej (PL / fallback char) — klucze = tokeny z viseme-mappings. */
export const CHAR_VISEMES: VisemeRef[] = [
  { key: 'A', label: 'A / Ą — szerokie otwarcie' },
  { key: 'E', label: 'E / Ę — średnio otwarte' },
  { key: 'I', label: 'I / Y — wąskie' },
  { key: 'Y', label: 'Y (samogłoska) — jak I' },
  { key: 'O', label: 'O / Ó — zaokrąglone' },
  { key: 'U', label: 'U — mocny dzióbek' },
  { key: 'W', label: 'W (spółgłoska) — glide' },
  { key: 'M', label: 'M / B / P — pełne domknięcie' },
  { key: 'B', label: 'B (dzielone z M/P)' },
  { key: 'P', label: 'P (dzielone z M/B)' },
  { key: 'F', label: 'F / V — dolna warga pod zęby' },
  { key: 'V', label: 'V (dzielone z F)' },
  { key: 'L', label: 'L — język w górze' },
  { key: 'T', label: 'T / D / N — zębowe' },
  { key: 'D', label: 'D (dzielone z T/N)' },
  { key: 'N', label: 'N (dzielone z T/D)' },
  { key: 'S', label: 'S / Z — syczące, wąsko' },
  { key: 'Z', label: 'Z (dzielone z S)' },
  { key: 'K', label: 'K / G — tylnojęzykowe' },
  { key: 'G', label: 'G (dzielone z K)' },
  { key: 'C', label: 'C — kontekst (soft→S / hard→K)' },
  { key: 'X', label: 'X — /ks/' },
  { key: 'H', label: 'H / CH — przydech' },
  { key: 'R', label: 'R — aproksymacja' },
  { key: 'J', label: 'J — palatalne' },
  { key: 'Ą', label: 'Ą (nosówka)' },
  { key: 'Ę', label: 'Ę (nosówka)' },
  { key: 'Ó', label: 'Ó — jak U' },
  { key: 'Ł', label: 'Ł — /w/-like' },
  { key: 'Ś', label: 'Ś / Ć / Ź — zmiękczone syczące' },
  { key: 'Ć', label: 'Ć (dzielone ze Ś/Ź)' },
  { key: 'Ź', label: 'Ź (dzielone ze Ś/Ć)' },
  { key: 'Ż', label: 'Ż / RZ — jak SH' },
  { key: 'Ń', label: 'Ń — palatalne n' },
  { key: 'SZ', label: 'SZ / CZ — tunel, zęby widoczne' },
  { key: 'CZ', label: 'CZ (dzielone z SZ)' },
  { key: 'RZ', label: 'RZ (dzielone z Ż)' },
  { key: 'DŻ', label: 'DŻ (dzielone z Ż/RZ)' },
  { key: 'DZ', label: 'DZ — jak Z + D' },
  { key: 'DŹ', label: 'DŹ / SI / ZI / NI / CI — zmiękczone' },
  { key: 'SI', label: 'SI (dzielone z DŹ)' },
  { key: 'ZI', label: 'ZI (dzielone z DŹ)' },
  { key: 'NI', label: 'NI (dzielone z DŹ)' },
  { key: 'CI', label: 'CI (dzielone z DŹ)' },
  { key: 'SH', label: 'SH (EN dwuznak — jak PL SZ)' },
  { key: 'CH', label: 'CH (EN dwuznak — jak SH+zwarcie)' },
  { key: 'TH', label: 'TH — język między zębami' },
  { key: 'PH', label: 'PH — jak F' },
  { key: 'WH', label: 'WH — jak W' },
  { key: 'QU', label: 'QU — /kw/' },
  { key: 'NG', label: 'NG — tylnojęzykowe' },
];

export const VISEME_GROUPS = [
  { id: 'en', label: 'Silnik EN (fonemy G2P)', visemes: EN_VISEMES },
  { id: 'char', label: 'Ścieżka znaków (PL / fallback)', visemes: CHAR_VISEMES },
] as const;

export type VisemeOverrideMap = Record<string, Record<string, number>>;

const STORAGE_KEY = 'avatar_viseme_overrides_v1';

/** Czyta nadpisania wizemów z localStorage (pusto gdy brak). */
export function loadVisemeOverrides(): VisemeOverrideMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as VisemeOverrideMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    console.warn('[VisemeOverrides] Błąd odczytu nadpisań:', e);
    return {};
  }
}

/** Zapisuje całą mapę nadpisań wizemów. */
export function saveVisemeOverrides(overrides: VisemeOverrideMap): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch (e) {
    console.warn('[VisemeOverrides] Błąd zapisu nadpisań:', e);
  }
}

/** Czyści wszystkie nadpisania. */
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
 * Domyślne ułożenie kształtów dla danego wizemu (używane przez podgląd i gdy brak nadpisania).
 * Zwraca null dla wizemów bez kształtów (np. spacja) lub nieznanych.
 */
export function defaultVisemeShapes(key: string): Map<string, number> | null {
  const fromPhoneme = mapPhonemeToShapes(key);
  if (fromPhoneme) return fromPhoneme;
  const fromChar = charDefaultShapesForToken(key);
  return fromChar;
}

/** Sprawdza czy klucz jest nadpisywalny (ma domyślne kształty). */
export function isEditableViseme(key: string): boolean {
  return defaultVisemeShapes(key) !== null;
}

export { charTokenFor };
