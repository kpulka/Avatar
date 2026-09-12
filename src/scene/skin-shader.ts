import { MeshPhysicalMaterial, Color } from 'three';

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

    // 1. Definicja uniformów w frag shaderze
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `
      #include <common>
      uniform float uSkinWrap;
      uniform vec3 uSkinSSSColor;
      uniform float uSkinSSSIntensity;
      `
    );

    // 2. Modyfikacja cieniowania rozproszonego (Wrap Lighting z rozproszeniem hemoglobiny)
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_begin>',
      `
      #include <lights_fragment_begin>

      // Subsurface Scattering (Wrap Diffuse Approximation - docs/5)
      float wrapTerm = uSkinWrap;
      float NdotL = dot(geometryNormal, directLight.direction);
      float wrapDiffuse = clamp((NdotL + wrapTerm) / (1.0 + wrapTerm), 0.0, 1.0);

      // Krawędź cienia (terminator) zyskuje ciepłe rozproszenie hemoglobiny
      float scatterEdge = smoothstep(-wrapTerm, wrapTerm, NdotL) * (1.0 - smoothstep(0.0, 0.5, NdotL));
      vec3 sssContribution = uSkinSSSColor * scatterEdge * uSkinSSSIntensity * directLight.color;

      reflectedLight.directDiffuse += sssContribution;
      `
    );
  };

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
