/**
 * G2P (grapheme-to-phoneme) layer for English — docs/3 (v1.1, Phase 7; lexicon pruned in Phase 17).
 *
 * ElevenLabs returns a CHARACTER alignment (not phonemes). English spelling is not phonetic,
 * so silent letters and vowel digraphs produced phantom mouth movements. This module
 * turns words into ARPAbet phonemes using a pruned CMUdict lexicon, loaded lazily (a separate
 * Vite chunk), with a rule-based letter-to-sound fallback for out-of-lexicon words.
 *
 * The lexicon is a committed artifact (`dict-en-pruned.json`, ~10k conversational words) generated
 * by `npm run build:dict` from the full `cmu-pronouncing-dictionary` devDependency. The full
 * 135k-entry dictionary (3.9 MB / 961 kB gzip) no longer ships to the browser.
 *
 * Fallback ladder (a word never reaches "nothing"):
 *   lexicon -> apostrophes removed -> hyphen parts -> letter rules -> (caller) char path.
 *
 * Timing is NOT generated here — it comes from the ElevenLabs character alignment (phoneme-merge.ts).
 */

type PhonemeTable = Map<string, string[]>;

/** Shape of the committed lexicon artifact (see scripts/build-dict-en.mjs). */
interface PrunedLexicon {
  meta: { source: string; sourceVersion: string; entries: number };
  entries: Record<string, string>;
}

let phonemeTable: PhonemeTable | null = null;
let loadPromise: Promise<void> | null = null;
let loadFailed = false;

/**
 * Builds the internal phoneme table from the lexicon entries.
 * Keys are lowercase (some start with an apostrophe: "'bout"); values are ARPAbet strings.
 * Stress digits (0/1/2) are stripped from every phoneme (the artifact already has none; the
 * strip keeps the loader tolerant of a regenerated artifact that keeps stress).
 */
function buildTable(entries: Record<string, string>): PhonemeTable {
  const table: PhonemeTable = new Map();
  for (const [word, pronunciation] of Object.entries(entries)) {
    const phonemes = pronunciation.split(' ').map((p) => p.replace(/[0-2]/g, ''));
    table.set(word, phonemes);
  }
  return table;
}

/**
 * Lazy, memoized lexicon load. Dynamic import — Vite splits the artifact
 * into a separate chunk (does not block app startup). On a permanent error it sets
 * loadFailed (g2pAvailable() -> false) and retries on the next call.
 */
export function ensureG2pLoaded(): Promise<void> {
  if (loadFailed) loadPromise = null;
  if (!loadPromise) {
    loadPromise = import('./dict-en-pruned.json')
      .then((mod) => {
        // A JSON module exposes the parsed document as its default export.
        const lexicon = (mod as unknown as { default: PrunedLexicon }).default;
        phonemeTable = buildTable(lexicon.entries);
      })
      .catch((err) => {
        loadFailed = true;
        loadPromise = null;
        throw err;
      });
  }
  return loadPromise;
}

/** Whether the lexicon has been loaded successfully and is ready to use. */
export function isG2pReady(): boolean {
  return phonemeTable !== null;
}

/** Whether the G2P layer is available at all (did not end in a permanent error). */
export function g2pAvailable(): boolean {
  return !loadFailed;
}

// ---------------------------------------------------------------------------------------------
// Out-of-lexicon (OOV) letter-to-sound rules
// ---------------------------------------------------------------------------------------------

/**
 * Whole-word exceptions for silent-letter classes the generic rules cannot see
 * (word-internal silences, silent initial H). Deliberately CAPPED: every addition needs a row in
 * tests/fixtures/oov-wordlist.json — the test is the review gate, not a growing wordlist.
 */
const OOV_EXCEPTIONS: Readonly<Record<string, readonly string[]>> = {
  island: ['AY', 'L', 'AH', 'N', 'D'], // silent S
  listen: ['L', 'IH', 'S', 'AH', 'N'], // silent T
  castle: ['K', 'AE', 'S', 'AH', 'L'], // silent T
  receipt: ['R', 'IH', 'S', 'IY', 'T'], // silent P
  wednesday: ['W', 'EH', 'N', 'Z', 'D', 'IY'], // silent D (first), "-day" reduced
  sandwich: ['S', 'AE', 'N', 'W', 'IH', 'CH'], // silent D
  hour: ['AW', 'ER'], // silent H
  honest: ['AA', 'N', 'AH', 'S', 'T'], // silent H
  honor: ['AA', 'N', 'ER'], // silent H
  heir: ['EH', 'R'], // silent H
};

const isVowelLetter = (c: string) => c !== '' && 'aeiouy'.includes(c);

/**
 * Suffix classes handled before the letter loop. Each strips the suffix, runs the letter rules on
 * the stem and appends the suffix phonemes — so the suffix letters never reach the generic loop
 * (where "tion" would produce T-IH-OW-N and "listen" a phantom T).
 *  - `-sten` / `-stle` (listen, glisten, fasten, castle, whistle): the T is silent
 *  - `-ceipt` (receipt, "deceipt"): the P is silent
 *  - `-tion` / `-stion` / `-sion` (automation, question, mission, vision): two phonemes, not four
 */
function applySuffixRules(w: string): string[] | null {
  const plural = w.endsWith('s') ? ['Z'] : [];
  const bare = plural.length > 0 ? w.slice(0, -1) : w;

  if (w.endsWith('ceipt')) {
    return [...letterRules(w.slice(0, -5)), 'S', 'IY', 'T'];
  }
  if (w.length > 5 && /[a-z]sten$/.test(w)) return [...letterRules(w.slice(0, -3)), 'AH', 'N'];
  if (w.length > 5 && /[a-z]stle$/.test(w)) return [...letterRules(w.slice(0, -3)), 'AH', 'L'];

  if (bare.length > 4 && bare.endsWith('stion')) {
    return [...letterRules(bare.slice(0, -4)), 'CH', 'AH', 'N', ...plural];
  }
  if (bare.length > 4 && bare.endsWith('tion')) {
    return [...longVowelBefore(letterRules(bare.slice(0, -4)), bare.slice(0, -4)), 'SH', 'AH', 'N', ...plural];
  }
  if (bare.length > 4 && bare.endsWith('sion')) {
    let stem = bare.slice(0, -4);
    if (stem.endsWith('s')) {
      // Doubled S (mission, passion): one SH covers both letters.
      stem = stem.slice(0, -1);
      return [...letterRules(stem), 'SH', 'AH', 'N', ...plural];
    }
    // After a vowel the S is voiced (vision, decision); after a consonant it is SH (tension).
    const voiced = isVowelLetter(stem[stem.length - 1] ?? '');
    return [...longVowelBefore(letterRules(stem), stem), voiced ? 'ZH' : 'SH', 'AH', 'N', ...plural];
  }
  return null;
}

/** A lone a/o/u before -tion/-sion is long (nation, notion, solution); other vowels keep their letter sound. */
function longVowelBefore(phonemes: string[], stem: string): string[] {
  const last = stem[stem.length - 1] ?? '';
  const beforeLast = stem[stem.length - 2] ?? '';
  const replacement = ({ a: 'EY', o: 'OW', u: 'UW' } as Record<string, string>)[last];
  if (!replacement || isVowelLetter(beforeLast) || phonemes.length === 0) return phonemes;
  return [...phonemes.slice(0, -1), replacement];
}

/**
 * Rule-based letter-to-sound fallback for out-of-lexicon (OOV) words.
 * Order: whole-word exceptions -> suffix classes -> letter loop.
 * It does not have to be perfect — it is a safety net for rare words/proper names.
 * Exported for tests (lexicon words never reach it in production).
 */
export function rulesFallback(word: string): string[] {
  const w = word.toLowerCase();
  const exception = OOV_EXCEPTIONS[w];
  if (exception) return [...exception];
  const viaSuffix = applySuffixRules(w);
  if (viaSuffix) return viaSuffix.length > 0 ? viaSuffix : [''];
  return letterRules(w);
}

/** The ordered letter loop: digraphs first, then single letters. */
function letterRules(w: string): string[] {
  const out: string[] = [];
  let i = 0;
  const n = w.length;

  const at = (offset: number) => (i + offset < n ? w[i + offset] : '');

  while (i < n) {
    const c = w[i];
    const pair = c + at(1);
    const triple = pair + at(2);

    // Silent endings
    if (i === n - 1 && c === 'e') {
      // magic-e / silent final e — skipped unless it is the only vowel
      const hasOtherVowel = w.slice(0, n - 1).split('').some(isVowelLetter);
      if (hasOtherVowel) {
        i += 1;
        continue;
      }
    }
    if (i === n - 2 && pair === 'ed' && i >= 2 && w.slice(0, i).split('').some(isVowelLetter)) {
      // Past-tense -ed after a stem (only OOV words reach this: CMU covers wanted/played/jumped).
      //   after t/d            -> IH D  (wanted, needed)
      //   after voiceless stop -> T     (jumped, asked, laughed, pushed)
      //   otherwise            -> D     (played, opened)
      const prev = w[i - 1];
      if (prev === 't' || prev === 'd') out.push('IH', 'D');
      else if ('pkfsx'.includes(prev) || w.slice(i - 2, i) === 'sh' || w.slice(i - 2, i) === 'ch') out.push('T');
      else out.push('D');
      i += 2;
      continue;
    }

    // Consonant digraphs
    switch (pair) {
      case 'sh': out.push('SH'); i += 2; continue;
      case 'ch': out.push('CH'); i += 2; continue;
      case 'th': out.push('TH'); i += 2; continue;
      case 'ph': out.push('F'); i += 2; continue;
      case 'wh': out.push('W'); i += 2; continue;
      case 'ck': out.push('K'); i += 2; continue;
      case 'qu': out.push('K', 'W'); i += 2; continue;
      case 'ng': out.push('NG'); i += 2; continue;
      case 'zz': out.push('Z'); i += 2; continue;
      case 'kn': if (i === 0) { out.push('N'); i += 2; continue; } break;
      case 'wr': if (i === 0) { out.push('R'); i += 2; continue; } break;
      case 'mb': if (i === n - 2) { out.push('M'); i += 2; continue; } break;
      case 'gh':
        if (i === n - 2 || (i > 0 && isVowelLetter(w[i - 1]))) {
          i += 2; // silent gh (end of word or after a vowel)
          continue;
        }
        out.push('G'); i += 2; continue;
      default: break;
    }

    // Vowel pairs
    switch (pair) {
      case 'ee': out.push('IY'); i += 2; continue;
      case 'ea': out.push('IY'); i += 2; continue;
      case 'oo': out.push('UW'); i += 2; continue;
      case 'ou': out.push('AW'); i += 2; continue;
      case 'ow': out.push('OW'); i += 2; continue;
      case 'ai': out.push('EY'); i += 2; continue;
      case 'ay': out.push('EY'); i += 2; continue;
      case 'oi': out.push('OY'); i += 2; continue;
      case 'oy': out.push('OY'); i += 2; continue;
      case 'au': out.push('AO'); i += 2; continue;
      case 'aw': out.push('AO'); i += 2; continue;
      case 'oa': out.push('OW'); i += 2; continue;
      case 'ie': out.push('IY'); i += 2; continue;
      case 'ue': out.push('UW'); i += 2; continue;
      case 'ui': out.push('UW'); i += 2; continue;
      default: break;
    }

    // Trigraph at the start of a word (e.g. "sch" -> SK)
    if (triple === 'sch' && i === 0) {
      out.push('S', 'K'); i += 3; continue;
    }

    // Word-internal silent letters: S in "isl-" (island, isle), B before T (doubt, subtle, debt).
    if (c === 's' && at(1) === 'l' && w[i - 1] === 'i') { i += 1; continue; }
    if (c === 'b' && at(1) === 't' && i > 0) { i += 1; continue; }

    // Doubled consonant letters (mopping, attention) are one sound, not two visemes.
    if (c === at(1) && 'bdfgklmnprstvz'.includes(c)) { i += 1; continue; }

    // Single consonants
    switch (c) {
      case 'b': out.push('B'); i += 1; continue;
      case 'c':
        if (['e', 'i', 'y'].includes(at(1))) { out.push('S'); } else { out.push('K'); }
        i += 1; continue;
      case 'd': out.push('D'); i += 1; continue;
      case 'f': out.push('F'); i += 1; continue;
      case 'g': out.push('G'); i += 1; continue;
      case 'h':
        if (i === 0) { out.push('HH'); }
        else if (i > 0 && i < n - 1 && isVowelLetter(w[i - 1]) && isVowelLetter(at(1))) {
          // h between vowels — silent in many cases
        } else { out.push('HH'); }
        i += 1; continue;
      case 'j': out.push('JH'); i += 1; continue;
      case 'k': out.push('K'); i += 1; continue;
      case 'l': out.push('L'); i += 1; continue;
      case 'm': out.push('M'); i += 1; continue;
      case 'n': out.push('N'); i += 1; continue;
      case 'p': out.push('P'); i += 1; continue;
      case 'q': out.push('K'); i += 1; continue;
      case 'r': out.push('R'); i += 1; continue;
      case 's': out.push('S'); i += 1; continue;
      case 't': out.push('T'); i += 1; continue;
      case 'v': out.push('V'); i += 1; continue;
      case 'w': out.push('W'); i += 1; continue;
      case 'x': out.push('K', 'S'); i += 1; continue;
      case 'z': out.push('Z'); i += 1; continue;
      default: break;
    }

    // Single vowels
    switch (c) {
      case 'a': out.push('AE'); i += 1; continue;
      case 'e': out.push('EH'); i += 1; continue;
      case 'i': out.push('IH'); i += 1; continue;
      case 'o': out.push('AA'); i += 1; continue;
      case 'u': out.push('AH'); i += 1; continue;
      case 'y':
        out.push(i === 0 ? 'Y' : 'IH'); i += 1; continue;
      default:
        i += 1; continue; // unknown character (digit etc.) — skip
    }
  }

  return out.length > 0 ? out : [''];
}

// ---------------------------------------------------------------------------------------------
// Public lookup
// ---------------------------------------------------------------------------------------------

// A typographic apostrophe (U+2019) is folded to the ASCII one: the lexicon keys use U+0027 only.
const normalizeWord = (word: string) => word.toLowerCase().replace(/’/g, "'").replace(/[^a-z'-]/g, '');

/**
 * Lexicon-only lookup (no rules): direct -> apostrophes removed -> every hyphen part present.
 * Returns null when the word would need the letter rules (or the lexicon is not loaded).
 */
function lookupLexicon(w: string): string[] | null {
  const table = phonemeTable;
  if (!table) return null;

  const direct = table.get(w);
  if (direct) return direct;

  if (w.includes("'")) {
    const stripped = table.get(w.replace(/'/g, ''));
    if (stripped) return stripped;
  }

  if (w.includes('-')) {
    const merged: string[] = [];
    for (const part of w.split('-')) {
      const found = table.get(part);
      if (!found) return null;
      merged.push(...found);
    }
    return merged;
  }

  return null;
}

/**
 * Whether the word resolves from the pruned lexicon itself (no letter rules involved).
 * Used by the corpus hit-rate test and available for telemetry.
 */
export function wordInLexicon(word: string): boolean {
  const w = normalizeWord(word);
  return w !== '' && lookupLexicon(w) !== null;
}

/**
 * Turns a single word into ARPAbet phonemes (without stress digits).
 * Order: lexicon -> apostrophe removed -> hyphenated parts -> rules.
 * Returns null only for empty/non-letter input or while the lexicon is not loaded.
 */
export function wordToPhonemesSync(word: string): string[] | null {
  const w = normalizeWord(word);
  if (!w) return null;

  if (!phonemeTable) return null; // G2P not ready — the caller decides how to degrade

  return lookupLexicon(w) ?? rulesFallback(w);
}
