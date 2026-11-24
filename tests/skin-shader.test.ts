import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  injectSkinSSS,
  configureEyeCornea,
  skinLightUniforms,
  updateSkinLightUniforms,
  setSkinSSSEnabled,
} from '../src/scene/skin-shader';
import { enhanceAvatarMaterials } from '../src/scene/materials';
import { defined } from './helpers/defined';

describe('Skin Shader & Eye Wetness (REAL-04)', () => {
  it('injects Wrap Diffuse SSS shader chunks via onBeforeCompile', () => {
    const mat = new THREE.MeshPhysicalMaterial({ color: 0xffe0bd });
    injectSkinSSS(mat, { wrapAmount: 0.45 });

    expect(mat.userData.isSkinShader).toBe(true);
    expect(mat.userData.wrapAmount).toBe(0.45);
    expect(typeof mat.onBeforeCompile).toBe('function');

    // Symulacja kompilacji Three.js WebGLProgram
    const mockShader = {
      uniforms: {} as Record<string, { value: unknown }>,
      fragmentShader: '#include <common>\n#include <lights_fragment_begin>',
      vertexShader: '',
    };

    mat.onBeforeCompile(mockShader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);

    expect(defined(mockShader.uniforms.uSkinWrap).value).toBe(0.45);
    expect(mockShader.fragmentShader).toContain('uSkinSSSColor');
    expect(mockShader.fragmentShader).toContain('wrapDiffuse');
    expect(mockShader.fragmentShader).toContain('scatterEdge');
  });

  it('drives SSS from the shared key-light uniforms, not the loop directLight', () => {
    const mat = new THREE.MeshPhysicalMaterial({ color: 0xffe0bd });
    injectSkinSSS(mat);
    const mockShader = {
      uniforms: {} as Record<string, { value: unknown }>,
      fragmentShader: '#include <common>\n#include <lights_fragment_begin>',
      vertexShader: '',
    };
    mat.onBeforeCompile(mockShader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);

    expect(mockShader.fragmentShader).toContain('uKeyLightDirView');
    expect(mockShader.fragmentShader).not.toContain('directLight.direction');
    expect(mockShader.uniforms.uKeyLightDirView).toBe(skinLightUniforms.uKeyLightDirView);
    expect(mockShader.uniforms.uKeyLightColor).toBe(skinLightUniforms.uKeyLightColor);
    expect(mockShader.uniforms.uSkinSSSEnabled).toBe(skinLightUniforms.uSkinSSSEnabled);
    expect(mat.customProgramCacheKey()).toBe('skin-sss-v2');
  });

  it('updateSkinLightUniforms writes view-space direction and colour x intensity', () => {
    const key = new THREE.DirectionalLight(0xff8000, 2);
    key.position.set(0, 0, 1);
    key.target.position.set(0, 0, 0);
    key.updateMatrixWorld();
    key.target.updateMatrixWorld();
    const camera = new THREE.PerspectiveCamera();
    camera.updateMatrixWorld();

    updateSkinLightUniforms(key, camera);

    const dir = skinLightUniforms.uKeyLightDirView.value;
    expect(dir.x).toBeCloseTo(0, 5);
    expect(dir.y).toBeCloseTo(0, 5);
    expect(dir.z).toBeCloseTo(1, 5);
    const c = skinLightUniforms.uKeyLightColor.value;
    expect(c.r).toBeCloseTo(key.color.r * 2, 5);
    expect(c.g).toBeCloseTo(key.color.g * 2, 5);
    expect(c.b).toBeCloseTo(key.color.b * 2, 5);
  });

  it('setSkinSSSEnabled toggles the shared flag', () => {
    setSkinSSSEnabled(false);
    expect(skinLightUniforms.uSkinSSSEnabled.value).toBe(0);
    setSkinSSSEnabled(true);
    expect(skinLightUniforms.uSkinSSSEnabled.value).toBe(1);
  });

  it('configures eye cornea material with proper wetness and index of refraction', () => {
    const eyeMat = new THREE.MeshPhysicalMaterial();
    configureEyeCornea(eyeMat);

    expect(eyeMat.clearcoat).toBe(1.0);
    expect(eyeMat.roughness).toBe(0.03);
    expect(eyeMat.ior).toBe(1.376); // Human cornea refractive index
    expect(eyeMat.userData.isEyeMaterial).toBe(true);
  });

  it('automatically applies SSS to skin meshes and cornea settings to eye meshes in avatar hierarchy', () => {
    const root = new THREE.Group();

    const headMesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({ name: 'Head_Mat' })
    );
    headMesh.name = 'Avatar_Head';

    const eyeMesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({ name: 'Eye_Mat' })
    );
    eyeMesh.name = 'Avatar_RightEye';

    root.add(headMesh);
    root.add(eyeMesh);

    const mockRenderer = {
      capabilities: {
        getMaxAnisotropy: () => 16,
      },
    } as unknown as THREE.WebGLRenderer;

    enhanceAvatarMaterials(root, mockRenderer);

    const updatedHeadMat = headMesh.material as THREE.MeshPhysicalMaterial;
    expect(updatedHeadMat.userData.isSkinShader).toBe(true);
    expect(updatedHeadMat.sheen).toBe(0.35);

    const updatedEyeMat = eyeMesh.material as THREE.MeshPhysicalMaterial;
    expect(updatedEyeMat.userData.isEyeMaterial).toBe(true);
    expect(updatedEyeMat.clearcoat).toBe(1.0);
  });
});
