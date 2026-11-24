import { describe, it, expect } from 'vitest';
import { parseA2fJson, parseA2fPayload, decapitalizeArKit, ARKIT_52 } from '../src/lipsync/a2f-parser';
import { defined } from './helpers/defined';

/** Expected PascalCase → camelCase pairs for all 52 ARKit shapes. */
const PASCAL_52: Array<[string, string]> = [
  ['JawOpen', 'jawOpen'],
  ['JawForward', 'jawForward'],
  ['JawLeft', 'jawLeft'],
  ['JawRight', 'jawRight'],
  ['MouthClose', 'mouthClose'],
  ['MouthFunnel', 'mouthFunnel'],
  ['MouthPucker', 'mouthPucker'],
  ['MouthLeft', 'mouthLeft'],
  ['MouthRight', 'mouthRight'],
  ['MouthSmileLeft', 'mouthSmileLeft'],
  ['MouthSmileRight', 'mouthSmileRight'],
  ['MouthFrownLeft', 'mouthFrownLeft'],
  ['MouthFrownRight', 'mouthFrownRight'],
  ['MouthDimpleLeft', 'mouthDimpleLeft'],
  ['MouthDimpleRight', 'mouthDimpleRight'],
  ['MouthStretchLeft', 'mouthStretchLeft'],
  ['MouthStretchRight', 'mouthStretchRight'],
  ['MouthRollLower', 'mouthRollLower'],
  ['MouthRollUpper', 'mouthRollUpper'],
  ['MouthShrugUpper', 'mouthShrugUpper'],
  ['MouthShrugLower', 'mouthShrugLower'],
  ['MouthPressLeft', 'mouthPressLeft'],
  ['MouthPressRight', 'mouthPressRight'],
  ['MouthLowerDownLeft', 'mouthLowerDownLeft'],
  ['MouthLowerDownRight', 'mouthLowerDownRight'],
  ['MouthUpperUpLeft', 'mouthUpperUpLeft'],
  ['MouthUpperUpRight', 'mouthUpperUpRight'],
  ['BrowDownLeft', 'browDownLeft'],
  ['BrowDownRight', 'browDownRight'],
  ['BrowInnerUp', 'browInnerUp'],
  ['BrowOuterUpLeft', 'browOuterUpLeft'],
  ['BrowOuterUpRight', 'browOuterUpRight'],
  ['CheekPuff', 'cheekPuff'],
  ['CheekSquintLeft', 'cheekSquintLeft'],
  ['CheekSquintRight', 'cheekSquintRight'],
  ['EyeBlinkLeft', 'eyeBlinkLeft'],
  ['EyeBlinkRight', 'eyeBlinkRight'],
  ['EyeLookDownLeft', 'eyeLookDownLeft'],
  ['EyeLookDownRight', 'eyeLookDownRight'],
  ['EyeLookInLeft', 'eyeLookInLeft'],
  ['EyeLookInRight', 'eyeLookInRight'],
  ['EyeLookOutLeft', 'eyeLookOutLeft'],
  ['EyeLookOutRight', 'eyeLookOutRight'],
  ['EyeLookUpLeft', 'eyeLookUpLeft'],
  ['EyeLookUpRight', 'eyeLookUpRight'],
  ['EyeSquintLeft', 'eyeSquintLeft'],
  ['EyeSquintRight', 'eyeSquintRight'],
  ['EyeWideLeft', 'eyeWideLeft'],
  ['EyeWideRight', 'eyeWideRight'],
  ['NoseSneerLeft', 'noseSneerLeft'],
  ['NoseSneerRight', 'noseSneerRight'],
  ['TongueOut', 'tongueOut'],
];

describe('a2f-parser (kontrakt v2)', () => {
  it('decapitalizes all 52 ARKit PascalCase names → camelCase', () => {
    expect(PASCAL_52).toHaveLength(52);
    for (const [pascal, camel] of PASCAL_52) {
      expect(decapitalizeArKit(pascal)).toBe(camel);
    }
    // Input already in camelCase stays unchanged.
    expect(decapitalizeArKit('jawOpen')).toBe('jawOpen');
    expect(decapitalizeArKit('mouthSmileLeft')).toBe('mouthSmileLeft');
    expect(decapitalizeArKit('')).toBe('');
  });

  it('ARKIT_52 contains all expected camelCase names (consistent whitelist)', () => {
    expect(ARKIT_52).toHaveLength(52);
    for (const [, camel] of PASCAL_52) {
      expect(ARKIT_52).toContain(camel);
    }
  });

  it('maps all 52 PascalCase names to camelCase without loss', () => {
    const blends: Record<string, number> = {};
    for (const [pascal] of PASCAL_52) blends[pascal] = 0.01;

    const { clip } = parseA2fPayload({ fps: 60, frames: [{ frame_time: 0.0, blendshapes: blends }] });
    const keys = Object.keys(defined(clip.frames[0]).weights).sort();
    const expected = PASCAL_52.map(([, c]) => c).sort();

    expect(keys).toEqual(expected);
    expect(clip.shapes.sort()).toEqual(expected);
  });

  it('passes frame_time as a RELATIVE timeSec (without audioStart)', () => {
    const { clip } = parseA2fPayload({
      fps: 30,
      frames: [
        { frame_time: 0.0, blendshapes: { JawOpen: 0.1 } },
        { frame_time: 0.5, blendshapes: { JawOpen: 0.2 } },
      ],
    });
    expect(defined(clip.frames[0]).timeSec).toBe(0.0);
    expect(defined(clip.frames[1]).timeSec).toBe(0.5);
    expect(clip.fps).toBe(30);
  });

  it('sorts frames by timeSec despite a non-constant step (30 fps / 60 fps mix)', () => {
    const { clip } = parseA2fPayload({
      frames: [
        { frame_time: 0.1, blendshapes: { JawOpen: 0.3 } },
        { frame_time: 0.0, blendshapes: { JawOpen: 0.1 } },
        { frame_time: 0.033, blendshapes: { JawOpen: 0.2 } },
      ],
    });
    expect(clip.frames.map((f) => f.timeSec)).toEqual([0.0, 0.033, 0.1]);
  });

  it('clamps values to 0..1', () => {
    const { clip } = parseA2fPayload({
      frames: [{ frame_time: 0.0, blendshapes: { JawOpen: 1.5, MouthClose: -0.2, MouthPucker: 0.4 } }],
    });
    expect(defined(clip.frames[0]).weights['jawOpen']).toBe(1);
    expect(defined(clip.frames[0]).weights['mouthClose']).toBe(0);
    expect(defined(clip.frames[0]).weights['mouthPucker']).toBe(0.4);
  });

  it('skips unknown shapes and reports them in unknownShapes (deduplicated)', () => {
    const { clip, unknownShapes } = parseA2fPayload({
      frames: [
        { frame_time: 0.0, blendshapes: { JawOpen: 0.5, FooBar: 0.9 } },
        { frame_time: 0.1, blendshapes: { JawOpen: 0.5, FooBar: 0.1 } },
      ],
    });
    expect('foobar' in defined(clip.frames[0]).weights).toBe(false);
    expect(unknownShapes).toEqual(['FooBar']);
    expect(clip.shapes).toEqual(['jawOpen']);
  });

  it('throws a readable error when frames are missing', () => {
    expect(() => parseA2fPayload({} as never)).toThrowError('A2F: missing frames');
    expect(() => parseA2fPayload({ frames: null } as never)).toThrowError('A2F: missing frames');
  });

  it('parseA2fJson: valid and invalid JSON', () => {
    const ok = parseA2fJson('{"fps":60,"frames":[{"frame_time":0,"blendshapes":{"JawOpen":0.1}}]}');
    expect(ok.clip.frames).toHaveLength(1);

    expect(() => parseA2fJson('{not json')).toThrowError('A2F: invalid JSON');
  });

  it('infers carriesEyes from the presence of eyeBlink*/eyeLook* in the frames', () => {
    const { clip } = parseA2fPayload({
      frames: [{ frame_time: 0.0, blendshapes: { JawOpen: 0.2, EyeBlinkLeft: 0.0, EyeLookUpRight: 0.1 } }],
    });
    expect(clip.carriesEyes).toBe(true);
  });

  it('an explicit carriesEyes takes precedence over inference', () => {
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

  it('does not carry an A2E emotion track (removed - no producer, 16-02)', () => {
    const { clip } = parseA2fPayload({
      fps: 60,
      frames: [{ frame_time: 0.0, blendshapes: { JawOpen: 0.2 } }],
    });
    expect('carriesEmotion' in clip).toBe(false);
    expect('emotions' in clip).toBe(false);
  });
});
