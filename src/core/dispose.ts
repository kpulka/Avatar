import * as THREE from 'three';

/** Releases resources owned by a detached avatar while preserving its environment map. */
export function disposeObject3D(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of meshMaterials) materials.add(material);
    const skinned = object as THREE.SkinnedMesh;
    if (skinned.isSkinnedMesh && skinned.skeleton) skeletons.add(skinned.skeleton);
  });

  for (const material of materials) {
    for (const [key, value] of Object.entries(material)) {
      if (key !== 'envMap' && value instanceof THREE.Texture) textures.add(value);
    }
  }
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
  skeletons.forEach((skeleton) => skeleton.dispose());
}
