/**
 * Synthetic demo frames for the frames mode (08-03) — a "dry run" before the real A2F.
 *
 * Two inputs, ONE time model (phrase -> character windows):
 * - buildDemoFrames(...): a 60 fps FramesClip imitating mouth movement (vowels open,
 *   M/B/P close, etc.). Poses are SMOOTHED between characters (light spline/filter) —
 *   the generator models the SMOOTH neural A2F output; the frames controller stays without
 *   smoothing (contract v2).
 * - synthesizeDemoAudio(...): speech-like signal (per-phoneme voiced/noise source,
 *   F0 varies per syllable) — NOT a pure tone; synchronized with the frames.
 *
 * Both are pure and deterministic (no DOM), testable.
 */

import { FramesClip, PoseFrame } from '../types/avatar';

const FPS = 60;

const VOWELS = new Set('aeiouyąęó'.split(''));
const ROUNDED = new Set('ouó'.split('')); // lips pursed into a pucker
const SMILE_VOWELS = new Set('iyę'.split('')); // stretched mouth corners
const BILABIAL = new Set('mbp'.split('')); // full closure
const LABIODENTAL = new Set('fv'.split(''));
const SIBILANT = new Set('szcżźś'.split(''));
const ROUND_CONSONANTS = new Set('wr'.split(''));
/** Voiced consonants (resonant) — a quiet voiced source. */
const VOICED_CONSONANTS = new Set('mbnwlrgyjdżdźdz'.split(''));

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Target pose for a single letter (simplified, for the demo only). */
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
  // Remaining consonants — a gentle opening.
  return { jawOpen: 0.16 };
}

/** Smooth transition between poses: a light smoothing filter on the shape channel
 *  (radius ~3 frames = ~100 ms) — like the temporally smooth output of a neural A2F. */
function smoothChannel(values: number[], radius = 3): number[] {
  const n = values.length;
  const win: number[] = [];
  for (let k = -radius; k <= radius; k++) win.push(radius + 1 - Math.abs(k)); // triangle 1..r+1..1
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
 * Builds a 60 fps FramesClip from a phrase (relative frames, contract v2).
 * Character poses are smoothed — the demo should look like a smooth neural stream,
 * not "frame by frame" jumps.
 */
export function buildDemoFrames(_sampleRate: number, durationSec: number, phrase = 'Hello and welcome'): FramesClip {
  const n = Math.max(1, Math.round(durationSec * FPS));
  const chars = (phrase.length > 0 ? phrase : ' ').split('');
  const charDur = durationSec / chars.length;

  // Raw pose per frame (zero-order within the character window).
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

  // Smooth every channel over time (between character poses).
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

// --- Speech-like audio synthesis (synchronized with the same time model) ---

/** Deterministic noise (LCG) — testability, no dependency on Math.random. */
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
 * Generates mono audio (Float32Array, -1..1) "speech-like" for the frames demo.
 * Same phrase and same time split as buildDemoFrames → the mouth plays along with the sound.
 * Per character: vowels/sonorants = voiced source (F0 per syllable + formant boosts),
 * sibilants/fricatives = noise, stops = a short burst of noise; syllable envelope as in the frames.
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
    // Syllable envelope (15% fade) — consistent with the frames, but stronger at the centre.
    const within = tin / charDur;
    const env = Math.max(0.18, Math.min(1, Math.min(within / 0.12, (1 - within) / 0.12)));

    // F0 per syllable (deterministic, stable within a character) + slight jitter.
    const f0 = 105 + ((charIndex * 37) % 85); // 105..190 Hz
    const nz = noise() * 2 - 1;

    let s = 0;
    if (isVowelChar(ch) || VOICED_CONSONANTS.has(ch)) {
      // Voiced source: f0 + harmonics; front vowels boost the higher formants.
      const v = ch;
      const hi = SMILE_VOWELS.has(v) ? 0.45 : ROUNDED.has(v) ? 0.2 : 0.3;
      const h1 = Math.sin(2 * Math.PI * f0 * t);
      const h2 = Math.sin(2 * Math.PI * f0 * 2 * t);
      const h3 = Math.sin(2 * Math.PI * f0 * 3 * t);
      s = 0.6 * h1 + hi * h2 + (SMILE_VOWELS.has(v) ? 0.25 * h3 : 0.12 * h3);
      if (ch === 'm' || ch === 'n') s = 0.55 * h1 + 0.15 * h2; // nasal, muted
      s *= env * 0.9;
    } else if (SIBILANT.has(ch)) {
      s = nz * 0.4 * env; // hissing noise
    } else if (LABIODENTAL.has(ch) || ch === 'h') {
      s = nz * 0.28 * env;
    } else if ('ptk'.includes(ch)) {
      // Stop: a short burst of noise only at the start of the character window.
      s = within < 0.18 ? nz * 0.35 * (1 - within / 0.18) : 0;
    } else if (ch === ' ' || ch === ',' || ch === '.') {
      s = 0;
    } else {
      // Remaining consonants: a light voiced murmur.
      s = (0.5 * Math.sin(2 * Math.PI * f0 * t) + 0.25 * nz) * 0.25 * env;
    }

    // Gentle limiting (soft clip) and fade at the edges.
    s = Math.tanh(s * 1.3);
    if (i < fadeIn) s *= i / fadeIn;
    if (i > total - fadeOut) s *= (total - i) / fadeOut;
    out[i] = s;
  }

  return out;
}
