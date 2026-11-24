import { describe, it, expect } from 'vitest';
import { resolveAnimationSource } from '../src/lipsync/animation-router';

describe('animation-router (PoseRouter — wybór źródła per tura)', () => {
  it('LIVE tura (WSS) → ZAWSZE wizemy, nawet gdy mode=frames', () => {
    expect(resolveAnimationSource({ mode: 'frames', liveTurn: true })).toBe('viseme');
    expect(resolveAnimationSource({ mode: 'viseme', liveTurn: true })).toBe('viseme');
  });

  it('tura offline + mode=frames + EN → frames', () => {
    expect(resolveAnimationSource({ mode: 'frames', liveTurn: false })).toBe('frames');
  });

  it('mode=frames ale serwer A2F niezdrowy (a2fHealthy=false) → wizemy (degradacja)', () => {
    expect(resolveAnimationSource({ mode: 'frames', liveTurn: false, a2fHealthy: false })).toBe('viseme');
  });

  it('a2fHealthy undefined (Faza 8, demo syntetyczne) → frames dozwolone', () => {
    expect(resolveAnimationSource({ mode: 'frames', liveTurn: false, a2fHealthy: undefined })).toBe('frames');
  });

  it('język PL lub inny → wizemy (A2F trenowany na EN)', () => {
    expect(resolveAnimationSource({ mode: 'frames', liveTurn: false, language: 'pl' })).toBe('viseme');
    expect(resolveAnimationSource({ mode: 'frames', liveTurn: false, language: 'other' })).toBe('viseme');
    expect(resolveAnimationSource({ mode: 'frames', liveTurn: false, language: 'en' })).toBe('frames');
  });

  it('mode=viseme → wizemy niezależnie od reszty kontekstu', () => {
    expect(resolveAnimationSource({ mode: 'viseme', liveTurn: false, language: 'en' })).toBe('viseme');
  });

  it('policy table for non-live turns (documented behavior for the future per-turn router, 16-06)', () => {
    const cases: Array<[Parameters<typeof resolveAnimationSource>[0], 'viseme' | 'frames']> = [
      [{ mode: 'frames', liveTurn: false }, 'frames'],
      [{ mode: 'frames', liveTurn: false, language: 'en', a2fHealthy: true }, 'frames'],
      [{ mode: 'frames', liveTurn: false, language: 'pl' }, 'viseme'],
      [{ mode: 'frames', liveTurn: false, a2fHealthy: false }, 'viseme'],
      [{ mode: 'viseme', liveTurn: false }, 'viseme'],
      // liveTurn always wins, whatever else the context says
      [{ mode: 'frames', liveTurn: true, language: 'en', a2fHealthy: true }, 'viseme'],
    ];
    for (const [ctx, expected] of cases) {
      expect(resolveAnimationSource(ctx), JSON.stringify(ctx)).toBe(expected);
    }
  });
});
