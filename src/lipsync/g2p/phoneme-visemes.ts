/**
 * Tabela fonem ARPAbet → wizemy ARKit (docs/3, v1.x, Faza 7).
 *
 * Wartości to CELE EFEKTYWNE — po zmianie semantyki skal (07-02) scheduler mnoży je
 * dokładnie raz przez scale profilu (domyślnie 1.0). Klucze lustrzane (L/R) symetryczne.
 *
 * v1.3 (2026-09): więcej "mocy" (większe amplitudy żuchwy/uśmiechu/zaokrąglenia) + "smaczek"
 * z dodatkowych blendshape'ów, by wizemy nie były "gołe" 1-2 shape'y:
 *   - otwarte samogłoski (AA/AE/AH/AW): lowerDown → czytelniejsze otwarcie + dolne zęby,
 *   - przednie (EY/IY): upperUp (górne zęby) wzmocnione,
 *   - dzióbki (UW/W): shrugLower podbija wysunięcie warg,
 *   - syczące SZ / tuba SH: więcej odsłoniętych zębów,
 *   - K/G/NG/T/D/N/L: delikatne lowerDown/upperUp, by "neutralne" wizemy nie były puste.
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

/** Buduje Map<shape, weight> z pozą; klucze lustrzane (L/R) ustawiane symetrycznie. */
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
 * Mapuje fonem ARPAbet na docelowe wagi ARKit.
 * Zwraca null dla nieznanego fonemu (kolejkant pomija go bez błędu).
 */
export function mapPhonemeToShapes(phoneme: string): Map<string, number> | null {
  switch (phoneme) {
    // ---- Przednie (drabinka: jaw + smile + zęby; im wyżej, tym więcej "smile mowy") ----
    case 'IY': // "see" — najjaśniejszy uśmiech mowy + górne zęby
      return pose({ jaw: 0.25, smile: 0.38, upperUp: 0.12 });
    case 'IH': // "bit" — luźne, prawie bez uśmiechu
      return pose({ jaw: 0.26, smile: 0.16 });
    case 'EY': // "say" — mocny pół-uśmiech + górne zęby
      return pose({ jaw: 0.34, smile: 0.34, upperUp: 0.14 });
    case 'EH': // "bed" — otwarte, lekko pokazane dolne zęby
      return pose({ jaw: 0.42, smile: 0.24, lowerDown: 0.08 });
    case 'AE': // "cat" — szeroko, dolne zęby widoczne
      return pose({ jaw: 0.52, smile: 0.18, lowerDown: 0.12 });
    case 'AA': // "father" — max otwarcie + dolne zęby (moc)
      return pose({ jaw: 0.6, smile: 0.1, lowerDown: 0.15 });
    case 'AH': // "but" — średnio otwarte, neutralne
      return pose({ jaw: 0.44, lowerDown: 0.08 });

    // ---- Tylne (owal → tuba; UW/W dostają shrug podbijający wysunięcie) ----
    case 'AO': // "thought" — otwarty owal
      return pose({ jaw: 0.4, pucker: 0.5, funnel: 0.3, lowerDown: 0.08 });
    case 'OW': // "go" — zwarte zaokrąglenie (moc)
      return pose({ jaw: 0.34, pucker: 0.6, funnel: 0.5 });
    case 'AW': // "how" — szeroko → zaokrąglenie (start otwarty: dolne zęby)
      return pose({ jaw: 0.46, pucker: 0.52, lowerDown: 0.12 });
    case 'UH': // "book" — lekki dzióbek
      return pose({ jaw: 0.24, pucker: 0.5, funnel: 0.22 });
    case 'UW': // "too" — maks dzióbek + uniesienie dolnej wargi (protrusja)
      return pose({ jaw: 0.2, pucker: 0.7, funnel: 0.45, shrug: 0.08 });

    // ---- R-kolorowane / dyftongi ----
    case 'ER': // "her" — r-colored z delikatnym zaokrągleniem
      return pose({ jaw: 0.32, funnel: 0.22, pucker: 0.16 });
    case 'AY': // "my" — szeroko → uśmiech
      return pose({ jaw: 0.46, smile: 0.26, lowerDown: 0.08 });
    case 'OY': // "boy" — zaokrąglenie → uśmiech
      return pose({ jaw: 0.42, pucker: 0.45, smile: 0.1 });

    // ---- Spółgłoski wargowe (MetaPerson: wysokie mouthClose ciągnie dolną wargę na nos) ----
    // Phase 11.2 SHOW-06 (D-7): zamknięcie z jaw ≈ 0 + docisk warg (press) + podwinięcie (roll),
    // z NISKIM mouthClose. Wartości tabeli x skala profilu 'balanced' (closeScale 0.60 dotyczy
    // mouthClose ORAZ mouthPress*; roll/jaw skala 1.0):
    //   jawOpen        0.02 x 1.0  = 0.02  (<= 0.03)
    //   mouthClose     0.50 x 0.60 = 0.30  (<= 0.35)
    //   mouthPress L/R 0.58 x 0.60 = 0.35  (0.35 +- 0.05)
    //   mouthRollLower 0.25 x 1.0  = 0.25
    //   mouthRollUpper 0.15 x 1.0  = 0.15
    case 'P':
    case 'B':
    case 'M':
      return pose({ jaw: 0.02, close: 0.5, press: 0.58, rollLower: 0.25, rollUpper: 0.15 });

    // ---- Wargowo-zębowe (dolna warga pod górne zęby; mocny roll) ----
    case 'F':
    case 'V':
      return pose({ jaw: 0.12, roll: 0.7, upperUp: 0.55, shrug: 0.2, lowerDown: 0.05 });

    // ---- Międzyzębowe (widoczny język) ----
    case 'TH':
    case 'DH':
      return pose({ jaw: 0.22, tongue: 0.38 });

    // ---- Zębodołowe / nosowe (lekka obecność zębów, by nie były "puste") ----
    case 'T':
    case 'D':
    case 'N':
      return pose({ jaw: 0.2, upperUp: 0.06, lowerDown: 0.06 });
    case 'L': // L = język W GÓRZE; tongueOut tylko symboliczny
      return pose({ jaw: 0.32, tongue: 0.12, lowerDown: 0.08 });

    // ---- Syczące (mocne odsłonięcie zębów) ----
    case 'S':
    case 'Z':
      return pose({ jaw: 0.16, smile: 0.2, upperUp: 0.16, lowerDown: 0.16 });

    // ---- Palatalne / afrykaty (tuba + zęby; CH zwarty start) ----
    case 'SH':
    case 'ZH':
      return pose({ jaw: 0.22, funnel: 0.55, pucker: 0.16, upperUp: 0.14, lowerDown: 0.14 });
    case 'CH':
    case 'JH':
      return pose({ jaw: 0.3, funnel: 0.45, pucker: 0.1, lowerDown: 0.1 });

    // ---- Tylnojęzykowe (otwarcie + dolne zęby) ----
    case 'K':
    case 'G':
      return pose({ jaw: 0.4, lowerDown: 0.12 });
    case 'NG':
      return pose({ jaw: 0.3, lowerDown: 0.06 });

    // ---- Aproksymanty ----
    case 'R': // /ɹ/ labializowane — zaokrąglenie
      return pose({ jaw: 0.32, funnel: 0.22, pucker: 0.14 });
    case 'W': // /w/ — mocny dzióbek + uniesienie dolnej wargi
      return pose({ jaw: 0.16, pucker: 0.6, funnel: 0.18, shrug: 0.08 });
    case 'Y': // /j/ — jak krótkie [i]
      return pose({ jaw: 0.26, smile: 0.28 });

    // ---- Przydech (niska amplituda, neutralne) ----
    case 'HH':
      return pose({ jaw: 0.22 });

    default:
      return null; // nieznany fonem -> brak wizemy
  }
}
