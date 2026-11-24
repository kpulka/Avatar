import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COPY, t } from '../src/app/copy';
import { defined } from './helpers/defined';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Polish diacritics as \uXXXX escapes, so this test file stays ASCII-only. */
const PL_DIACRITICS = /[\u0104\u0105\u0106\u0107\u0118\u0119\u0141\u0142\u0143\u0144\u00D3\u00F3\u015A\u015B\u0179\u017A\u017B\u017C]/;

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
        if (!(defined(match[1]) in COPY)) missing.push(`${file.slice(ROOT.length)}: ${match[1]}`);
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
        if (file.endsWith('animation-controller.ts') && /Dzie\u0144 dobry!/.test(line)) return; // functional data (PL calibration phrase)
        if (file.endsWith('viseme-overrides.ts')) return;
        offenders.push(`${file.slice(ROOT.length)}:${idx + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * Phase 15 slot contract (15-02). The IDs below are what Phase 15 plans reference; Phase 12
 * renamed a few of the originally planned IDs, the mapping is documented in 15-02-SUMMARY.md
 * (animation.sliderLabels -> animation.slider.*, visemes.shapeLabels -> visemes.shape.*,
 * inspector.categoryTitles -> inspector.category.*, poc.phases -> poc.phase1..3,
 * boot.loadingModel -> loader.avatar, webgl.fallbackBtn -> webgl.browserHint).
 * The gate is "every Phase 15 slot exists", not "COPY has exactly N keys".
 */
const PHASE15_SLOTS = [
  'brand.title', 'status.idle', 'status.listening', 'status.speaking', 'status.thinking',
  'dock.start', 'dock.end', 'dock.mute', 'dock.unmute', 'dock.muteAria', 'dock.unmuteAria',
  'dock.interrupt', 'dock.interruptAria', 'captions.you', 'captions.agent', 'captions.empty',
  'algo.segmentAria', 'algo.compare', 'algo.blind', 'algo.empty', 'algo.predicting', 'algo.playingA',
  'algo.playingB', 'algo.resultOrder', 'algo.orderLiveFirst', 'algo.orderA2fFirst', 'algo.result',
  'algo.resultPredictMs', 'algo.resultFrames', 'algo.partialWarning', 'algo.cancelled',
  'settings.title', 'settings.volumeLabel', 'settings.micLabel', 'settings.defaultDevice',
  'settings.themeLabel', 'settings.themeDark', 'settings.themeLight', 'settings.presetLabel',
  'settings.lockTooltip', 'presentation.show', 'presentation.showAria', 'loader.default', 'loader.model',
  'toast.conversationEnded', 'toast.conversationStarting', 'toast.connectionError', 'toast.micMuted',
  'toast.micUnmuted', 'toast.bargeIn', 'toast.agentChanged', 'poc.start', 'poc.interrupt1',
  'poc.interrupt2', 'poc.done', 'poc.transcriptUser', 'compare.failedToast', 'compare.a2fDownToast',
  'studio.title', 'studio.subtitle', 'studio.tabsAria', 'studio.closeAria', 'studio.leftOpenAria',
  'studio.leftCloseAria', 'panel.errorTitle', 'panel.retry', 'session.agentTitle', 'session.agentPlaceholder',
  'session.agentSave', 'session.agentEmptyError', 'session.audioTitle', 'session.telemetryTitle',
  'session.alignEl', 'session.alignFallback', 'session.locksTitle', 'session.lockLabel',
  'session.profileTitle', 'session.exportProfile', 'session.importProfile', 'session.exported',
  'session.imported', 'session.importRejected', 'session.exportFailed', 'session.importFailed',
  'session.stress', 'scene.modelTitle', 'scene.modelNone', 'scene.modelInfo', 'scene.loadDemo',
  'scene.generatingDemo', 'scene.demoError', 'scene.chooseGlb', 'scene.loadingFile', 'scene.fileError',
  'scene.presetsTitle', 'scene.presetsHint', 'scene.sssLabel', 'animation.engineLabel', 'animation.engineHint',
  'animation.sourceLabel', 'animation.sourceViseme', 'animation.sourceFrames', 'animation.sourceHint',
  'animation.presetsTitle', 'animation.phonemesTitle', 'animation.phrasePl', 'animation.phraseEn',
  'animation.demoA2f', 'animation.geometryTitle', 'animation.dynamicsTitle', 'animation.save', 'animation.reset',
  'animation.savedToast', 'animation.resetToast', 'a2f.urlTitle', 'a2f.urlPlaceholder', 'a2f.save',
  'a2f.urlInvalid', 'a2f.urlSaved', 'a2f.checkStatus', 'a2f.statusIdle', 'a2f.statusChecking',
  'a2f.statusOk', 'a2f.statusDown', 'a2f.demoTitle', 'a2f.demo', 'a2f.stats', 'visemes.groupEn',
  'visemes.groupChar', 'visemes.searchPlaceholder', 'visemes.pickViseme', 'visemes.stateDefault',
  'visemes.stateOverride', 'visemes.noMatches', 'visemes.resetKey', 'visemes.resetAll', 'visemes.hint',
  'inspector.searchPlaceholder', 'inspector.resetAll', 'inspector.mirror', 'inspector.mirrorHint',
  'scenePreset.studio-dark', 'scenePreset.studio-soft', 'scenePreset.cinema', 'scenePreset.light',
  'webgl.title', 'webgl.body', 'webgl.subtext',
];

describe('Phase 15 copy contract', () => {
  it('every Phase 15 slot exists with a non-empty value', () => {
    expect(PHASE15_SLOTS.filter((slot) => !(slot in COPY) || defined(COPY[slot]).trim() === '')).toEqual([]);
  });

  it('index.html holds no visible copy: the WebGL card is rendered by webgl-fallback.ts', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    expect(html).toContain('id="webgl-fallback"');
    expect(html).not.toMatch(/<h2|<button|<p[ >]/);
  });

  it('no inline user-visible string literals in src/ui or container.ts (all copy flows through t())', () => {
    // text / placeholder / ariaLabel / title / textContent assigned a literal that contains letters.
    const sinks = /\b(?:text|placeholder|ariaLabel|title|textContent|tooltip)\s*[:=]\s*(['"`])([^'"`$]*[A-Za-z]{2,}[^'"`$]*)\1/g;
    const files = [...listTs('src/ui'), join(ROOT, 'src/app/container.ts')];
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(sinks)) {
        offenders.push(`${file.slice(ROOT.length)}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
