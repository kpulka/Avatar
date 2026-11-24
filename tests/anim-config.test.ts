import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ANIM_DEFAULTS, clamp01 } from '../src/realism/anim-config';

function collectSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectSources(full, out);
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}

function leafKeys(obj: object, acc: string[] = []): string[] {
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && typeof value === 'object') leafKeys(value, acc);
    else acc.push(key);
  }
  return acc;
}

describe('ANIM_DEFAULTS', () => {
  it('is deeply frozen (mutation throws in strict mode)', () => {
    expect(Object.isFrozen(ANIM_DEFAULTS)).toBe(true);
    expect(Object.isFrozen(ANIM_DEFAULTS.relax)).toBe(true);
    expect(Object.isFrozen(ANIM_DEFAULTS.viseme.lambdaTiers)).toBe(true);
    expect(() => {
      (ANIM_DEFAULTS.relax as { durationMs: number }).durationMs = 1;
    }).toThrow();
    expect(() => {
      (ANIM_DEFAULTS.viseme.lambdaTiers as { closure: number }).closure = 1;
    }).toThrow();
  });

  it('every key is referenced by at least one runtime source file (no dead config)', () => {
    const files = collectSources('src').filter((f) => !f.replace(/\\/g, '/').endsWith('src/realism/anim-config.ts'));
    const corpus = files.map((f) => readFileSync(f, 'utf-8')).join('\n');
    const unreferenced = leafKeys(ANIM_DEFAULTS).filter((key) => !new RegExp(`\\.${key}\\b`).test(corpus));
    expect(unreferenced).toEqual([]);
  });

  it('snapshots the safety-critical numbers so any edit is conscious', () => {
    expect(ANIM_DEFAULTS.common.mouthCloseCap).toBe(0.85);
    expect(ANIM_DEFAULTS.manual.jawGuardMargin).toBe(0.2);
    expect(ANIM_DEFAULTS.common.snapEpsilon).toBe(0.001);
    expect(ANIM_DEFAULTS.relax.durationMs).toBe(150);
    expect(ANIM_DEFAULTS.emotion.mixFactorSpeaking).toBe(0.3);
    expect(ANIM_DEFAULTS.frame.dtCapSec).toBe(0.1);
  });

  it('keeps the bilabial jaw-gate numbers from Phase 11.2 (SHOW-06)', () => {
    expect(ANIM_DEFAULTS.viseme.closeJawThreshold).toBe(0.15);
    expect(ANIM_DEFAULTS.viseme.closeJawFactor).toBe(0.95);
    expect(ANIM_DEFAULTS.viseme.pressRef).toBe(0.35);
  });

  it('clamp01 clamps to [0, 1]', () => {
    expect(clamp01(-0.2)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(1.7)).toBe(1);
  });
});

describe('dead code stays removed (16-04)', () => {
  const corpus = collectSources('src')
    .map((f) => readFileSync(f, 'utf-8'))
    .join('\n');

  it.each(['purgeStaleEpochs', 'setAdaptivePrebuffer', 'bumpPrebufferForJitter', 'getPrebufferSeconds', 'relaxToNeutral'])(
    '%s is gone from src/',
    (name) => {
      expect(corpus.includes(name)).toBe(false);
    }
  );

  it('no bare 0.85 mouthClose cap in animation runtime code (comments and data tables excluded)', () => {
    const runtime = [
      'src/lipsync/face-controller.ts',
      'src/lipsync/viseme-scheduler.ts',
      'src/lipsync/procedural-blink.ts',
      'src/lipsync/demo-frames.ts',
      'src/realism/gaze-saccades.ts',
      'src/realism/head-micro-movements.ts',
      'src/realism/emotion-layer.ts',
    ];
    for (const file of runtime) {
      const code = readFileSync(file, 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      expect(code, file).not.toMatch(/0\.85/);
    }
  });
});
