/**
 * Per-word language dispatch for the phoneme path (Phase 17-04).
 *
 * Scope is deliberately small: a word is Polish when it carries a Polish diacritic, or when it carries a
 * Polish-only digraph (sz / cz / rz / dz) and the English lexicon does not know it. Everything else
 * follows the engine's default language (settings: `phoneme-en` -> en, `phoneme-pl` -> pl).
 * Mixed-language TURN detection beyond this is explicitly out of scope (docs: 17-CONTEXT A.7).
 */

import { wordInLexicon } from './g2p-en';

export type G2pLanguage = 'en' | 'pl';

/** Characters of a word run for the phoneme path: ASCII letters, Polish diacritics, apostrophes, hyphens. */
export const WORD_CHAR = /[A-Za-z\u0104\u0105\u0106\u0107\u0118\u0119\u0141\u0142\u0143\u0144\u00D3\u00F3\u015A\u015B\u0179\u017A\u017B\u017C'\u2019-]/;

const PL_DIACRITIC = /[\u0104\u0105\u0106\u0107\u0118\u0119\u0141\u0142\u0143\u0144\u00D3\u00F3\u015A\u015B\u0179\u017A\u017B\u017C]/;

/** Digraphs that exist in Polish but not in ordinary English words. */
const PL_ONLY_DIGRAPH = /sz|cz|rz|dz/i;

export function hasPolishDiacritic(text: string): boolean {
  return PL_DIACRITIC.test(text);
}

/** Language of one word; `fallback` decides when the word carries no Polish evidence. */
export function detectWordLanguage(word: string, fallback: G2pLanguage): G2pLanguage {
  if (PL_DIACRITIC.test(word)) return 'pl';
  if (PL_ONLY_DIGRAPH.test(word) && !wordInLexicon(word)) return 'pl';
  return fallback;
}

/**
 * Chunk-level check used by the character path (allocation-free): true when any letter run in
 * `chars` is Polish by the per-word rule. A cheap scan; the caller runs it once per audio chunk.
 */
export function charsLookPolish(chars: readonly string[]): boolean {
  let word = '';
  for (let i = 0; i <= chars.length; i++) {
    const ch = chars[i] ?? ''; // '' past the end flushes the last word
    if (ch !== '' && WORD_CHAR.test(ch)) {
      word += ch;
      continue;
    }
    if (word !== '') {
      if (detectWordLanguage(word, 'en') === 'pl') return true;
      word = '';
    }
  }
  return false;
}
