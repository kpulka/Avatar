/**
 * Warstwa G2P (grapheme-to-phoneme) dla języka angielskiego — docs/3 (v1.1, Faza 7).
 *
 * ElevenLabs zwraca alignment ZNAKÓW (nie fonemów). Angielska ortografia nie jest fonetyczna,
 * więc litery nieme i dwuznaki samogłoskowe produkowały fantomowe ruchy ust. Ten moduł
 * zamienia słowa na fonemy ARPAbet przy użyciu leksykonu CMUdict (pakiet
 * `cmu-pronouncing-dictionary`), ładowanego leniwie (osobny chunk Vite), z regułowym
 * fallbackiem letter-to-sound dla słów spoza leksykonu.
 *
 * Timing NIE jest tu generowany — pochodzi z alignmentu znaków ElevenLabs (phoneme-merge.ts).
 */

type PhonemeTable = Map<string, string[]>;

let phonemeTable: PhonemeTable | null = null;
let loadPromise: Promise<void> | null = null;
let loadFailed = false;

/**
 * Buduje wewnętrzną tablicę fonemów z obiektu słownika CMUdict.
 * Klucze są lowercase (część zaczyna się apostrofem: "'bout"); wartości to stringi ARPAbet
 * z cyframi stresu (0/1/2), które są usuwane z każdego fonemu.
 */
function buildTable(dictionary: Record<string, string>): PhonemeTable {
  const table: PhonemeTable = new Map();
  for (const [word, pronunciation] of Object.entries(dictionary)) {
    const phonemes = pronunciation.split(' ').map((p) => p.replace(/[0-2]/g, ''));
    table.set(word, phonemes);
  }
  return table;
}

/**
 * Leniwy, memoizowany ładunek słownika. Dynamiczny import — Vite wydziela słownik
 * do osobnego chunka (nie blokuje startu aplikacji). Przy trwałym błędzie ustawia
 * loadFailed (g2pAvailable() → false) i ponawia przy kolejnym wywołaniu.
 */
export function ensureG2pLoaded(): Promise<void> {
  if (loadFailed) loadPromise = null;
  if (!loadPromise) {
    loadPromise = import('cmu-pronouncing-dictionary')
      .then((mod) => {
        // Pakiet eksportuje WYŁĄCZNIE nazwany eksport `dictionary` (brak default).
        phonemeTable = buildTable((mod as { dictionary: Record<string, string> }).dictionary);
      })
      .catch((err) => {
        loadFailed = true;
        loadPromise = null;
        throw err;
      });
  }
  return loadPromise;
}

/** Czy słownik został pomyślnie załadowany i jest gotowy do użycia. */
export function isG2pReady(): boolean {
  return phonemeTable !== null;
}

/** Czy warstwa G2P jest w ogóle dostępna (nie zakończyła się trwałym błędem). */
export function g2pAvailable(): boolean {
  return !loadFailed;
}

/**
 * Regułowy fallback letter-to-sound dla słów spoza leksykonu (OOV).
 * Przetwarza litery od lewej do prawej — najpierw dwuznaki, potem pojedyncze litery.
 * Nie musi być idealny — to siatka bezpieczeństwa dla rzadkich słów/nazw własnych.
 */
function rulesFallback(word: string): string[] {
  const w = word.toLowerCase();
  const out: string[] = [];
  let i = 0;
  const n = w.length;

  const isVowelLetter = (c: string) => 'aeiouy'.includes(c);
  const at = (offset: number) => (i + offset < n ? w[i + offset] : '');

  while (i < n) {
    const c = w[i];
    const pair = c + at(1);
    const triple = pair + at(2);

    // Końcówki nieme
    if (i === n - 1 && c === 'e') {
      // magic-e / nieme końcowe e — pomijane, chyba że jest jedyną samogłoską
      const hasOtherVowel = w.slice(0, n - 1).split('').some(isVowelLetter);
      if (hasOtherVowel) {
        i += 1;
        continue;
      }
    }
    if (i === n - 2 && w.slice(n - 2) === 'ed') {
      // końcówka -ed po spółgłosce (np. "walked") — pomijana w uproszczeniu
      i += 2;
      continue;
    }

    // Dwuznaki spółgłoskowe
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
          i += 2; // nieme gh (koniec słowa lub po samogłosce)
          continue;
        }
        out.push('G'); i += 2; continue;
      default: break;
    }

    // Pary samogłoskowe
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

    // Trójznak na początku wyrazu (np. "sch" -> SK)
    if (triple === 'sch' && i === 0) {
      out.push('S', 'K'); i += 3; continue;
    }

    // Pojedyncze spółgłoski
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
          // h między samogłoskami — ciche w wielu przypadkach
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

    // Pojedyncze samogłoski
    switch (c) {
      case 'a': out.push('AE'); i += 1; continue;
      case 'e': out.push('EH'); i += 1; continue;
      case 'i': out.push('IH'); i += 1; continue;
      case 'o': out.push('AA'); i += 1; continue;
      case 'u': out.push('AH'); i += 1; continue;
      case 'y':
        out.push(i === 0 ? 'Y' : 'IH'); i += 1; continue;
      default:
        i += 1; continue; // nieznany znak (cyfra/itd.) — pomiń
    }
  }

  return out.length > 0 ? out : [''];
}

/**
 * Zamienia pojedyncze słowo na fonemy ARPAbet (bez cyfr stresu).
 * Kolejność: leksykon → apostrof usunięty → człony po łączniku → reguły.
 * Zwraca null tylko dla pustego/nieliterowego wejścia.
 */
export function wordToPhonemesSync(word: string): string[] | null {
  const w = word.toLowerCase().replace(/[^a-z'’-]/g, '');
  if (!w) return null;

  const table = phonemeTable;
  if (!table) return null; // G2P niegotowy — wywołujący decyduje o degradacji

  const lookup = (token: string): string[] | null => {
    const hit = table.get(token);
    return hit ? hit : null;
  };

  const direct = lookup(w);
  if (direct) return direct;

  if (w.includes("'")) {
    const stripped = lookup(w.replace(/'/g, ''));
    if (stripped) return stripped;
  }

  if (w.includes('-')) {
    const parts = w.split('-');
    const merged: string[] = [];
    for (const part of parts) {
      const found = lookup(part);
      if (!found) return rulesFallback(w);
      merged.push(...found);
    }
    return merged;
  }

  return rulesFallback(w);
}
