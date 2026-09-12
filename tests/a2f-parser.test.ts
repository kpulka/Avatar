import { describe, it, expect } from 'vitest';
import {
  parseA2fJson,
  parseA2fPayload,
  decapitalizeArKit,
  ARKIT_52,
} from '../src/lipsync/a2f-parser';

/** Oczekiwane pary PascalCase → camelCase dla pełnych 52 kształtów ARKit. */
const PASCAL_52: Array<[string, string]> = [
  ['JawOpen', 'jawOpen'], ['JawForward', 'jawForward'], ['JawLeft', 'jawLeft'], ['JawRight', 'jawRight'],
  ['MouthClose', 'mouthClose'], ['MouthFunnel', 'mouthFunnel'], ['MouthPucker', 'mouthPucker'],
  ['MouthLeft', 'mouthLeft'], ['MouthRight', 'mouthRight'],
  ['MouthSmileLeft', 'mouthSmileLeft'], ['MouthSmileRight', 'mouthSmileRight'],
  ['MouthFrownLeft', 'mouthFrownLeft'], ['MouthFrownRight', 'mouthFrownRight'],
  ['MouthDimpleLeft', 'mouthDimpleLeft'], ['MouthDimpleRight', 'mouthDimpleRight'],
  ['MouthStretchLeft', 'mouthStretchLeft'], ['MouthStretchRight', 'mouthStretchRight'],
  ['MouthRollLower', 'mouthRollLower'], ['MouthRollUpper', 'mouthRollUpper'],
  ['MouthShrugUpper', 'mouthShrugUpper'], ['MouthShrugLower', 'mouthShrugLower'],
  ['MouthPressLeft', 'mouthPressLeft'], ['MouthPressRight', 'mouthPressRight'],
  ['MouthLowerDownLeft', 'mouthLowerDownLeft'], ['MouthLowerDownRight', 'mouthLowerDownRight'],
  ['MouthUpperUpLeft', 'mouthUpperUpLeft'], ['MouthUpperUpRight', 'mouthUpperUpRight'],
  ['BrowDownLeft', 'browDownLeft'], ['BrowDownRight', 'browDownRight'],
  ['BrowInnerUp', 'browInnerUp'], ['BrowOuterUpLeft', 'browOuterUpLeft'], ['BrowOuterUpRight', 'browOuterUpRight'],
  ['CheekPuff', 'cheekPuff'], ['CheekSquintLeft', 'cheekSquintLeft'], ['CheekSquintRight', 'cheekSquintRight'],
  ['EyeBlinkLeft', 'eyeBlinkLeft'], ['EyeBlinkRight', 'eyeBlinkRight'],
  ['EyeLookDownLeft', 'eyeLookDownLeft'], ['EyeLookDownRight', 'eyeLookDownRight'],
  ['EyeLookInLeft', 'eyeLookInLeft'], ['EyeLookInRight', 'eyeLookInRight'],
  ['EyeLookOutLeft', 'eyeLookOutLeft'], ['EyeLookOutRight', 'eyeLookOutRight'],
  ['EyeLookUpLeft', 'eyeLookUpLeft'], ['EyeLookUpRight', 'eyeLookUpRight'],
  ['EyeSquintLeft', 'eyeSquintLeft'], ['EyeSquintRight', 'eyeSquintRight'],
  ['EyeWideLeft', 'eyeWideLeft'], ['EyeWideRight', 'eyeWideRight'],
  ['NoseSneerLeft', 'noseSneerLeft'], ['NoseSneerRight', 'noseSneerRight'],
  ['TongueOut', 'tongueOut'],
];

describe('a2f-parser (kontrakt v2)', () => {
  it('dekapitalizuje pełne 52 nazwy ARKit PascalCase → camelCase', () => {
    expect(PASCAL_52).toHaveLength(52);
    for (const [pascal, camel] of PASCAL_52) {
      expect(decapitalizeArKit(pascal)).toBe(camel);
    }
    // Wejście już camelCase zostaje bez zmian.
    expect(decapitalizeArKit('jawOpen')).toBe('jawOpen');
    expect(decapitalizeArKit('mouthSmileLeft')).toBe('mouthSmileLeft');
    expect(decapitalizeArKit('')).toBe('');
  });

  it('ARKIT_52 zawiera wszystkie oczekiwane camelCase (whitelist spójny)', () => {
    expect(ARKIT_52).toHaveLength(52);
    for (const [, camel] of PASCAL_52) {
      expect(ARKIT_52).toContain(camel);
    }
  });

  it('mapuje wszystkie 52 PascalCase na camelCase bez strat', () => {
    const blends: Record<string, number> = {};
    for (const [pascal] of PASCAL_52) blends[pascal] = 0.01;

    const { clip } = parseA2fPayload({ fps: 60, frames: [{ frame_time: 0.0, blendshapes: blends }] });
    const keys = Object.keys(clip.frames[0].weights).sort();
    const expected = PASCAL_52.map(([, c]) => c).sort();

    expect(keys).toEqual(expected);
    expect(clip.shapes.sort()).toEqual(expected);
  });

  it('przekazuje frame_time jako RELATYWNY timeSec (bez audioStart)', () => {
    const { clip } = parseA2fPayload({
      fps: 30,
      frames: [
        { frame_time: 0.0, blendshapes: { JawOpen: 0.1 } },
        { frame_time: 0.5, blendshapes: { JawOpen: 0.2 } },
      ],
    });
    expect(clip.frames[0].timeSec).toBe(0.0);
    expect(clip.frames[1].timeSec).toBe(0.5);
    expect(clip.fps).toBe(30);
  });

  it('sortuje ramki po timeSec mimo niestałego kroku (30 fps / 60 fps mix)', () => {
    const { clip } = parseA2fPayload({
      frames: [
        { frame_time: 0.1, blendshapes: { JawOpen: 0.3 } },
        { frame_time: 0.0, blendshapes: { JawOpen: 0.1 } },
        { frame_time: 0.033, blendshapes: { JawOpen: 0.2 } },
      ],
    });
    expect(clip.frames.map((f) => f.timeSec)).toEqual([0.0, 0.033, 0.1]);
  });

  it('clampuje wartości do 0..1', () => {
    const { clip } = parseA2fPayload({
      frames: [{ frame_time: 0.0, blendshapes: { JawOpen: 1.5, MouthClose: -0.2, MouthPucker: 0.4 } }],
    });
    expect(clip.frames[0].weights['jawOpen']).toBe(1);
    expect(clip.frames[0].weights['mouthClose']).toBe(0);
    expect(clip.frames[0].weights['mouthPucker']).toBe(0.4);
  });

  it('pomija nieznane kształty i raportuje je w unknownShapes (deduplikacja)', () => {
    const { clip, unknownShapes } = parseA2fPayload({
      frames: [
        { frame_time: 0.0, blendshapes: { JawOpen: 0.5, FooBar: 0.9 } },
        { frame_time: 0.1, blendshapes: { JawOpen: 0.5, FooBar: 0.1 } },
      ],
    });
    expect('foobar' in clip.frames[0].weights).toBe(false);
    expect(unknownShapes).toEqual(['FooBar']);
    expect(clip.shapes).toEqual(['jawOpen']);
  });

  it('rzuca czytelny błąd gdy brak frames', () => {
    expect(() => parseA2fPayload({} as never)).toThrowError('A2F: brak frames');
    expect(() => parseA2fPayload({ frames: null } as never)).toThrowError('A2F: brak frames');
  });

  it('parseA2fJson: poprawny i niepoprawny JSON', () => {
    const ok = parseA2fJson('{"fps":60,"frames":[{"frame_time":0,"blendshapes":{"JawOpen":0.1}}]}');
    expect(ok.clip.frames).toHaveLength(1);

    expect(() => parseA2fJson('{nie json')).toThrowError('A2F: niepoprawny JSON');
  });

  it('inferuje carriesEyes z obecności eyeBlink*/eyeLook* w ramkach', () => {
    const { clip } = parseA2fPayload({
      frames: [{ frame_time: 0.0, blendshapes: { JawOpen: 0.2, EyeBlinkLeft: 0.0, EyeLookUpRight: 0.1 } }],
    });
    expect(clip.carriesEyes).toBe(true);
  });

  it('jawny carriesEyes ma pierwszeństwo przed inferencją', () => {
    const noInfer = parseA2fPayload({
      frames: [{ frame_time: 0.0, blendshapes: { JawOpen: 0.2, EyeBlinkLeft: 0.0 } }],
      carriesEyes: false,
    });
    expect(noInfer.clip.carriesEyes).toBe(false);

    const forced = parseA2fPayload({
      frames: [{ frame_time: 0.0, blendshapes: { JawOpen: 0.2 } }],
      carriesEyes: true,
    });
    expect(forced.clip.carriesEyes).toBe(true);
  });

  it('ustawia carriesEmotion=true gdy payload niesie emotions (A2E)', () => {
    const { clip } = parseA2fPayload({
      fps: 60,
      frames: [{ frame_time: 0.0, blendshapes: { JawOpen: 0.2 } }],
      emotions: [{ timeSec: 0.0, weights: { happy: 0.9 } }],
    });
    expect(clip.carriesEmotion).toBe(true);
    expect(clip.emotions).toHaveLength(1);

    const noEmo = parseA2fPayload({
      frames: [{ frame_time: 0.0, blendshapes: { JawOpen: 0.2 } }],
    });
    expect(noEmo.clip.carriesEmotion).toBe(false);
  });
});
