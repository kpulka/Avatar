/**
 * Parser of the A2F wrapper response → FramesClip (08-02, contract v2 — docs/7 §5).
 *
 * The WRAPPER owns the JSON format. This module turns:
 *   { fps, frames: [{ frame_time, blendshapes: { "JawOpen": 0.12, … } }], carriesEyes?, … }
 * into a FramesClip ready for FaceController.feedFrames (08-01).
 *
 * Key rules (08-CONTEXT v2):
 * - `timeSec` is RELATIVE (= frame_time) — the base is added ONCE in feedFrames.
 * - ARKit PascalCase (e.g. "MouthSmileLeft") → our camelCase via our own decapitalizer;
 *   normalizeShapeName does not compose PascalCase itself (~30/52 L/R names would be lost silently).
 * - Whitelist of the 52 ARKit shapes; unknown → skipped + counted (unknownShapes, telemetry).
 * - We do not assume a fixed frame step (v3.0 diffusion = 30 fps) — we sort by frame_time.
 */

import { PoseFrame, FramesClip } from '../types/avatar';
import { normalizeShapeName } from '../avatar/shape-normalizer';
import { clamp01 } from './anim-config';

/** Canonical (camelCase) names of the 52 ARKit blendshapes — the parser whitelist. */
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

/** Keys indicating the stream "carries eyes" (blink/rotation) — the carriesEyes decision. */
function looksLikeEyeShape(camel: string): boolean {
  return camel.startsWith('eyeBlink') || camel.startsWith('eyeLook');
}

/**
 * ARKit PascalCase → camelCase: lowercases ONLY the first letter
 * ("MouthSmileLeft" → "mouthSmileLeft", "JawOpen" → "jawOpen").
 * Input that is already camelCase (e.g. from another source) comes out unchanged.
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
}

export interface A2fParseResult {
  clip: FramesClip;
  /** Unknown/skipped keys (deduplicated) — for telemetry, not for spam. */
  unknownShapes: string[];
}

export function parseA2fJson(json: string): A2fParseResult {
  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch (e) {
    throw new Error(`A2F: invalid JSON — ${(e as Error).message}`);
  }
  return parseA2fPayload(payload as A2fPayload);
}

export function parseA2fPayload(payload: A2fPayload): A2fParseResult {
  if (!payload || typeof payload !== 'object') {
    throw new Error('A2F: invalid payload');
  }
  if (!Array.isArray(payload.frames)) {
    throw new Error('A2F: missing frames');
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

  // shapes = union of keys present in ≥1 frame (the shapes the stream OWNS).
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
  return {
    clip: {
      frames,
      fps: typeof payload.fps === 'number' ? payload.fps : 60,
      shapes,
      carriesEyes,
    },
    unknownShapes,
  };
}

