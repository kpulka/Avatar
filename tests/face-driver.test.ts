import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { ArKitBlendshapeDriver } from '../src/avatar/face-driver';

describe('ArKitBlendshapeDriver', () => {
  it('synchronizes weights across multiple sub-meshes having the same morph targets', () => {
    // Mesh 1 (head skin)
    const geo1 = new THREE.BufferGeometry();
    const mesh1 = new THREE.Mesh(geo1);
    mesh1.morphTargetDictionary = { jawOpen: 0, mouthClose: 1 };
    mesh1.morphTargetInfluences = [0, 0];

    // Mesh 2 (teeth with a separate jawOpen copy)
    const geo2 = new THREE.BufferGeometry();
    const mesh2 = new THREE.Mesh(geo2);
    mesh2.morphTargetDictionary = { jawOpen: 0 };
    mesh2.morphTargetInfluences = [0];

    const driver = new ArKitBlendshapeDriver([mesh1, mesh2], { jawOpen: 0, mouthClose: 1 });

    // Aplikacja pojedynczej wagi
    driver.applyWeight('jawOpen', 0.85);

    expect(mesh1.morphTargetInfluences[0]).toBeCloseTo(0.85);
    expect(mesh2.morphTargetInfluences[0]).toBeCloseTo(0.85);

    // Aplikacja batch
    driver.applyTargets({ jawOpen: 0.5, mouthClose: 1.0 });

    expect(mesh1.morphTargetInfluences[0]).toBeCloseTo(0.5);
    expect(mesh1.morphTargetInfluences[1]).toBeCloseTo(1.0);
    expect(mesh2.morphTargetInfluences[0]).toBeCloseTo(0.5);
  });

  it('clamps weights between 0 and 1', () => {
    const geo = new THREE.BufferGeometry();
    const mesh = new THREE.Mesh(geo);
    mesh.morphTargetDictionary = { jawOpen: 0 };
    mesh.morphTargetInfluences = [0];

    const driver = new ArKitBlendshapeDriver([mesh], { jawOpen: 0 });

    driver.applyWeight('jawOpen', 1.5);
    expect(mesh.morphTargetInfluences[0]).toBe(1.0);

    driver.applyWeight('jawOpen', -0.5);
    expect(mesh.morphTargetInfluences[0]).toBe(0.0);
  });

  it('has no second morph writer: relaxToNeutral is gone and applyTargets delegates to applyWeight', () => {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry());
    mesh.morphTargetDictionary = { jawOpen: 0 };
    mesh.morphTargetInfluences = [0];
    const driver = new ArKitBlendshapeDriver([mesh], { jawOpen: 0 });

    expect('relaxToNeutral' in driver).toBe(false);
    // the only methods that can write morphTargetInfluences are applyWeight and its batch wrapper
    const writers = Object.getOwnPropertyNames(Object.getPrototypeOf(driver)).filter(
      (name) => name !== 'constructor' && !name.startsWith('get') && !name.startsWith('list') && name !== 'buildTargetMap'
    );
    expect(writers.sort()).toEqual(['applyTargets', 'applyWeight']);

    const spy = vi.spyOn(driver, 'applyWeight');
    driver.applyTargets({ jawOpen: 0.3 });
    expect(spy).toHaveBeenCalledWith('jawOpen', 0.3);
  });
});
