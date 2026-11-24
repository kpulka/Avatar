// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createConversationDock } from '../src/ui/user/conversation-dock';
import { createUiFixture } from './helpers/ui-fixtures';
import { defined } from './helpers/defined';

const ROOT = process.cwd();
const CSS = readFileSync(join(ROOT, 'src', 'style.css'), 'utf8');
const CSS_NO_COMMENTS = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

/** Body of the first `@media (<condition>) { ... }` block. */
function mediaBlock(condition: string): string {
  const start = CSS_NO_COMMENTS.indexOf(`@media (${condition})`);
  if (start === -1) return '';
  const open = CSS_NO_COMMENTS.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < CSS_NO_COMMENTS.length; i += 1) {
    if (CSS_NO_COMMENTS[i] === '{') depth += 1;
    else if (CSS_NO_COMMENTS[i] === '}') {
      depth -= 1;
      if (depth === 0) return CSS_NO_COMMENTS.slice(open + 1, i);
    }
  }
  return '';
}

function listTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listTs(full));
    else if (name.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('responsive layout (15-07, static CSS)', () => {
  it('declares the three guard queries and the supported minimum viewport', () => {
    for (const width of ['1440px', '1280px', '1152px']) {
      expect(mediaBlock(`max-width: ${width}`).trim().length, width).toBeGreaterThan(0);
    }
    expect(CSS).toContain('Supported minimum: 1152x648');
  });

  it('defines the .sr-only utility', () => {
    expect(CSS_NO_COMMENTS).toMatch(/\.sr-only\s*\{[^}]*clip-path: inset\(50%\)/);
  });

  it('captions are anchored with a calc() offset above the dock', () => {
    expect(CSS_NO_COMMENTS).toMatch(/\.user-captions\s*\{[^}]*bottom:\s*calc\(/);
  });

  it('introduces no !important inside the guard queries', () => {
    for (const width of ['1440px', '1280px', '1152px']) {
      expect(mediaBlock(`max-width: ${width}`), width).not.toContain('!important');
    }
  });

  it('the only !important rules are the known display/presentation ones', () => {
    const offenders = CSS_NO_COMMENTS.split('}')
      .filter((rule) => rule.includes('!important'))
      .map((rule) => defined(rule.split('{')[0]).trim().replace(/\s+/g, ' '))
      // reduced-motion block is a deliberate global override
      .filter((selector) => !/prefers-reduced-motion/.test(selector));
    const allowed = [
      'body[data-mode="user"] .studio-shell',
      '.hidden',
      'body.presentation-mode .btn-exit-presentation',
    ];
    const unexpected = offenders.filter(
      (selector) =>
        !allowed.includes(selector) &&
        !selector.includes('presentation-mode') &&
        !/\.(vignette-overlay|user-dock|user-algo|user-status|side-drawer|studio-tab|segment-btn|toast|loader-overlay|btn-call|dock-btn|dock-icon-btn|pulse-dot|spinner|transcript-line)/.test(selector)
    );
    expect(unexpected).toEqual([]);
  });

  it('drawers keep a single scroll container and the viseme slider list is height-capped', () => {
    expect(CSS_NO_COMMENTS).toMatch(/\.viseme-shape-sliders\s*\{\s*max-height:\s*min\(44vh,\s*300px\)/);
    expect(CSS_NO_COMMENTS).toMatch(/\.telemetry-grid\s*\{[^}]*minmax\(0, 1fr\)/);
  });
});

describe('icon-only dock collapse keeps labels for assistive tech', () => {
  it('every dock button has an aria-label and a tooltip, before and after state changes', () => {
    const fixture = createUiFixture();
    createConversationDock().mount(fixture.ctx);
    const check = (): void => {
      for (const button of fixture.host.querySelectorAll<HTMLButtonElement>('.dock-btn')) {
        expect(button.getAttribute('aria-label'), button.className).toBeTruthy();
        expect(button.title, button.className).toBeTruthy();
      }
    };
    check();
    fixture.events.emit('voice:state', 'listening');
    fixture.events.emit('voice:muted', true);
    check();
  });
});

describe('final sweep gates (UIX-11)', () => {
  it('no global keydown listeners outside src/app', () => {
    const offenders = listTs(join(ROOT, 'src'))
      .filter((file) => !file.includes(join('src', 'app')))
      .filter((file) => /\b(window|document)\.addEventListener\(\s*['"]keydown['"]/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('no getElementById in the user layer', () => {
    const offenders = listTs(join(ROOT, 'src', 'ui', 'user')).filter((file) =>
      readFileSync(file, 'utf8').includes('getElementById')
    );
    expect(offenders).toEqual([]);
  });
});
