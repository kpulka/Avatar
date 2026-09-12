import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { StudioLighting } from '../src/scene/lighting';
import { enhanceAvatarMaterials } from '../src/scene/materials';

describe('Scene Lighting & Materials', () => {
  it('creates 3-point studio lighting with key, fill, and rim lights', () => {
    const lighting = new StudioLighting();
    expect(lighting.keyLight.intensity).toBeCloseTo(2.2);
    expect(lighting.keyLight.castShadow).toBe(true);
    expect(lighting.fillLight.intensity).toBeCloseTo(0.7);
    expect(lighting.rimLight.intensity).toBeCloseTo(2.6);

    const scene = new THREE.Scene();
    lighting.addToScene(scene);
    expect(scene.children).toContain(lighting.group);
  });

  it('enhances skin materials with sheen and clearcoat', () => {
    const headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xffccaa })
    );
    headMesh.name = 'Avatar_Head_Skin';

    // Mock renderer capabilities
    const mockRenderer = {
      capabilities: {
        getMaxAnisotropy: () => 16,
      },
    } as unknown as THREE.WebGLRenderer;

    enhanceAvatarMaterials(headMesh, mockRenderer);

    expect(headMesh.material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    const phys = headMesh.material as THREE.MeshPhysicalMaterial;
    expect(phys.sheen).toBeCloseTo(0.35);
    expect(phys.clearcoat).toBeCloseTo(0.08);
    expect(phys.metalness).toBe(0.0);
    expect(phys.roughness).toBeCloseTo(0.52);
  });
});
