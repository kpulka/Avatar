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
});
