import * as THREE from 'three';
import { FaceDriver } from '../types/avatar';
import { normalizeShapeName } from './shape-normalizer';

/**
 * ARKit facial expression driver for Three.js.
 * Responsible for direct weight synchronization to all speech sub-meshes
 * (e.g. skin, teeth, tongue, mouth interior).
 */
export class ArKitBlendshapeDriver implements FaceDriver {
  private readonly speechMeshes: THREE.Mesh[];
  private readonly masterMorphDict: Record<string, number>;
  private readonly availableShapes: string[];

  // Fast lookup map: normalizedShapeName -> Array<{ meshIndex, morphIndex }>
  private readonly shapeTargetMap: Map<string, Array<{ mesh: THREE.Mesh; morphIndex: number }>>;

  constructor(speechMeshes: THREE.Mesh[], masterMorphDict: Record<string, number>) {
    this.speechMeshes = speechMeshes;
    this.masterMorphDict = masterMorphDict;
    this.availableShapes = Object.keys(masterMorphDict);
    this.shapeTargetMap = new Map();

    this.buildTargetMap();
  }

  private buildTargetMap(): void {
    for (const mesh of this.speechMeshes) {
      if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) continue;

      for (const [rawName, morphIndex] of Object.entries(mesh.morphTargetDictionary)) {
        const normalized = normalizeShapeName(rawName);

        let targets = this.shapeTargetMap.get(normalized);
        if (!targets) {
          targets = [];
          this.shapeTargetMap.set(normalized, targets);
        }

        targets.push({ mesh, morphIndex });
      }
    }
  }

  public applyTargets(weights: Record<string, number>): void {
    for (const [rawShape, weight] of Object.entries(weights)) {
      this.applyWeight(rawShape, weight);
    }
  }

  public applyWeight(rawShape: string, weight: number): void {
    const normalized = normalizeShapeName(rawShape);
    const targets = this.shapeTargetMap.get(normalized);
    if (!targets) return;

    const clampedWeight = Math.max(0, Math.min(1, weight));

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      if (!target) continue; // i < targets.length
      const { mesh, morphIndex } = target;
      if (mesh.morphTargetInfluences) {
        mesh.morphTargetInfluences[morphIndex] = clampedWeight;
      }
    }
  }

  public listAvailableShapes(): string[] {
    return this.availableShapes;
  }

  public getSpeechMeshes(): THREE.Mesh[] {
    return this.speechMeshes;
  }

  public getMorphTargetDictionary(): Record<string, number> {
    return this.masterMorphDict;
  }
}
