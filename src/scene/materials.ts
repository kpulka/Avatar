import * as THREE from 'three';
import { injectSkinSSS, configureEyeCornea } from './skin-shader';

/**
 * Konfiguruje maksymalną anizotropię dla wszystkich tekstur w hierarchii modelu (docs/5)
 */
export function configureTextures(root: THREE.Object3D, renderer: THREE.WebGLRenderer): void {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;

    const mesh = child as THREE.Mesh;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    for (const mat of materials) {
      if (!mat) continue;

      const record = mat as unknown as Record<string, THREE.Texture | undefined>;
      const textureProps = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'specularMap'];

      for (const prop of textureProps) {
        const tex = record[prop];
        if (tex && tex.isTexture) {
          tex.anisotropy = maxAniso;
          // Tylko kolor bazowy (albedo) jest w sRGB, reszta to dane liniowe
          tex.colorSpace = prop === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          tex.needsUpdate = true;
        }
      }
    }
  });
}

/**
 * Ulepsza materiały modelu MetaPerson do standardu PBR z Wrap Diffuse SSS i wilgotnością oczu (docs/5)
 */
export function enhanceAvatarMaterials(root: THREE.Object3D, renderer: THREE.WebGLRenderer): void {
  configureTextures(root, renderer);

  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;

    const mesh = child as THREE.Mesh;
    const meshName = mesh.name.toLowerCase();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    const enhancedMaterials = materials.map((mat) => {
      if (!mat) return mat;

      // 1. Zęby i jama ustna (wilgotność, clearcoat 0.3)
      if (meshName.includes('teeth') || meshName.includes('tooth') || meshName.includes('mouth')) {
        if (mat instanceof THREE.MeshPhysicalMaterial) {
          mat.clearcoat = 0.3;
          mat.clearcoatRoughness = 0.2;
          mat.roughness = 0.25;
          return mat;
        }
        return new THREE.MeshPhysicalMaterial({
          map: (mat as THREE.MeshStandardMaterial).map,
          color: (mat as THREE.MeshStandardMaterial).color,
          roughness: 0.25,
          metalness: 0.0,
          clearcoat: 0.3,
          clearcoatRoughness: 0.2,
        });
      }

      // 2. Rogówka (przezroczysta powłoka zewnętrzna oka — refrakcja i blik, widoczna tęczówka pod spodem)
      if (meshName.includes('cornea')) {
        const corneaMat = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.0,
          depthWrite: false,
        });
        configureEyeCornea(corneaMat);
        return corneaMat;
      }

      // 3. Gałki oczne (zachowujemy oryginalną kolorową teksturę tęczówki i źrenicy z pliku GLB!)
      if (meshName.includes('eyeball') || (meshName.includes('eye') && !meshName.includes('lash'))) {
        const standard = mat as THREE.MeshStandardMaterial;
        const eyeMat = new THREE.MeshPhysicalMaterial({
          map: standard.map ?? undefined,
          color: standard.map ? 0xffffff : (standard.color ?? 0xffffff),
        });
        configureEyeCornea(eyeMat);
        return eyeMat;
      }

      // 4. Rzęsy (eyelashes) — przezroczyste z testem alfa
      if (meshName.includes('eyelash') || meshName.includes('lash')) {
        const standard = mat as THREE.MeshStandardMaterial;
        return new THREE.MeshStandardMaterial({
          map: standard.map ?? undefined,
          color: standard.color ?? new THREE.Color(0x111111),
          transparent: true,
          alphaTest: 0.5,
          roughness: 0.8,
          metalness: 0.0,
        });
      }

      // 5. Skóra (głowa, twarz, szyja, ciało) — PBR z Wrap Diffuse SSS (REAL-04, docs/5)
      const isSkin =
        meshName.includes('head') ||
        meshName.includes('face') ||
        meshName.includes('skin') ||
        meshName.includes('body') ||
        (mesh.morphTargetDictionary !== undefined && !meshName.includes('teeth'));

      if (isSkin) {
        let skinMat: THREE.MeshPhysicalMaterial;

        if (mat instanceof THREE.MeshPhysicalMaterial) {
          skinMat = mat;
          skinMat.metalness = 0.0;
          skinMat.roughness = 0.52;
          skinMat.sheen = 0.35;
          skinMat.sheenRoughness = 0.55;
          skinMat.sheenColor = new THREE.Color('#ffd6c2');
          skinMat.clearcoat = 0.08;
          skinMat.clearcoatRoughness = 0.4;
        } else {
          const standard = mat as THREE.MeshStandardMaterial;
          skinMat = new THREE.MeshPhysicalMaterial({
            map: standard.map,
            normalMap: standard.normalMap,
            normalScale: standard.normalScale ?? new THREE.Vector2(0.85, 0.85),
            roughnessMap: standard.roughnessMap,
            color: standard.color,
            roughness: 0.52,
            metalness: 0.0,
            sheen: 0.35,
            sheenRoughness: 0.55,
            sheenColor: new THREE.Color('#ffd6c2'),
            clearcoat: 0.08,
            clearcoatRoughness: 0.4,
          });
        }

        // Wstrzyknięcie rozproszenia podpowierzchniowego (SSS)
        injectSkinSSS(skinMat);
        return skinMat;
      }

      return mat;
    });

    mesh.material = Array.isArray(mesh.material) ? enhancedMaterials : enhancedMaterials[0];
  });
}
