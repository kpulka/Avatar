import { MeshPhysicalMaterial, Color, Vector3 } from 'three';
import type { Camera, DirectionalLight } from 'three';

/** Shared by every skin material; updated once per frame (see StudioLighting.addToScene). */
export const skinLightUniforms = {
  /** Direction TO the key light in view space (same convention as three's direct light struct). */
  uKeyLightDirView: { value: new Vector3(0, 0, 1) },
  /** Key light colour multiplied by intensity. */
  uKeyLightColor: { value: new Color(1, 1, 1) },
  uSkinSSSEnabled: { value: 1 },
};

const _lightPos = new Vector3();
const _targetPos = new Vector3();

/** Copies the key light direction (view space) and colour into the shared skin uniforms. */
export function updateSkinLightUniforms(key: DirectionalLight, camera: Camera): void {
  key.getWorldPosition(_lightPos);
  key.target.getWorldPosition(_targetPos);
  skinLightUniforms.uKeyLightDirView.value
    .subVectors(_lightPos, _targetPos)
    .normalize()
    .transformDirection(camera.matrixWorldInverse);
  skinLightUniforms.uKeyLightColor.value.copy(key.color).multiplyScalar(key.intensity);
}

/** Toggles the SSS term without recompiling the shader. */
export function setSkinSSSEnabled(on: boolean): void {
  skinLightUniforms.uSkinSSSEnabled.value = on ? 1 : 0;
}

export interface SkinShaderOptions {
  wrapAmount?: number; // Współczynnik wrap diffuse [0.0, 1.0] (domyślnie 0.4)
  subsurfaceColor?: Color; // Odcień rozproszenia podpowierzchniowego (ciepły brzoskwiniowo-czerwony)
  subsurfaceIntensity?: number; // Intensywność rozproszenia (domyślnie 0.35)
}

/**
 * Wstrzykuje zaawansowane rozproszenie podpowierzchniowe (Wrap Diffuse SSS) do MeshPhysicalMaterial (docs/5 Stage 2)
 */
export function injectSkinSSS(
  material: MeshPhysicalMaterial,
  options: SkinShaderOptions = {}
): MeshPhysicalMaterial {
  const wrap = options.wrapAmount ?? 0.4;
  const sssColor = options.subsurfaceColor ?? new Color(0.85, 0.32, 0.22); // biologiczny odcień hemoglobiny
  const sssIntensity = options.subsurfaceIntensity ?? 0.35;

  material.userData.isSkinShader = true;
  material.userData.wrapAmount = wrap;
  material.userData.sssIntensity = sssIntensity;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSkinWrap = { value: wrap };
    shader.uniforms.uSkinSSSColor = { value: sssColor };
    shader.uniforms.uSkinSSSIntensity = { value: sssIntensity };
    // Same objects (not copies) so the per-frame updates propagate.
    shader.uniforms.uKeyLightDirView = skinLightUniforms.uKeyLightDirView;
    shader.uniforms.uKeyLightColor = skinLightUniforms.uKeyLightColor;
    shader.uniforms.uSkinSSSEnabled = skinLightUniforms.uSkinSSSEnabled;

    // 1. Definicja uniformów w frag shaderze
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `
      #include <common>
      uniform float uSkinWrap;
      uniform vec3 uSkinSSSColor;
      uniform float uSkinSSSIntensity;
      uniform vec3 uKeyLightDirView;
      uniform vec3 uKeyLightColor;
      uniform float uSkinSSSEnabled;
      `
    );

    // 2. Modyfikacja cieniowania rozproszonego (Wrap Lighting z rozproszeniem hemoglobiny)
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_begin>',
      `
      #include <lights_fragment_begin>

      // Wrap-diffuse SSS from the KEY light. NOTE: the loop's directLight variable here would be the LAST light of the loop (rim).
      float NdotLk = dot(normal, uKeyLightDirView);
      float wrapDiffuse = clamp((NdotLk + uSkinWrap) / (1.0 + uSkinWrap), 0.0, 1.0);
      float scatterEdge = smoothstep(-uSkinWrap, uSkinWrap, NdotLk) * (1.0 - smoothstep(0.0, 0.5, NdotLk));
      float wrapGain = max(wrapDiffuse - clamp(NdotLk, 0.0, 1.0), 0.0); // light wrapping past the terminator
      vec3 sss = material.diffuseColor * uSkinSSSColor * uKeyLightColor * uSkinSSSIntensity * (scatterEdge + wrapGain);
      reflectedLight.directDiffuse += sss * uSkinSSSEnabled;
      `
    );
  };
  material.customProgramCacheKey = () => 'skin-sss-v2';

  material.needsUpdate = true;
  return material;
}

/**
 * Konfiguruje materiał rogówki oka z realistyczną wilgotnością i refrakcją (docs/5)
 */
export function configureEyeCornea(material: MeshPhysicalMaterial): void {
  material.clearcoat = 1.0;
  material.clearcoatRoughness = 0.02;
  material.roughness = 0.03;
  material.ior = 1.376; // Współczynnik załamania ludzkiej rogówki
  material.metalness = 0.0;
  material.specularIntensity = 1.0;
  material.userData.isEyeMaterial = true;
  material.needsUpdate = true;
}
