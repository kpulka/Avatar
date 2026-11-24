// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createConversationDock } from '../src/ui/user/conversation-dock';
import { createAlgorithmSwitcher } from '../src/ui/user/algorithm-switcher';
import { createUserSettings } from '../src/ui/user/user-settings';
import { createConnectionBanner } from '../src/ui/user/connection-banner';
import { createScenePanel } from '../src/ui/studio/panels/scene-panel';
import { createSessionPanel } from '../src/ui/studio/panels/session-panel';
import { createA2fPanel } from '../src/ui/studio/panels/a2f-panel';
import { createAnimationPanel } from '../src/ui/studio/panels/animation-panel';
import { createInspectorPanel } from '../src/ui/studio/panels/inspector-panel';
import { createVisemesPanel } from '../src/ui/studio/panels/visemes-panel';
import { createModal } from '../src/ui/shared/modal';
import { createToast } from '../src/ui/shared/toast';
import { createLoader } from '../src/ui/shared/loader';
import { createUiFixture } from './helpers/ui-fixtures';
import { loadTokens, lengthToPx, parseRules, readCss, resolveVars, type TokenMap } from './helpers/css-tokens';

/**
 * UIX-02 static gates: typography floor (no text < 12px) and interactive target floor (>= 44px).
 * Reads the stylesheet as text and mounts the real components in jsdom (no layout engine, so the DOM half
 * proves "every control is covered by a sized selector" and the CSS half proves "that selector is >= 44px").
 */
const CSS = readCss();
const TOKENS = loadTokens(CSS);
const ROOT = process.cwd();

const MIN_FONT_PX = 12;
const MIN_TARGET_PX = 44;

function resolvePx(value: string, tokens: TokenMap): number | null {
  return lengthToPx(resolveVars(value, tokens));
}

describe('typography floor (UIX-02)', () => {
  it('every font-size declaration resolves to a plain length >= 12px in both themes (var() resolved, rem base 16px)', () => {
    const offenders: string[] = [];
    for (const rule of parseRules(CSS)) {
      const size = rule.declarations.get('font-size');
      if (size === undefined) continue;
      for (const [theme, tokens] of Object.entries(TOKENS)) {
        const px = resolvePx(size, tokens);
        // null = not a plain length (calc/clamp/keyword): not verifiable statically, so it must not be used.
        if (px === null || px < MIN_FONT_PX) offenders.push(`${theme}: ${rule.selectors.join(', ')} { font-size: ${size} }`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the font shorthand and relative keywords never set a size (they would bypass the gate above)', () => {
    const shorthand = parseRules(CSS).filter((rule) => rule.declarations.has('font'));
    expect(shorthand.map((rule) => rule.selectors.join(', '))).toEqual([]);
  });

  it('typography role tokens are defined and respect the floor', () => {
    for (const [name, expected] of [
      ['--text-display', 28],
      ['--text-heading', 18],
      ['--text-body', 14],
      ['--text-label', 12],
    ] as const) {
      expect(resolvePx(TOKENS.dark.get(name) ?? '', TOKENS.dark), name).toBe(expected);
    }
  });

  it('no inline font size sneaks in through index.html or TypeScript sources', () => {
    const files = [join(ROOT, 'index.html')];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (name.endsWith('.ts')) files.push(full);
      }
    };
    walk(join(ROOT, 'src'));
    const offenders = files.filter((file) => /font-size\s*:|\.fontSize\b|fontSize\s*[:=]/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

/** Selectors that style an interactive control. Each must declare a >= 44px target (UIX-02). */
const TARGET_SELECTORS: Array<{ selector: string; width?: boolean }> = [
  { selector: '.dock-btn' },
  { selector: '.dock-icon-btn', width: true },
  { selector: '.segment-btn' },
  { selector: '.compare-chip' },
  { selector: '.studio-tab' },
  { selector: '.btn-drawer-close', width: true },
  { selector: '.btn-exit-presentation' },
  { selector: '.preset-btn' },
  { selector: '.btn-phoneme' },
  { selector: '.sample-speech-buttons button' },
  { selector: '.viseme-group-select' },
  { selector: '.engine-select' },
  { selector: '.viseme-chip' },
  { selector: '.btn' },
  { selector: '.btn-tiny' },
  { selector: '.search-input' },
  { selector: '.user-settings-form select' },
  { selector: '.text-input' },
  { selector: '.engine-toggle' },
  { selector: '.toast-close', width: true },
  { selector: '.dialog-close', width: true },
  { selector: '.rig-category-title' },
  { selector: 'input[type="range"]' },
];

describe('interactive target floor (UIX-02)', () => {
  const rules = parseRules(CSS);
  const SIZE_PROPS = ['min-height', 'height', 'min-width', 'width'] as const;

  it.each(TARGET_SELECTORS)('$selector declares a >= 44px target in both themes', ({ selector, width }) => {
    const matching = rules.filter((rule) => rule.selectors.includes(selector));
    expect(matching.length, `${selector} has no rule`).toBeGreaterThan(0);

    const declares = (prop: string): boolean => matching.some((rule) => rule.declarations.has(prop));
    // Native-height controls get a min-height; icon-only buttons also need min-width.
    expect(declares('min-height') || declares('height'), `${selector} declares no height`).toBe(true);
    if (width) expect(declares('min-width') || declares('width'), `${selector} declares no width`).toBe(true);

    const offenders: string[] = [];
    for (const rule of matching) {
      for (const prop of SIZE_PROPS) {
        const value = rule.declarations.get(prop);
        if (value === undefined || value.includes('%')) continue;
        for (const [theme, tokens] of Object.entries(TOKENS)) {
          const px = resolvePx(value, tokens);
          if (px !== null && px < MIN_TARGET_PX) offenders.push(`${theme}: ${selector} { ${prop}: ${value} } = ${px}px`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the target token itself is >= 44px', () => {
    expect(resolvePx(TOKENS.dark.get('--target-min') ?? '', TOKENS.dark)).toBeGreaterThanOrEqual(MIN_TARGET_PX);
  });

  it('every mounted interactive control is covered by one of the sized selectors', () => {
    const roots: HTMLElement[] = [];
    const mount = (create: () => { mount: (ctx: ReturnType<typeof createUiFixture>['ctx']) => unknown }): void => {
      const fixture = createUiFixture({ uiMode: 'studio' });
      create().mount(fixture.ctx);
      roots.push(fixture.host);
    };
    mount(createConversationDock);
    mount(createAlgorithmSwitcher);
    mount(createConnectionBanner);
    mount(createScenePanel);
    mount(createSessionPanel);
    mount(createA2fPanel);
    mount(createAnimationPanel);
    mount(createInspectorPanel);
    mount(createVisemesPanel);

    // Settings form (built inside the modal content) plus the real shared primitives.
    const settings = createUiFixture();
    createUserSettings().mount(settings.ctx);
    (settings.host.querySelector('.user-settings-btn') as HTMLButtonElement).click();

    const shared = document.createElement('div');
    document.body.append(shared);
    const modal = createModal(shared);
    modal.open('Title', document.createElement('div'));
    const toast = createToast(shared);
    toast.show('error text', 'error');
    createLoader(shared, { onRetry: () => undefined }).error('boom');
    roots.push(settings.host, shared);

    const controls = roots.flatMap((root) => [
      ...root.querySelectorAll<HTMLElement>(
        'button, select, summary, textarea, [role="tab"], input:not([type="hidden"]):not([type="file"])'
      ),
    ]);
    expect(controls.length).toBeGreaterThan(20);

    const selectors = TARGET_SELECTORS.map((entry) => entry.selector);
    const uncovered = controls
      .filter((control) => {
        const probe =
          control instanceof HTMLInputElement && ['checkbox', 'radio'].includes(control.type) ? control.closest('label') : control;
        return !probe || !selectors.some((selector) => probe.matches(selector));
      })
      .map((control) => `${control.outerHTML.slice(0, 120)} < ${control.parentElement?.className}`);
    expect([...new Set(uncovered)]).toEqual([]);
  });
});
