/**
 * Syntetyczne ramki demo do trybu frames (08-03) — "suchy bieg" przed realnym A2F.
 *
 * Dwa wejścia, JEDEN model czasu (fraza → okna znaków):
 * - buildDemoFrames(...): FramesClip 60 fps imitujący ruch ust (samogłoski otwierają,
 *   M/B/P domykają itd.). Pozy są WYGŁADZANE między znakami (lekkie spline/filtr) —
 *   generator modeluje PŁYNNE wyjście neuronowe A2F; kontroler frames pozostaje bez
 *   wygładzania (kontrakt v2).
 * - synthesizeDemoAudio(...): mowopodobny sygnał (per-fonemowe źródło dźwięczne/szumne,
 *   F0 zmienia się per sylaba) — NIE czysty ton; zsynchronizowany z ramkami.
 *
 * Oba czyste i deterministyczne (bez DOM), testowalne.
 */

import { FramesClip, PoseFrame } from '../types/avatar';

const FPS = 60;

const VOWELS = new Set('aeiouyąęó'.split(''));
const ROUNDED = new Set('ouó'.split('')); // wargi w dzióbek
const SMILE_VOWELS = new Set('iyę'.split('')); // rozciągnięte kąciki
const BILABIAL = new Set('mbp'.split('')); // pełne domknięcie
const LABIODENTAL = new Set('fv'.split(''));
const SIBILANT = new Set('szcżźś'.split(''));
const ROUND_CONSONANTS = new Set('wr'.split(''));
/** Spółgłoski dźwięczne (rezonans) — niegłośne źródło dźwięczne. */
const VOICED_CONSONANTS = new Set('mbnwlrgyjdżdźdz'.split(''));

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Docelowa poza dla pojedynczej litery (uproszczona, tylko do demo). */
function poseForChar(ch: string): Record<string, number> {
  const c = ch.toLowerCase();
  if (c === ' ' || c === ',' || c === '.' || c === '—' || c === '-') return {};
  if (BILABIAL.has(c)) return { mouthClose: 0.8, jawOpen: 0.04, mouthPressLeft: 0.1, mouthPressRight: 0.1 };
  if (LABIODENTAL.has(c)) return { jawOpen: 0.1, mouthRollLower: 0.5 };
  if (VOWELS.has(c)) {
    const w: Record<string, number> = {};
    if (ROUNDED.has(c)) {
      w.jawOpen = 0.3;
      w.mouthPucker = 0.5;
      w.mouthFunnel = 0.3;
    } else if (SMILE_VOWELS.has(c)) {
      w.jawOpen = 0.22;
      w.mouthSmileLeft = 0.32;
      w.mouthSmileRight = 0.32;
    } else {
      w.jawOpen = 0.45;
    }
    return w;
  }
  if (SIBILANT.has(c)) return { jawOpen: 0.18, mouthSmileLeft: 0.18, mouthSmileRight: 0.18 };
  if (ROUND_CONSONANTS.has(c)) return { jawOpen: 0.18, mouthPucker: 0.45 };
  // Pozostałe spółgłoski — delikatne otwarcie.
  return { jawOpen: 0.16 };
}

/** Płynne przejście między pozami: lekki filtr wygładzający na kanale kształtu
 *  (promień ~3 ramki = ~100 ms) — jak temporally-smooth output neuronowego A2F. */
function smoothChannel(values: number[], radius = 3): number[] {
  const n = values.length;
  const win: number[] = [];
  for (let k = -radius; k <= radius; k++) win.push(radius + 1 - Math.abs(k)); // trójkąt 1..r+1..1
  const winSum = win.reduce((a, b) => a + b, 0);
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let k = -radius; k <= radius; k++) {
      const j = Math.max(0, Math.min(n - 1, i + k));
      acc += values[j] * win[k + radius];
    }
    out[i] = clamp01(acc / winSum);
  }
  return out;
}

/**
 * Buduje FramesClip 60 fps z frazy (ramki relatywne, kontrakt v2).
 * Pozy znaków wygładzone — demo ma wyglądać jak płynny strumień neuronowy,
 * a nie skoki "klatka po klatce".
 */
export function buildDemoFrames(_sampleRate: number, durationSec: number, phrase = 'Hello and welcome'): FramesClip {
  const n = Math.max(1, Math.round(durationSec * FPS));
  const chars = (phrase.length > 0 ? phrase : ' ').split('');
  const charDur = durationSec / chars.length;

  // Surowa poza per klatka (zero-order w oknie znaku).
  const rawShapes = new Map<string, number[]>();
  const frames: PoseFrame[] = [];

  for (let i = 0; i < n; i++) {
    const t = i / FPS;
    const charIndex = Math.min(chars.length - 1, Math.floor(t / charDur));
    const pose = poseForChar(chars[charIndex]);
    const weights: Record<string, number> = {};
    for (const [k, v] of Object.entries(pose)) {
      weights[k] = clamp01(v);
      if (!rawShapes.has(k)) rawShapes.set(k, new Array<number>(n).fill(0));
    }
    for (const [k, arr] of rawShapes) arr[i] = weights[k] ?? 0;
    frames.push({ timeSec: t, weights });
  }

  // Wygładzenie każdego kanału w czasie (między pozycjami znaków).
  const usedShapes = new Set<string>();
  for (const [shape, raw] of rawShapes) {
    if (Math.max(...raw) < 0.001) continue;
    const smooth = smoothChannel(raw);
    for (let i = 0; i < n; i++) {
      const w = smooth[i];
      if (w < 0.001) {
        delete frames[i].weights[shape];
      } else {
        frames[i].weights[shape] = w;
        usedShapes.add(shape);
      }
    }
  }

  return {
    frames,
    fps: FPS,
    shapes: [...usedShapes],
    carriesEyes: false,
    carriesEmotion: false,
  };
}

// --- Synteza mowopodobnego audio (zsynchronizowana z tym samym modelem czasu) ---

/** Deterministyczny szum (LCG) — testowalność, brak zależności od Math.random. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isVowelChar(c: string): boolean {
  return VOWELS.has(c.toLowerCase());
}

/**
 * Generuje mono audio (Float32Array, -1..1) "mowopodobne" dla demo frames.
 * Ta sama fraza i ten sam podział czasu co buildDemoFrames → usta grają z dźwiękiem.
 * Per znak: samogłoski/sonoranty = źródło dźwięczne (F0 per sylaba + formantowe podbicia),
 * syczące/frykatywy = szum, zwarcia = krótki szum; obwiednia sylaby jak w ramkach.
 */
export function synthesizeDemoAudio(sampleRate: number, durationSec: number, phrase = 'Hello and welcome'): Float32Array {
  const total = Math.max(1, Math.floor(sampleRate * durationSec));
  const chars = (phrase.length > 0 ? phrase : ' ').split('');
  const charDur = durationSec / chars.length;
  const noise = mulberry32(1337);
  const out = new Float32Array(total);
  const fadeIn = Math.min(total, Math.floor(sampleRate * 0.02));
  const fadeOut = Math.min(total, Math.floor(sampleRate * 0.05));

  for (let i = 0; i < total; i++) {
    const t = i / sampleRate;
    const charIndex = Math.min(chars.length - 1, Math.floor(t / charDur));
    const ch = chars[charIndex].toLowerCase();
    const tin = t - charIndex * charDur;
    // Obwiednia sylaby (15% fade) — spójna z ramkami, ale mocniejsza w centrum.
    const within = tin / charDur;
    const env = Math.max(0.18, Math.min(1, Math.min(within / 0.12, (1 - within) / 0.12)));

    // F0 per sylaba (deterministyczna, stabilna w obrębie znaku) + lekki jitter.
    const f0 = 105 + ((charIndex * 37) % 85); // 105..190 Hz
    const nz = noise() * 2 - 1;

    let s = 0;
    if (isVowelChar(ch) || VOICED_CONSONANTS.has(ch)) {
      // Źródło dźwięczne: f0 + harmoniki; samogłoski przednie podbijają wyższe formanty.
      const v = ch;
      const hi = SMILE_VOWELS.has(v) ? 0.45 : ROUNDED.has(v) ? 0.2 : 0.3;
      const h1 = Math.sin(2 * Math.PI * f0 * t);
      const h2 = Math.sin(2 * Math.PI * f0 * 2 * t);
      const h3 = Math.sin(2 * Math.PI * f0 * 3 * t);
      s = 0.6 * h1 + hi * h2 + (SMILE_VOWELS.has(v) ? 0.25 * h3 : 0.12 * h3);
      if (ch === 'm' || ch === 'n') s = 0.55 * h1 + 0.15 * h2; // nosowa, przygaszona
      s *= env * 0.9;
    } else if (SIBILANT.has(ch)) {
      s = nz * 0.4 * env; // szum syczący
    } else if (LABIODENTAL.has(ch) || ch === 'h') {
      s = nz * 0.28 * env;
    } else if ('ptk'.includes(ch)) {
      // Zwarcie: krótki szum tylko na początku okna znaku.
      s = within < 0.18 ? nz * 0.35 * (1 - within / 0.18) : 0;
    } else if (ch === ' ' || ch === ',' || ch === '.') {
      s = 0;
    } else {
      // Pozostałe spółgłoski: lekki dźwięczny szmer.
      s = (0.5 * Math.sin(2 * Math.PI * f0 * t) + 0.25 * nz) * 0.25 * env;
    }

    // Łagodne ograniczenie (soft clip) i fade na brzegach.
    s = Math.tanh(s * 1.3);
    if (i < fadeIn) s *= i / fadeIn;
    if (i > total - fadeOut) s *= (total - i) / fadeOut;
    out[i] = s;
  }

  return out;
}
