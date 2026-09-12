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

  public async load(urlOrFile: string | File, scene?: THREE.Scene): Promise<LoadedAvatar> {
    let url: string;
    let isBlob = false;

    if (urlOrFile instanceof File) {
      url = URL.createObjectURL(urlOrFile);
      isBlob = true;
    } else {
      url = urlOrFile;
    }

    try {
      const gltf = await this.gltfLoader.loadAsync(url);
      const avatar = gltf.scene;
      avatar.name = 'MetaPersonAvatar';

      const speechMeshes: THREE.Mesh[] = [];
      let masterMorphDict: Record<string, number> | null = null;
      const allAvailableShapeNames: string[] = [];

      avatar.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).morphTargetDictionary) {
          const mesh = child as THREE.Mesh;
          const dict = mesh.morphTargetDictionary!;

          // Zabezpieczenie przed obcinaniem geometrii przy deformacji (docs/1)
          mesh.frustumCulled = false;
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          // Sprawdzamy czy siatka zawiera klucze aparatu mowy lub mimiki twarzy ARKit
          const keys = Object.keys(dict).map(normalizeShapeName);
          const hasFacialKeys = keys.some(
            (k) =>
              REQUIRED_SHAPES.includes(k as any) ||
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

      // Jeśli nie znaleziono bezpośrednio po kluczach mimiki, sprawdź wszystkie siatki z jakimikolwiek morph targetami
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

      // Fail-fast walidacja: bez wymaganych blendshape'ów lips-sync nie ma prawa działać
      assertRequiredShapes(allAvailableShapeNames);

      const faceDriver = new ArKitBlendshapeDriver(speechMeshes, masterMorphDict || {});

      // Dostosuj skalę i wycentrowanie riga jeśli to konieczne
      const box = new THREE.Box3().setFromObject(avatar);
      const size = new THREE.Vector3();
      box.getSize(size);

      // Jeśli model jest wyższy niż 3 jednostki lub mniejszy niż 0.3, znormalizuj
      if (size.y > 0) {
        const scaleFactor = 1.75 / size.y; // przybliżenie naturalnego wzrostu człowieka
        avatar.scale.setScalar(scaleFactor);
      }

      // Ustawienie stóp/bazy na podłożu
      box.setFromObject(avatar);
      avatar.position.y -= box.min.y;

      // Złagodzenie domyślnej postawy T-Pose do naturalnej pozycji spoczynkowej
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
 * Ustawia kości ramion z surowej postawy T-Pose w naturalną, spoczynkową pozycję wzdłuż ciała
 */
export function relaxArmsToNaturalPose(root: THREE.Object3D): void {
  const leftArm = root.getObjectByName('LeftArm');
  const rightArm = root.getObjectByName('RightArm');
  const leftForeArm = root.getObjectByName('LeftForeArm');
  const rightForeArm = root.getObjectByName('RightForeArm');

  if (leftArm) {
    // Obrót ramienia w dół wzdłuż tułowia (~68° opuszczenie ramion do naturalnej pozycji A-pose)
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

