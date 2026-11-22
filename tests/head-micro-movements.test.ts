import { describe, it, expect } from 'vitest';
import { HeadMicroMovements } from '../src/realism/head-micro-movements';
import { Object3D } from 'three';

describe('HeadMicroMovements (REAL-01)', () => {
  it('keeps yaw and roll strictly within natural anatomical boundaries (< 2 degrees)', () => {
    const micro = new HeadMicroMovements();

    // Sample 200 time points in a 20-second window
    for (let t = 0; t < 20; t += 0.1) {
      const { yaw, pitch, roll, offsetY } = micro.compute(t);

      // Angles in radians
      expect(Math.abs(yaw)).toBeLessThanOrEqual(0.036); // < 2.06 stopnia
      expect(Math.abs(pitch)).toBeLessThanOrEqual(0.045); // < 2.5 degrees (including breathing)
      expect(Math.abs(roll)).toBeLessThanOrEqual(0.016); // < 1 degree
      expect(offsetY).toBeGreaterThanOrEqual(0);
      expect(offsetY).toBeLessThanOrEqual(0.003); // < 3mm
    }
  });

  it('exhibits breathing cycle periodicity matching ~0.25 Hz (~4s period)', () => {
    const micro = new HeadMicroMovements({ breathingFreqHz: 0.25 });

    // At t = 0 and t = 4.0s the breathing phase should complete a full cycle (the sine returns to the same value)
    const pos0 = micro.compute(0.0);
    const pos1 = micro.compute(4.0);

    // The breathing offsetY amplitude at t = 0 and t = 4.0 should be similar
    expect(pos0.offsetY).toBeCloseTo(pos1.offsetY, 3);
  });

  it('updates Three.js Object3D relative to base position and rotation', () => {
    const micro = new HeadMicroMovements();
    const mockObject = new Object3D();
    mockObject.position.set(0, 1.2, 0);
    mockObject.rotation.set(0, 0, 0);

    micro.update(0.1, mockObject);

    expect(mockObject.position.y).toBeGreaterThanOrEqual(1.2);
    expect(mockObject.position.x).toBe(0);
    expect(mockObject.position.z).toBe(0);
  });
});
