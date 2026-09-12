/**
 * Parser odpowiedzi wrappera A2F → FramesClip (08-02, kontrakt v2 — docs/7 §5).
 *
 * WRAPPER jest właścicielem formatu JSON. Ten moduł zamienia:
 *   { fps, frames: [{ frame_time, blendshapes: { "JawOpen": 0.12, … } }], carriesEyes?, … }
 * na FramesClip gotowy do FaceController.feedFrames (08-01).
 *
 * Kluczowe zasady (08-CONTEXT v2):
 * - `timeSec` jest RELATYWNY (= frame_time) — baza dodawana JEDNORAZOWO w feedFrames.
 * - PascalCase ARKit (np. "MouthSmileLeft") → nasz camelCase własnym dekapitalizerem;
 *   normalizeShapeName sam nie składa PascalCase (~30/52 nazw L/R przepadłoby po cichu).
 * - Whitelist 52 kształtów ARKit; nieznane → pomijane + zliczane (unknownShapes, telemetria).
 * - Nie zakładamy stałego kroku ramek (v3.0 diffusion = 30 fps) — porządkujemy po frame_time.
 */

import { PoseFrame, FramesClip } from '../types/avatar';
import { normalizeShapeName } from '../avatar/shape-normalizer';

/** Kanoniczne (camelCase) nazwy 52 blendshape'ów ARKit — whitelist parsera. */
export const ARKIT_52: readonly string[] = [
  'jawOpen', 'jawForward', 'jawLeft', 'jawRight',
  'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthLeft', 'mouthRight',
  'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight',
  'mouthDimpleLeft', 'mouthDimpleRight', 'mouthStretchLeft', 'mouthStretchRight',
  'mouthRollLower', 'mouthRollUpper', 'mouthShrugUpper', 'mouthShrugLower',
  'mouthPressLeft', 'mouthPressRight', 'mouthLowerDownLeft', 'mouthLowerDownRight',
  'mouthUpperUpLeft', 'mouthUpperUpRight',
  'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
  'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight',
  'eyeBlinkLeft', 'eyeBlinkRight',
  'eyeLookDownLeft', 'eyeLookDownRight', 'eyeLookInLeft', 'eyeLookInRight',
  'eyeLookOutLeft', 'eyeLookOutRight', 'eyeLookUpLeft', 'eyeLookUpRight',
  'eyeSquintLeft', 'eyeSquintRight', 'eyeWideLeft', 'eyeWideRight',
  'noseSneerLeft', 'noseSneerRight',
  'tongueOut',
];

const ARKIT_SET: ReadonlySet<string> = new Set(ARKIT_52);

/** Klucze wskazujące, że strumień "niesie oczy" (blink/rotacja) — decyzja carriesEyes. */
function looksLikeEyeShape(camel: string): boolean {
  return camel.startsWith('eyeBlink') || camel.startsWith('eyeLook');
}

/**
 * PascalCase ARKit → camelCase: obniża TYLKO pierwszą literę
 * ("MouthSmileLeft" → "mouthSmileLeft", "JawOpen" → "jawOpen").
 * Wejście już camelCase (np. z innego źródła) wychodzi bez zmian.
 */
export function decapitalizeArKit(raw: string): string {
  if (raw.length === 0) return raw;
  return raw[0].toLowerCase() + raw.slice(1);
}

export interface A2fPayload {
  fps?: number;
  frames: Array<{
    frame_time?: number;
    blendshapes?: Record<string, number>;
  }>;
  carriesEyes?: boolean;
  emotions?: Array<{ timeSec: number; weights: Record<string, number> }>;
}

export interface A2fParseResult {
  clip: FramesClip;
  /** Nieznane/pominięte klucze (deduplikowane) — do telemetrii, nie do spamu. */
  unknownShapes: string[];
}

export function parseA2fJson(json: string): A2fParseResult {
  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch (e) {
    throw new Error(`A2F: niepoprawny JSON — ${(e as Error).message}`);
  }
  return parseA2fPayload(payload as A2fPayload);
}

export function parseA2fPayload(payload: A2fPayload): A2fParseResult {
  if (!payload || typeof payload !== 'object') {
    throw new Error('A2F: niepoprawny payload');
  }
  if (!Array.isArray(payload.frames)) {
    throw new Error('A2F: brak frames');
  }

  const frames: PoseFrame[] = [];
  const unknownShapes: string[] = [];
  const seenKeys = new Set<string>();
  let sawEyeShape = false;

  for (const rawFrame of payload.frames) {
    const blends = rawFrame?.blendshapes;
    const weights: Record<string, number> = {};

    if (blends && typeof blends === 'object') {
      for (const [rawKey, value] of Object.entries(blends)) {
        const camel = decapitalizeArKit(rawKey);
        const norm = normalizeShapeName(camel);
        if (!norm || !ARKIT_SET.has(norm)) {
          if (!seenKeys.has(rawKey)) {
            seenKeys.add(rawKey);
            unknownShapes.push(rawKey);
          }
          continue;
        }
        if (looksLikeEyeShape(norm)) sawEyeShape = true;
        weights[norm] = clamp01(value);
      }
    }

    frames.push({
      timeSec: rawFrame?.frame_time ?? 0,
      weights,
    });
  }

  frames.sort((a, b) => a.timeSec - b.timeSec);

  // shapes = suma kluczy występujących w ≥1 ramce (kształty, którymi strumień WŁADA).
  const shapes: string[] = [];
  const shapeSet = new Set<string>();
  for (const f of frames) {
    for (const k of Object.keys(f.weights)) {
      if (!shapeSet.has(k)) {
        shapeSet.add(k);
        shapes.push(k);
      }
    }
  }

  const explicitEyes = payload.carriesEyes;
  const carriesEyes =
    explicitEyes !== undefined ? explicitEyes === true : sawEyeShape;
  // Obecność ścieżki emotions (A2E) oznacza, że ramki niosą własną ekspresję
  // → EmotionLayer addytywna ma być OFF w trakcie tury (08-CONTEXT v2).
  const carriesEmotion = Array.isArray(payload.emotions) && payload.emotions.length > 0;

  return {
    clip: {
      frames,
      fps: typeof payload.fps === 'number' ? payload.fps : 60,
      shapes,
      carriesEyes,
      carriesEmotion,
      emotions: payload.emotions,
    },
    unknownShapes,
  };
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
