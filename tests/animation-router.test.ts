import { describe, it, expect } from 'vitest';
import { resolveAnimationSource } from '../src/lipsync/animation-router';

describe('animation-router (PoseRouter — source selection per turn)', () => {
  it('LIVE turn (WSS) → ALWAYS visemes, even when mode=frames', () => {
    expect(resolveAnimationSource({ mode: 'frames', liveTurn: true })).toBe('viseme');
    expect(resolveAnimationSource({ mode: 'viseme', liveTurn: true })).toBe('viseme');
  });

  it('offline turn + mode=frames + EN → frames', () => {
    expect(resolveAnimationSource({ mode: 'frames', liveTurn: false })).toBe('frames');
  });

  it('mode=frames but the A2F server is unhealthy (a2fHealthy=false) → visemes (degradation)', () => {
    expect(resolveAnimationSource({ mode: 'frames', liveTurn: false, a2fHealthy: false })).toBe('viseme');
  });

  it('a2fHealthy undefined (Phase 8, synthetic demo) → frames allowed', () => {
    expect(resolveAnimationSource({ mode: 'frames', liveTurn: false, a2fHealthy: undefined })).toBe('frames');
  });

  it('PL or another language → visemes (A2F is trained on EN)', () => {
    expect(resolveAnimationSource({ mode: 'frames', liveTurn: false, language: 'pl' })).toBe('viseme');
    expect(resolveAnimationSource({ mode: 'frames', liveTurn: false, language: 'other' })).toBe('viseme');
    expect(resolveAnimationSource({ mode: 'frames', liveTurn: false, language: 'en' })).toBe('frames');
  });

  it('mode=viseme → visemes regardless of the rest of the context', () => {
    expect(resolveAnimationSource({ mode: 'viseme', liveTurn: false, language: 'en' })).toBe('viseme');
  });
});
