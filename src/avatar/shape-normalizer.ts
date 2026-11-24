/**
 * Blendshapes from Apple ARKit that are strictly required for the speech and expression rig (per docs/1)
 */
export const REQUIRED_SHAPES = [
  'jawOpen',
  'mouthClose',
  'mouthFunnel',
  'mouthPucker',
  'mouthSmileLeft',
  'mouthSmileRight',
  'eyeBlinkLeft',
  'eyeBlinkRight',
] as const;

/**
 * Map of known aliases and alternative spellings of ARKit key names
 */
const ALIAS_MAP: Record<string, string> = {
  // CamelCase with a prefix or separator
  jaw_open: 'jawOpen',
  jawopen: 'jawOpen',
  jaw_left: 'jawLeft',
  jaw_right: 'jawRight',
  jaw_forward: 'jawForward',
  mouth_close: 'mouthClose',
  mouthclose: 'mouthClose',
  mouth_funnel: 'mouthFunnel',
  mouthfunnel: 'mouthFunnel',
  mouth_pucker: 'mouthPucker',
  mouthpucker: 'mouthPucker',
  mouth_smile_left: 'mouthSmileLeft',
  mouth_smile_right: 'mouthSmileRight',
  mouthsmile_l: 'mouthSmileLeft',
  mouthsmile_r: 'mouthSmileRight',
  eye_blink_left: 'eyeBlinkLeft',
  eye_blink_right: 'eyeBlinkRight',
  eyeblink_l: 'eyeBlinkLeft',
  eyeblink_r: 'eyeBlinkRight',
  mouth_frown_left: 'mouthFrownLeft',
  mouth_frown_right: 'mouthFrownRight',
  mouth_roll_lower: 'mouthRollLower',
  mouth_roll_upper: 'mouthRollUpper',
  mouth_press_left: 'mouthPressLeft',
  mouth_press_right: 'mouthPressRight',
  // Popular aliases from RPM or mocap formats
  viseme_aa: 'jawOpen',
  viseme_pp: 'mouthClose',
  viseme_oh: 'mouthFunnel',
  viseme_ou: 'mouthPucker',
};

/**
 * Normalizes a key name to the ARKit camelCase standard
 */
export function normalizeShapeName(rawName: string): string {
  const clean = rawName.trim();
  const direct = ALIAS_MAP[clean];
  if (direct !== undefined) return direct;

  const lower = clean.toLowerCase();
  const lowerAlias = ALIAS_MAP[lower];
  if (lowerAlias !== undefined) return lowerAlias;

  // Remove a possible namespace prefix such as "head." or "Avatar_"
  const parts = clean.split(/[.:]/);
  const baseName = parts[parts.length - 1] ?? clean; // split() always yields >= 1 element
  const lowerBase = baseName.toLowerCase();

  const baseAlias = ALIAS_MAP[baseName] ?? ALIAS_MAP[lowerBase];
  if (baseAlias !== undefined) return baseAlias;

  // Handle underscore prefixes, e.g. Avatar_eye_blink_left
  const underscoreIndex = clean.indexOf('_');
  if (underscoreIndex !== -1) {
    const afterPrefix = clean.slice(underscoreIndex + 1);
    const lowerAfter = afterPrefix.toLowerCase();
    const prefixAlias = ALIAS_MAP[afterPrefix] ?? ALIAS_MAP[lowerAfter];
    if (prefixAlias !== undefined) return prefixAlias;
  }

  return baseName;
}

/**
 * Checks for the required blendshapes and throws on missing ones (Fail-Fast)
 */
export function validateRequiredShapes(availableShapes: string[]): {
  valid: boolean;
  missing: string[];
} {
  const normalizedAvailable = new Set(availableShapes.map(normalizeShapeName));
  const missing = REQUIRED_SHAPES.filter((shape) => !normalizedAvailable.has(shape));

  return {
    valid: missing.length === 0,
    missing,
  };
}

export function assertRequiredShapes(availableShapes: string[]): void {
  const validation = validateRequiredShapes(availableShapes);
  if (!validation.valid) {
    const errorMsg = `Model is missing blendshapes: ${validation.missing.join(', ')}`;
    console.error(`[ShapeNormalizer Fail-Fast] ${errorMsg}`);
    throw new Error(errorMsg);
  }
}
