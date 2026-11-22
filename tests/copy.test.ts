import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COPY, t } from '../src/app/copy';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Polish diacritics as \uXXXX escapes, so this test file stays ASCII-only. */
const PL_DIACRITICS = /[ĄąĆćĘęŁłŃńÓóŚśŹźŻż]/;

function listTs(relDir: string): string[] {
  const out: string[] = [];
  const walk = (abs: string): void => {
    for (const name of readdirSync(abs)) {
      const child = join(abs, name);
      if (statSync(child).isDirectory()) walk(child);
      else if (name.endsWith('.ts')) out.push(child);
    }
  };
  walk(join(ROOT, relDir));
  return out;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('copy registry (English UI strings)', () => {
  it('every slot has a non-empty value', () => {
    const empty = Object.entries(COPY).filter(([, value]) => value.trim() === '').map(([slot]) => slot);
    expect(empty).toEqual([]);
  });

  it('no slot value contains Polish diacritics (Polish test phrase is data, not copy)', () => {
    const offenders = Object.entries(COPY).filter(([, value]) => PL_DIACRITICS.test(value)).map(([slot]) => slot);
    expect(offenders).toEqual([]);
  });

  it('keeps representative slots stable (snapshot of 5 slots)', () => {
    expect({
      status: t('status.idle'),
      dock: t('dock.interruptAria'),
      studio: t('studio.subtitle'),
      panel: t('panel.errorTitle', { title: 'Scene' }),
      webgl: t('webgl.title'),
    }).toEqual({
      status: 'Ready',
      dock: "Interrupt the agent's speech",
      studio: 'Avatar configuration & diagnostics',
      panel: 'Panel "Scene" failed to load.',
      webgl: '⚠️ WebGL not supported',
    });
  });

  it('interpolates {param} markers and leaves unknown markers intact', () => {
    expect(t('algo.resultPredictMs', { ms: 1234 })).toBe('predict 1234 ms');
    expect(t('session.alignFallback', { el: 3, fb: 2 })).toBe('ALIGN: FALLBACK ⚠ (3/2)');
    expect(t('scene.modelInfo', { name: 'avatar', shapes: 51, meshes: 4 })).toBe(
      'Model: avatar · shapes: 51 · speech meshes: 4'
    );
    expect(t('settings.lockTooltip')).toBe('Locked by studio ({key})');
  });

  it('unknown slot warns and falls back to the slot id (fail-soft)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(t('does.not.exist')).toBe('does.not.exist');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('every slot referenced as t(\'...\') literal in src/ resolves (no dangling slot ids)', () => {
    const missing: string[] = [];
    const re = /\bt\('([A-Za-z0-9_.-]+)'/g;
    for (const file of listTs('src')) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(re)) {
        if (!(match[1] in COPY)) missing.push(`${file.slice(ROOT.length)}: ${match[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('UI literals: no Polish diacritics outside comments in src/ui, src/features (except the PL test phrase), index.html', () => {
    const files = [...listTs('src/ui'), ...listTs('src/features'), join(ROOT, 'index.html')];
    const offenders: string[] = [];
    for (const file of files) {
      readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, idx) => {
        if (!PL_DIACRITICS.test(line)) return;
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // comment lines: covered by 12-06 / Gate A
        if (/\bconsole\.(log|warn|error)\b/.test(line)) return; // developer strings: covered by 12-06
        if (file.endsWith('animation-controller.ts') && /Dzień dobry!/.test(line)) return; // functional data
        if (file.endsWith('viseme-overrides.ts')) return;
        offenders.push(`${file.slice(ROOT.length)}:${idx + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
