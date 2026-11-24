import { describe, expect, it } from 'vitest';
import { contrastRatio, loadTokens, over, parseColor, readCss, resolveVars, type Rgba, type TokenMap } from './helpers/css-tokens';

/**
 * UIX-04 contrast gate: WCAG 2.x ratios computed from the design tokens in src/style.css, for both themes.
 * Glass surfaces are translucent over the live 3D scene, whose backdrop is the theme page color (--bg-page), so
 * translucent layers are composited onto it. A separate test pins glass opacity >= 0.85 so a bright avatar behind
 * a panel cannot move the result far from the computed value.
 *
 * Thresholds: 4.5:1 for text (WCAG 1.4.3 AA; all UI text here is below the 18px "large text" size, so the 3:1
 * relaxation is deliberately not used for text) and 3:1 for UI components and focus indicators (WCAG 1.4.11).
 */
const TEXT_MIN = 4.5;
const UI_MIN = 3;

const THEMES = loadTokens(readCss());

const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };
const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };

function color(tokens: TokenMap, name: string): Rgba {
  const raw = tokens.get(name);
  if (raw === undefined) throw new Error(`missing token ${name}`);
  return parseColor(resolveVars(raw, tokens));
}

/** Surface stacks: a translucent layer is composited onto the layers below it, then onto the backdrop. */
type Surface = readonly string[];

const SURFACES: Record<string, Surface> = {
  page: ['--bg-page'],
  glass: ['--glass-bg'],
  'glass-strong': ['--glass-bg-strong'],
  input: ['--surface-input'],
  raised: ['--surface-raised'],
  // Controls sit on the glass of dock / drawers / dialogs.
  'ctrl-on-glass': ['--glass-bg', '--surface-ctrl'],
  'ctrl-hover': ['--glass-bg', '--surface-ctrl-hover'],
  'accent-strong': ['--glass-bg', '--accent-strong'],
  'accent-strong-hover': ['--glass-bg', '--accent-strong-hover'],
  'danger-strong': ['--glass-bg', '--danger-strong'],
  'success-strong': ['--glass-bg', '--success-strong'],
  'danger-tint-on-glass': ['--glass-bg', '--danger-tint'],
  'danger-soft-on-glass': ['--glass-bg', '--danger-soft'],
  'success-soft-on-glass': ['--glass-bg', '--success-soft'],
  'warning-soft-on-glass': ['--glass-bg', '--warning-soft'],
  'accent-soft-on-glass': ['--glass-bg', '--accent-soft'],
};

/** Resolves a surface stack over one backdrop; the stack's first layer sits directly on the backdrop. */
function flatten(tokens: TokenMap, surface: Surface, backdrop: Rgba): Rgba {
  let base = backdrop;
  for (const name of surface) base = over(color(tokens, name), base);
  return base;
}

/** Contrast of `foreground` over `surface` composited onto the page background (foreground composited too). */
function ratio(tokens: TokenMap, foreground: string, surface: Surface): number {
  const background = flatten(tokens, surface, color(tokens, '--bg-page'));
  return contrastRatio(over(color(tokens, foreground), background), background);
}

interface Pair {
  fg: string;
  bg: keyof typeof SURFACES;
}

/** Text / background pairs that occur in style.css (tokens pair up the same way in both themes). */
const TEXT_PAIRS: Pair[] = [
  ...(['page', 'glass', 'glass-strong', 'input', 'raised', 'ctrl-on-glass'] as const).map((bg) => ({ fg: '--text-primary', bg })),
  ...(['glass', 'glass-strong', 'input', 'raised', 'ctrl-on-glass', 'ctrl-hover'] as const).map((bg) => ({ fg: '--text-ctrl', bg })),
  ...(['page', 'glass', 'glass-strong', 'input', 'raised', 'ctrl-on-glass'] as const).map((bg) => ({ fg: '--text-secondary', bg })),
  ...(['page', 'glass', 'glass-strong', 'input', 'raised'] as const).map((bg) => ({ fg: '--text-muted', bg })),
  // Accent used as text (links, active labels, section titles) on glass and inputs.
  ...(['glass', 'glass-strong', 'input', 'raised'] as const).map((bg) => ({ fg: '--accent', bg })),
  // Status colors used as text.
  { fg: '--success', bg: 'glass' },
  { fg: '--warning', bg: 'glass' },
  { fg: '--warning', bg: 'warning-soft-on-glass' },
  { fg: '--danger', bg: 'glass' },
  { fg: '--danger', bg: 'glass-strong' },
  { fg: '--danger-text', bg: 'danger-tint-on-glass' },
  { fg: '--danger-text', bg: 'danger-soft-on-glass' },
  { fg: '--danger-text', bg: 'glass' },
  // Text on filled accent / status surfaces.
  { fg: '--text-on-accent', bg: 'accent-strong' },
  { fg: '--text-on-accent', bg: 'accent-strong-hover' },
  { fg: '--text-on-accent', bg: 'danger-strong' },
  { fg: '--text-on-accent', bg: 'success-strong' },
];

/** Non-text indicators that must stay visible against the surface they sit on (3:1). */
const UI_PAIRS: Pair[] = [
  ...(['page', 'glass', 'glass-strong', 'input', 'raised', 'ctrl-on-glass'] as const).map((bg) => ({ fg: '--focus-ring', bg })),
  ...(['glass', 'glass-strong', 'input', 'raised'] as const).map((bg) => ({ fg: '--accent', bg })),
];

describe.each(Object.entries(THEMES))('contrast, %s theme (UIX-04)', (_theme, tokens) => {
  it.each(TEXT_PAIRS)('text $fg on $bg >= 4.5:1', ({ fg, bg }) => {
    const surface = SURFACES[bg];
    if (!surface) throw new Error(`unknown surface ${bg}`);
    expect(ratio(tokens, fg, surface)).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  it.each(UI_PAIRS)('indicator $fg on $bg >= 3:1', ({ fg, bg }) => {
    const surface = SURFACES[bg];
    if (!surface) throw new Error(`unknown surface ${bg}`);
    expect(ratio(tokens, fg, surface)).toBeGreaterThanOrEqual(UI_MIN);
  });
});

describe.each(Object.entries(THEMES))('glass opacity, %s theme', (_theme, tokens) => {
  it.each(['--glass-bg', '--glass-bg-strong'])('%s is at least 85% opaque', (name) => {
    expect(color(tokens, name).a).toBeGreaterThanOrEqual(0.85);
  });
});

describe('contrast helper sanity', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 5);
    expect(contrastRatio(WHITE, WHITE)).toBeCloseTo(1, 5);
    // #767676 on white is the canonical "just passes AA" gray (4.54:1).
    expect(contrastRatio(parseColor('#767676'), WHITE)).toBeCloseTo(4.54, 2);
    expect(parseColor('rgba(15, 23, 42, 0.5)')).toEqual({ r: 15, g: 23, b: 42, a: 0.5 });
  });
});
