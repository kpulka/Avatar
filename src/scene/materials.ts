import * as THREE from 'three';
import { injectSkinSSS, configureEyeCornea } from './skin-shader';

/** Drops undefined entries: three warns "parameter has value of undefined" for each one. */
function defined<T extends object>(params: T): T {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as T;
}

/**
 * Configures maximum anisotropy for all textures in the model hierarchy (docs/5)
 */
function configureTextures(root: THREE.Object3D, renderer: THREE.WebGLRenderer): void {
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
          // Only the base colour (albedo) is in sRGB, the rest is linear data
          tex.colorSpace = prop === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          tex.needsUpdate = true;
        }
      }
    }
  });
}

/**
 * Upgrades the MetaPerson model materials to the PBR standard with Wrap Diffuse SSS and eye wetness (docs/5)
 */
export function enhanceAvatarMaterials(root: THREE.Object3D, renderer: THREE.WebGLRenderer): void {
  configureTextures(root, renderer);

  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;

    const mesh = child as THREE.Mesh;
    const meshName = mesh.name.toLowerCase();

    if (meshName.includes('cornea')) {
      // The old opacity-0 shell rendered nothing but cost a sorted transparent draw; highlights come from the
      // eyeball clearcoat. Keep the original material untouched.
      mesh.visible = false;
      return;
    }

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    const enhancedMaterials = materials.map((mat) => {
      if (!mat) return mat;

      // 1. Teeth and mouth cavity (wetness, clearcoat 0.3)
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

      // 2. Eyeballs (we keep the original coloured iris and pupil texture from the GLB file!)
      if (meshName.includes('eyeball') || (meshName.includes('eye') && !meshName.includes('lash'))) {
        const standard = mat as THREE.MeshStandardMaterial;
        const eyeMat = new THREE.MeshPhysicalMaterial(
          defined({
            map: standard.map ?? undefined,
            // Keep the GLB detail maps: iris relief and the wet highlight depend on them.
            normalMap: standard.normalMap ?? undefined,
            normalScale: standard.normalScale?.clone(),
            roughnessMap: standard.roughnessMap ?? undefined,
            color: standard.map ? 0xffffff : (standard.color ?? 0xffffff),
          })
        );
        configureEyeCornea(eyeMat);
        return eyeMat;
      }

      // 3. Lashes: alpha-to-coverage on the opaque pass (MSAA is on) gives soft, order-independent edges
      if (meshName.includes('eyelash') || meshName.includes('lash')) {
        const standard = mat as THREE.MeshStandardMaterial;
        return new THREE.MeshStandardMaterial(
          defined({
            map: standard.map ?? undefined,
            alphaMap: standard.alphaMap ?? undefined,
            color: standard.color ?? new THREE.Color(0x111111),
            transparent: false,
            alphaToCoverage: true,
            side: THREE.DoubleSide,
            roughness: 0.8,
            metalness: 0.0,
          })
        );
      }

      // 4. Hair / brows (must precede the skin catch-all). The shipped avatar.glb has no separate hair mesh
      // (meshes: AvatarBody, AvatarEyelashes, AvatarHead, Avatar{Left,Right}{Cornea,Eyeball}, AvatarTeeth{Lower,Upper},
      // outfit), so this only matters for other GLBs.
      if (meshName.includes('hair') || meshName.includes('brow')) {
        const hair = (mat as THREE.MeshStandardMaterial).clone();
        hair.transparent = false;
        hair.alphaToCoverage = true;
        hair.depthWrite = true;
        hair.side = THREE.DoubleSide;
        return hair;
      }

      // 5. Skin (head, face, neck, body) — PBR with Wrap Diffuse SSS (REAL-04, docs/5)
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

        // Inject subsurface scattering (SSS)
        injectSkinSSS(skinMat);
        return skinMat;
      }

      return mat;
    });

    mesh.material = Array.isArray(mesh.material) ? enhancedMaterials : (enhancedMaterials[0] ?? mesh.material); // materials has exactly one entry here
  });
}
