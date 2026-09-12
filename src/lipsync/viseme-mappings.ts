/**
 * Tabela mapowań znaków i dwuznaków na blendshape'y ARKit wg docs/3.
 */

export interface MappedShapeResult {
  shapes: Map<string, number>;
  consumedChars: number; // 2 dla dwuznaków, 1 dla pojedynczych znaków
}

/**
 * Sprawdza czy para znaków tworzy dwuznak z lookahead
 */
function tryMapDigraph(c1: string, c2: string): Map<string, number> | null {
  const pair = (c1 + c2).toUpperCase();

  switch (pair) {
    case 'SH':
      return new Map([
        ['jawOpen', 0.2],
        ['mouthFunnel', 0.5],
      ]);
    case 'CH':
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

    // Polskie dwuznaki i zmiękczenia
    case 'SZ':
    case 'CZ':
      return new Map([
        ['jawOpen', 0.14],
        ['mouthFunnel', 0.60],
        ['mouthPucker', 0.25],
        ['mouthUpperUpLeft', 0.22],
        ['mouthUpperUpRight', 0.22],
        ['mouthLowerDownLeft', 0.20],
        ['mouthLowerDownRight', 0.20],
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
 * Mapuje pojedynczy znak na wagi ARKit
 */
function mapSingleChar(char: string, nextChar?: string): Map<string, number> {
  const upper = char.toUpperCase();
  const nextUpper = (nextChar ?? '').toUpperCase();

  switch (upper) {
    // Samogłoski
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

    // Spółgłoski wargowe (PEŁNE DOMKNIĘCIE - LIPS-02)
    case 'M':
    case 'B':
    case 'P':
      return new Map([
        ['mouthClose', 1.0],
        ['mouthPressLeft', 0.15],
        ['mouthPressRight', 0.15],
      ]);

    // Spółgłoski wargowo-zębowe (F / V: górne zęby na dolnej wardze)
    case 'F':
    case 'V':
      return new Map([
        ['jawOpen', 0.12],
        ['mouthRollLower', 0.65],
        ['mouthUpperUpLeft', 0.50],
        ['mouthUpperUpRight', 0.50],
        ['mouthShrugLower', 0.18],
      ]);

    // Przedniojęzykowe
    case 'L':
      return new Map([
        ['jawOpen', 0.3],
        ['tongueOut', 0.3],
      ]);
    case 'T':
    case 'D':
    case 'N':
      return new Map([['jawOpen', 0.2]]);

    // Syczące
    case 'S':
    case 'Z':
      return new Map([
        ['jawOpen', 0.15],
        ['mouthSmileLeft', 0.15],
        ['mouthSmileRight', 0.15],
      ]);

    // Tylnojęzykowe
    case 'K':
    case 'G':
      return new Map([['jawOpen', 0.35]]);

    // Heurystyka kontekstowa dla 'C' (docs/3)
    case 'C': {
      const isSoft = ['E', 'I', 'Y'].includes(nextUpper);
      if (isSoft) {
        // Miękka wymowa jak S ("cell", "city")
        return new Map([
          ['jawOpen', 0.15],
          ['mouthSmileLeft', 0.15],
          ['mouthSmileRight', 0.15],
        ]);
      }
      // Twarda wymowa jak K ("cat", "cup")
      return new Map([['jawOpen', 0.35]]);
    }

    case 'X':
      // Połączenie K + S
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

    // Polskie znaki diakrytyczne
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

    // Spacja i interpunkcja -> naturalny spoczynek (brak wymuszania mouthClose!)
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
      // Nieznane znaki -> delikatna neutralna apertura
      return new Map([['jawOpen', 0.12]]);
  }
}

/**
 * Główna funkcja ekstrakcji wizemu z tekstu z uwzględnieniem lookahead dla dwuznaków
 */
export function mapCharToShapes(chars: string[], index: number): Map<string, number> {
  const currentChar = chars[index] ?? '';
  const nextChar = chars[index + 1];

  // 1. Sprawdź dwuznaki (lookahead)
  if (nextChar) {
    const digraphShapes = tryMapDigraph(currentChar, nextChar);
    if (digraphShapes) {
      return digraphShapes;
    }
  }

  // 2. Sprawdź pojedynczy znak
  return mapSingleChar(currentChar, nextChar);
}

// Dwuznaki rozpoznawane przez mapCharToShapes (EN + PL) — używane przez tokenizer nadpisań.
const KNOWN_DIGRAPH_PAIRS = new Set([
  'SH', 'CH', 'TH', 'PH', 'WH', 'QU', 'NG',
  'SZ', 'CZ', 'RZ', 'DŻ', 'DZ', 'DŹ', 'SI', 'ZI', 'NI', 'CI',
]);

/**
 * Zwraca "token" (klucz nadpisań wizemów) dla znaku o danym indeksie:
 * dwuznak gdy rozpoznany (2 znaki), w innym przypadku pojedyncza litera.
 * Zwraca null dla spacji/interpunkcji/nieznanych (brak edycji).
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
  if (!/[A-ZĄĆĘŁŃÓŚŹŻ]/.test(upper)) return null; // spacja, interpunkcja, cyfry...
  return upper;
}

/**
 * Domyślne kształty dla tokenu ścieżki znakowej (bez kontekstu — dla C brany wariant twardy).
 * Używane przez Edytor Wizemów i podgląd (viseme-overrides).
 */
export function charDefaultShapesForToken(token: string): Map<string, number> | null {
  if (!token) return null;
  if (token.length >= 2) {
    const digraph = tryMapDigraph(token[0], token[1]);
    if (digraph && digraph.size > 0) return digraph;
  }
  if (token.length === 1) {
    const single = mapSingleChar(token);
    if (single.size > 0) return single;
  }
  return null;
}
