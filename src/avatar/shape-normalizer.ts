/**
 * Bezwzględnie wymagane blendshape'y z Apple ARKit dla riga mowy i mimiki (wg docs/1)
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

export type RequiredShape = (typeof REQUIRED_SHAPES)[number];

/**
 * Mapa znanych aliasów i alternatywnych wariantów pisowni nazw kluczy ARKit
 */
const ALIAS_MAP: Record<string, string> = {
  // CamelCase z prefiksem lub separatorem
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
  // Popularne aliasy z formatów RPM lub mocap
  viseme_aa: 'jawOpen',
  viseme_pp: 'mouthClose',
  viseme_oh: 'mouthFunnel',
  viseme_ou: 'mouthPucker',
};

/**
 * Normalizuje nazwę klucza do standardu ARKit camelCase
 */
export function normalizeShapeName(rawName: string): string {
  const clean = rawName.trim();
  if (clean in ALIAS_MAP) {
    return ALIAS_MAP[clean];
  }

  const lower = clean.toLowerCase();
  if (lower in ALIAS_MAP) {
    return ALIAS_MAP[lower];
  }

  // Usunięcie ewentualnego prefiksu namespace'u typu "head." lub "Avatar_"
  const parts = clean.split(/[.:]/);
  const baseName = parts[parts.length - 1];
  const lowerBase = baseName.toLowerCase();

  if (baseName in ALIAS_MAP) return ALIAS_MAP[baseName];
  if (lowerBase in ALIAS_MAP) return ALIAS_MAP[lowerBase];

  // Obsługa prefiksów z podkreśleniem np. Avatar_eye_blink_left
  const underscoreIndex = clean.indexOf('_');
  if (underscoreIndex !== -1) {
    const afterPrefix = clean.slice(underscoreIndex + 1);
    const lowerAfter = afterPrefix.toLowerCase();
    if (afterPrefix in ALIAS_MAP) return ALIAS_MAP[afterPrefix];
    if (lowerAfter in ALIAS_MAP) return ALIAS_MAP[lowerAfter];
  }

  return baseName;
}

/**
 * Sprawdza obecność wymaganych blendshape'ów i rzuca błąd w przypadku braków (Fail-Fast)
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
    const errorMsg = `Model nie posiada blendshape'ów: ${validation.missing.join(', ')}`;
    console.error(`[ShapeNormalizer Fail-Fast] ${errorMsg}`);
    throw new Error(errorMsg);
  }
}
