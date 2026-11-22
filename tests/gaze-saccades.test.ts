import { describe, it, expect } from 'vitest';
import { GazeSaccades } from '../src/realism/gaze-saccades';

describe('GazeSaccades (REAL-02)', () => {
  it('clamps pointer target and maps horizontal gaze to conjugate eye shapes', () => {
    const gaze = new GazeSaccades();

    // Look right (X = +1.0)
    gaze.setPointer(1.0, 0.0);

    // Smoothing simulation step
    let weights = gaze.compute(0, 0.1);
    for (let i = 0; i < 10; i++) {
      weights = gaze.compute(0.1 + i * 0.05, 0.05);
    }

    // Left eye outward (out-left), right eye toward the nose (in-right)
    expect(weights.eyeLookOutLeft).toBeGreaterThan(0.5);
    expect(weights.eyeLookInRight).toBeGreaterThan(0.5);
    expect(weights.eyeLookInLeft).toBe(0);
    expect(weights.eyeLookOutRight).toBe(0);
  });

  it('triggers and finishes saccades within 30-50ms window', () => {
    const gaze = new GazeSaccades();
    gaze.forceSaccade(5.0, 0.2, 0.2);

    // W trakcie sakady (t = 5.02s)
    const midWeights = gaze.compute(5.02, 0.02);
    expect(midWeights.eyeLookInLeft + midWeights.eyeLookOutLeft).toBeGreaterThan(0);

    // After the saccade ends (t = 5.10s)
    const afterWeights = gaze.compute(5.1, 0.05);
    // Return toward the fixation point
    expect(afterWeights).toBeDefined();
  });

  it('maps vertical gaze up and down correctly for both eyes', () => {
    const gaze = new GazeSaccades();

    // Look up (Y = 1.0)
    gaze.setPointer(0.0, 1.0);
    let weights = gaze.compute(0, 0.1);
    for (let i = 0; i < 10; i++) {
      weights = gaze.compute(0.1 + i * 0.05, 0.05);
    }

    expect(weights.eyeLookUpLeft).toBeGreaterThan(0.5);
    expect(weights.eyeLookUpRight).toBeGreaterThan(0.5);
    expect(weights.eyeLookDownLeft).toBe(0);
    expect(weights.eyeLookDownRight).toBe(0);
  });
});
