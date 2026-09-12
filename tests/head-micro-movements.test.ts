import { describe, it, expect } from 'vitest';
import { HeadMicroMovements } from '../src/realism/head-micro-movements';
import { Object3D } from 'three';

describe('HeadMicroMovements (REAL-01)', () => {
  it('keeps yaw and roll strictly within natural anatomical boundaries (< 2 degrees)', () => {
    const micro = new HeadMicroMovements();

    // Próbkujemy 200 punktów czasowych w oknie 20 sekund
    for (let t = 0; t < 20; t += 0.1) {
      const { yaw, pitch, roll, offsetY } = micro.compute(t);

      // Kąty w radianach
      expect(Math.abs(yaw)).toBeLessThanOrEqual(0.036); // < 2.06 stopnia
      expect(Math.abs(pitch)).toBeLessThanOrEqual(0.045); // < 2.5 stopnia (z uwzględnieniem oddechu)
      expect(Math.abs(roll)).toBeLessThanOrEqual(0.016); // < 1 stopień
      expect(offsetY).toBeGreaterThanOrEqual(0);
      expect(offsetY).toBeLessThanOrEqual(0.003); // < 3mm
    }
  });

  it('exhibits breathing cycle periodicity matching ~0.25 Hz (~4s period)', () => {
    const micro = new HeadMicroMovements({ breathingFreqHz: 0.25 });

    // Przy t = 0 i t = 4.0s faza oddechu powinna zatoczyć pełny cykl (sinus powraca do tej samej wartości)
    const pos0 = micro.compute(0.0);
    const pos1 = micro.compute(4.0);

    // Amplituda oddechu offsetY przy t = 0 i t = 4.0 powinna być zbliżona
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
