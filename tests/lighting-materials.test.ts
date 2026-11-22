import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { StudioLighting } from '../src/scene/lighting';
import { enhanceAvatarMaterials } from '../src/scene/materials';
import { skinLightUniforms } from '../src/scene/skin-shader';

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

  it('focusOn re-centres the key light and keeps a tight head-sized shadow frustum', () => {
    const lighting = new StudioLighting();
    lighting.focusOn(new THREE.Vector3(0, 1.5, 0));

    expect(lighting.keyLight.target.position.toArray()).toEqual([0, 1.5, 0]);
    expect(lighting.keyLight.position.x).toBeCloseTo(1.5);
    expect(lighting.keyLight.position.y).toBeCloseTo(3.5);
    expect(lighting.keyLight.position.z).toBeCloseTo(2.0);
    expect(lighting.keyLight.shadow.camera.left).toBe(-0.35);
    expect(lighting.keyLight.shadow.camera.right).toBe(0.35);
    expect(lighting.keyLight.shadow.normalBias).toBeCloseTo(0.01);
  });

  it('updates the skin key-light uniforms from Scene.onBeforeRender', () => {
    const lighting = new StudioLighting();
    const scene = new THREE.Scene();
    lighting.addToScene(scene);
    scene.updateMatrixWorld(true);

    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 5);
    camera.updateMatrixWorld();

    skinLightUniforms.uKeyLightDirView.value.set(0, 0, 1);
    skinLightUniforms.uKeyLightColor.value.set(0, 0, 0);
    scene.onBeforeRender({} as THREE.WebGLRenderer, scene, camera, null as unknown as THREE.WebGLRenderTarget);

    const dir = skinLightUniforms.uKeyLightDirView.value;
    expect(dir.length()).toBeCloseTo(1, 5);
    expect(dir.x).toBeGreaterThan(0.1); // key sits to the right of the camera axis
    const col = skinLightUniforms.uKeyLightColor.value;
    expect(col.r).toBeCloseTo(lighting.keyLight.color.r * 2.2, 5);
    expect(col.g).toBeCloseTo(lighting.keyLight.color.g * 2.2, 5);
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

  describe('eye / lash / hair materials (SHOW-07)', () => {
    const mockRenderer = {
      capabilities: { getMaxAnisotropy: () => 16 },
    } as unknown as THREE.WebGLRenderer;

    const meshWith = (name: string, material: THREE.Material): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
      mesh.name = name;
      return mesh;
    };

    it('renders lashes with alpha-to-coverage on the opaque pass', () => {
      const lashes = meshWith('AvatarEyelashes', new THREE.MeshStandardMaterial());
      enhanceAvatarMaterials(lashes, mockRenderer);
      const mat = lashes.material as THREE.MeshStandardMaterial;
      expect(mat.alphaToCoverage).toBe(true);
      expect(mat.transparent).toBe(false);
    });

    it('renders hair with alpha-to-coverage and depth write', () => {
      const hair = meshWith('haircut_generated', new THREE.MeshStandardMaterial({ transparent: true }));
      enhanceAvatarMaterials(hair, mockRenderer);
      const mat = hair.material as THREE.MeshStandardMaterial;
      expect(mat.alphaToCoverage).toBe(true);
      expect(mat.transparent).toBe(false);
      expect(mat.depthWrite).toBe(true);
    });

    it('keeps the GLB normal and roughness maps on the eyeball', () => {
      const normalMap = new THREE.Texture();
      const roughnessMap = new THREE.Texture();
      const eye = meshWith('AvatarLeftEyeball', new THREE.MeshStandardMaterial({ normalMap, roughnessMap }));
      enhanceAvatarMaterials(eye, mockRenderer);
      const mat = eye.material as THREE.MeshPhysicalMaterial;
      expect(mat.normalMap).toBe(normalMap);
      expect(mat.roughnessMap).toBe(roughnessMap);
      expect(mat.userData.isEyeMaterial).toBe(true);
    });

    it('hides the cornea shell and leaves its material untouched', () => {
      const original = new THREE.MeshStandardMaterial();
      const cornea = meshWith('AvatarLeftCornea', original);
      enhanceAvatarMaterials(cornea, mockRenderer);
      expect(cornea.visible).toBe(false);
      expect(cornea.material).toBe(original);
    });
  });
});
