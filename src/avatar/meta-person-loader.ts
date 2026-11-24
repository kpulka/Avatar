import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { AvatarLoader, LoadedAvatar } from '../types/avatar';
import { ArKitBlendshapeDriver } from './face-driver';
import { assertRequiredShapes, normalizeShapeName, REQUIRED_SHAPES } from './shape-normalizer';

export class MetaPersonLoader implements AvatarLoader {
  private readonly gltfLoader: GLTFLoader;
  private readonly dracoLoader: DRACOLoader;

  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
  }

  public async load(
    urlOrFile: string | File,
    scene?: THREE.Scene,
    onProgress?: (fraction: number | null) => void
  ): Promise<LoadedAvatar> {
    let url: string;
    let isBlob = false;

    if (urlOrFile instanceof File) {
      url = URL.createObjectURL(urlOrFile);
      isBlob = true;
    } else {
      url = urlOrFile;
    }

    try {
      const gltf = await this.gltfLoader.loadAsync(url, isBlob ? undefined : (event) => {
        onProgress?.(event.lengthComputable && event.total > 0 ? event.loaded / event.total : null);
      });
      const avatar = gltf.scene;
      avatar.name = 'MetaPersonAvatar';

      const speechMeshes: THREE.Mesh[] = [];
      let masterMorphDict: Record<string, number> | null = null;
      const allAvailableShapeNames: string[] = [];

      avatar.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).morphTargetDictionary) {
          const mesh = child as THREE.Mesh;
          const dict = mesh.morphTargetDictionary!;

          // Protection against geometry clipping under deformation (docs/1)
          mesh.frustumCulled = false;
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          // Check whether the mesh contains speech-apparatus or ARKit facial-expression keys
          const keys = Object.keys(dict).map(normalizeShapeName);
          const hasFacialKeys = keys.some(
            (k) =>
              (REQUIRED_SHAPES as readonly string[]).includes(k) ||
              k.startsWith('eye') ||
              k.startsWith('brow') ||
              k.startsWith('mouth') ||
              k.startsWith('jaw')
          );

          if (hasFacialKeys) {
            speechMeshes.push(mesh);
            if (!masterMorphDict || Object.keys(dict).length > Object.keys(masterMorphDict).length) {
              masterMorphDict = dict;
            }
            for (const key of Object.keys(dict)) {
              allAvailableShapeNames.push(key);
            }
          }
        }
      });

      // Shadows: every mesh receives; eyes, corneas and lashes do not cast (avoids self-shadowed dark eyes)
      avatar.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const n = mesh.name.toLowerCase();
        mesh.receiveShadow = true;
        mesh.castShadow = !(n.includes('eye') || n.includes('cornea') || n.includes('lash'));
      });

      // If not found directly by the expression keys, check all meshes that have any morph targets
      if (speechMeshes.length === 0) {
        avatar.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).morphTargetDictionary) {
            const mesh = child as THREE.Mesh;
            mesh.frustumCulled = false;
            speechMeshes.push(mesh);
            if (!masterMorphDict || Object.keys(mesh.morphTargetDictionary!).length > Object.keys(masterMorphDict).length) {
              masterMorphDict = mesh.morphTargetDictionary || null;
            }
            for (const key of Object.keys(mesh.morphTargetDictionary!)) {
              allAvailableShapeNames.push(key);
            }
          }
        });
      }

      // Fail-fast validation: without the required blendshapes lip-sync has no right to work
      assertRequiredShapes(allAvailableShapeNames);

      const faceDriver = new ArKitBlendshapeDriver(speechMeshes, masterMorphDict || {});

      // Adjust the rig scale and centering if necessary
      const box = new THREE.Box3().setFromObject(avatar);
      const size = new THREE.Vector3();
      box.getSize(size);

      // If the model is taller than 3 units or smaller than 0.3, normalize it
      if (size.y > 0) {
        const scaleFactor = 1.75 / size.y; // approximation of natural human height
        avatar.scale.setScalar(scaleFactor);
      }

      // Place the feet/base on the ground
      box.setFromObject(avatar);
      avatar.position.y -= box.min.y;

      // Relax the default T-Pose into a natural resting pose
      relaxArmsToNaturalPose(avatar);

      if (scene) {
        scene.add(avatar);
      }

      return {
        root: avatar,
        faceDriver,
        speechMeshes,
        morphTargetDictionary: masterMorphDict || {},
      };
    } finally {
      if (isBlob) {
        URL.revokeObjectURL(url);
      }
    }
  }

  public dispose(): void {
    this.dracoLoader.dispose();
  }
}

/**
 * Moves the arm bones from the raw T-Pose into a natural resting pose along the body
 */
function relaxArmsToNaturalPose(root: THREE.Object3D): void {
  const leftArm = root.getObjectByName('LeftArm');
  const rightArm = root.getObjectByName('RightArm');
  const leftForeArm = root.getObjectByName('LeftForeArm');
  const rightForeArm = root.getObjectByName('RightForeArm');

  if (leftArm) {
    // Rotate the arm down along the torso (~68° lowering the arms into a natural A-pose)
    leftArm.rotateX(1.18);
  }
  if (rightArm) {
    rightArm.rotateX(1.18);
  }
  if (leftForeArm) {
    leftForeArm.rotateX(0.15);
  }
  if (rightForeArm) {
    rightForeArm.rotateX(0.15);
  }
}

