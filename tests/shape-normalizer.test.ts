import { describe, it, expect } from 'vitest';
import {
  normalizeShapeName,
  validateRequiredShapes,
  assertRequiredShapes,
  REQUIRED_SHAPES,
} from '../src/avatar/shape-normalizer';

describe('ShapeNormalizer', () => {
  it('normalizes known aliases to camelCase ARKit', () => {
    expect(normalizeShapeName('jaw_open')).toBe('jawOpen');
    expect(normalizeShapeName('Jaw_Open')).toBe('jawOpen');
    expect(normalizeShapeName('mouth_close')).toBe('mouthClose');
    expect(normalizeShapeName('viseme_aa')).toBe('jawOpen');
    expect(normalizeShapeName('Avatar_eye_blink_left')).toBe('eyeBlinkLeft');
  });

  it('validates complete set of REQUIRED_SHAPES successfully', () => {
    const validSet = [...REQUIRED_SHAPES, 'browDownLeft', 'cheekPuff'];
    const result = validateRequiredShapes(validSet);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
    expect(() => assertRequiredShapes(validSet)).not.toThrow();
  });

  it('fails fast when required blendshapes are missing', () => {
    const incompleteSet = ['jawOpen', 'mouthFunnel']; // missing mouthClose, mouthPucker, etc.
    const result = validateRequiredShapes(incompleteSet);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('mouthClose');
    expect(result.missing).toContain('mouthPucker');
    expect(result.missing).toContain('mouthSmileLeft');

    expect(() => assertRequiredShapes(incompleteSet)).toThrowError(
      /Model nie posiada blendshape'ów:.*mouthClose/
    );
  });
});
