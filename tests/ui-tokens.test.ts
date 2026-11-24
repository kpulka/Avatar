import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Static regression gate for the design-token system (Phase 15-01, UIX-01/02/11).
 * Reads src/style.css as text; no DOM needed.
 */
const CSS_PATH = fileURLToPath(new URL('../src/style.css', import.meta.url));
const RAW = readFileSync(CSS_PATH, 'utf8');
/** Comments removed so prose cannot trip (or hide) a rule. */
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, '');

/** Returns the body of the first top-level block starting with `selector {`. */
function blockBody(source: string, selector: string): string {
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

function customProps(body: string): string[] {
  return [...body.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1] ?? '');
}

const ROOT_BODY = blockBody(CSS, ':root');
const LIGHT_BODY = blockBody(CSS, 'body.theme-light');

describe('design tokens (src/style.css)', () => {
  it('(a) :root defines at least 30 custom properties', () => {
    expect(customProps(ROOT_BODY).length).toBeGreaterThanOrEqual(30);
  });

  it('(b) no hex / rgb / rgba / hsl literals outside the two token blocks', () => {
    const withoutTokens = CSS.replace(`:root {${ROOT_BODY}}`, '').replace(`body.theme-light {${LIGHT_BODY}}`, '');
    const hex = withoutTokens.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    const fn = withoutTokens.match(/\b(?:rgba?|hsla?)\(/g) ?? [];
    expect([...hex, ...fn]).toEqual([]);
  });

  it('(c) no font-size below the 12px floor', () => {
    const sizes = [...CSS.matchAll(/font-size:\s*([\d.]+)(px|rem|em)/g)];
    const tooSmall = sizes.filter(([, value, unit]) => {
      const px = unit === 'px' ? Number(value) : Number(value) * 16;
      return px < 12;
    });
    expect(tooSmall.map((m) => m[0])).toEqual([]);
    // The type-role tokens themselves must respect the floor too.
    const label = ROOT_BODY.match(/--text-label:\s*(\d+)px/);
    expect(label && Number(label[1])).toBeGreaterThanOrEqual(12);
  });

  it('(d) body.theme-light swaps at least 8 tokens and holds no component rules', () => {
    const props = customProps(LIGHT_BODY);
    expect(props.length).toBeGreaterThanOrEqual(8);
    // Every override must target a token that exists in :root (a typo would silently do nothing).
    const rootProps = new Set(customProps(ROOT_BODY));
    expect(props.filter((p) => !rootProps.has(p))).toEqual([]);
    // Light theme is a token swap only: no selector like `body.theme-light .foo`.
    expect(CSS).not.toMatch(/body\.theme-light\s+[.#a-z[]/i);
  });

  it('(e) dead selectors from the 15-CONTEXT C1 audit are gone', () => {
    const dead = [
      '.top-dock',
      '.dock-left',
      '.dock-center',
      '.dock-right',
      '.brand ',
      '.brand{',
      '.telemetry-pill-card',
      '.pill-header',
      '.pill-label',
      '.pill-val',
      '.pill-fps-badge',
      '.fps-unit',
      '.pill-meta',
      '.pill-buttons',
      '.status-idle',
      '.status-loading',
      '.status-ready',
      '.status-error',
      '.align-badge',
      '.align-el',
      '.align-fallback',
      '.modal-buttons',
      '.select-input',
      '.btn-presentation',
    ];
    expect(dead.filter((selector) => CSS.includes(selector))).toEqual([]);
  });

  it('keeps the magenta typo and `transition: all` out', () => {
    expect(CSS).not.toMatch(/#f0c\b/i);
    expect(CSS).not.toMatch(/transition:\s*all\b/);
  });

  it('every var(--x) reference resolves to a defined token', () => {
    const defined = new Set([...customProps(ROOT_BODY), ...customProps(LIGHT_BODY)]);
    const used = [...CSS.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1] ?? '');
    expect([...new Set(used)].filter((name) => !defined.has(name))).toEqual([]);
  });

  it('z-index values come from the --z-* scale', () => {
    const literal = [...CSS.matchAll(/z-index:\s*(-?\d+)\s*;/g)].map((m) => m[0]);
    expect(literal).toEqual([]);
  });
});
