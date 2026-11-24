/**
 * Static CSS helpers for the UIX-02 / UIX-04 gates: reads src/style.css as text, resolves design tokens,
 * computes lengths and WCAG contrast. Pure functions, no DOM.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const CSS_PATH: string = join(process.cwd(), 'src', 'style.css');

/** style.css with comments stripped, so prose can neither trip nor hide a rule. */
export function readCss(): string {
  return readFileSync(CSS_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Body of the first block that starts with `selector {` (nesting-aware). */
export function blockBody(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`);
  if (start === -1) return '';
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return '';
}

export type TokenMap = Map<string, string>;

function parseDeclarations(body: string): TokenMap {
  const map: TokenMap = new Map();
  for (const match of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    map.set(match[1] ?? '', (match[2] ?? '').trim());
  }
  return map;
}

/** Custom properties for a theme; the light map is the dark map with `body.theme-light` overrides applied. */
export function loadTokens(css: string): { dark: TokenMap; light: TokenMap } {
  const dark = parseDeclarations(blockBody(css, ':root'));
  const light: TokenMap = new Map(dark);
  for (const [name, value] of parseDeclarations(blockBody(css, 'body.theme-light'))) light.set(name, value);
  return { dark, light };
}

/** Resolves `var(--x)` references recursively (fallbacks are not used by this stylesheet). */
export function resolveVars(value: string, tokens: TokenMap, depth = 0): string {
  if (depth > 8) throw new Error(`token cycle while resolving "${value}"`);
  return value.replace(/var\((--[a-z0-9-]+)\)/g, (_all, name: string) => {
    const next = tokens.get(name);
    if (next === undefined) throw new Error(`undefined token ${name}`);
    return resolveVars(next, tokens, depth + 1);
  });
}

/** A length in px (rem/em are resolved against the 16px root); `null` when it is not a plain length. */
export function lengthToPx(value: string): number | null {
  const match = value.trim().match(/^(-?\d*\.?\d+)(px|rem|em)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  return match[2] === 'px' ? amount : amount * 16;
}

export interface Rule {
  selectors: string[];
  declarations: Map<string, string>;
}

/** Every innermost `selector { ... }` rule, including those inside @media blocks (flattened). */
export function parseRules(css: string): Rule[] {
  const rules: Rule[] = [];
  for (const match of css.matchAll(/([^{};]+)\{([^{}]*)\}/g)) {
    const prelude = (match[1] ?? '').trim();
    if (prelude.startsWith('@')) continue; // @keyframes / @media preludes that matched across a boundary
    const declarations = new Map<string, string>();
    for (const declaration of (match[2] ?? '').split(';')) {
      const colon = declaration.indexOf(':');
      if (colon === -1) continue;
      declarations.set(declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim());
    }
    rules.push({ selectors: prelude.split(',').map((selector) => selector.trim().replace(/\s+/g, ' ')), declarations });
  }
  return rules;
}

// ---------------------------------------------------------------------------------------------
// Color and WCAG contrast
// ---------------------------------------------------------------------------------------------

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function parseColor(value: string): Rgba {
  const text = value.trim().toLowerCase();
  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (hex) {
    let digits = hex[1] ?? '';
    if (digits.length === 3) digits = [...digits].map((digit) => digit + digit).join('');
    const channel = (index: number): number => parseInt(digits.slice(index * 2, index * 2 + 2), 16);
    return { r: channel(0), g: channel(1), b: channel(2), a: digits.length === 8 ? channel(3) / 255 : 1 };
  }
  const fn = text.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (fn) return { r: Number(fn[1]), g: Number(fn[2]), b: Number(fn[3]), a: fn[4] === undefined ? 1 : Number(fn[4]) };
  throw new Error(`unsupported color "${value}"`);
}

/** Source-over compositing of `top` onto an opaque `bottom`. */
export function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a;
  return {
    r: top.r * a + bottom.r * (1 - a),
    g: top.g * a + bottom.g * (1 - a),
    b: top.b * a + bottom.b * (1 - a),
    a: 1,
  };
}

function linear(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(color: Rgba): number {
  return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
}

/** WCAG 2.x contrast ratio between two opaque colors. */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
