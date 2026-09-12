import * as THREE from 'three';
import { FaceDriver } from '../types/avatar';
import { normalizeShapeName } from './shape-normalizer';

/**
 * Sterownik mimiki ARKit dla Three.js.
 * Odpowiada za bezpośrednią synchronizację wag do wszystkich sub-meshy mowy
 * (np. skóra, zęby, język, wnętrze ust).
 */
export class ArKitBlendshapeDriver implements FaceDriver {
  private readonly speechMeshes: THREE.Mesh[];
  private readonly masterMorphDict: Record<string, number>;
  private readonly availableShapes: string[];

  // Mapa szybkiego wyszukiwania: normalizedShapeName -> Array<{ meshIndex, morphIndex }>
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
      const { mesh, morphIndex } = targets[i];
      if (mesh.morphTargetInfluences) {
        mesh.morphTargetInfluences[morphIndex] = clampedWeight;
      }
    }
  }

  public listAvailableShapes(): string[] {
    return this.availableShapes;
  }

  public relaxToNeutral(durationMs = 150): void {
    if (durationMs <= 0) {
      // Natychmiastowe wyzerowanie
      for (const mesh of this.speechMeshes) {
        if (mesh.morphTargetInfluences) {
          mesh.morphTargetInfluences.fill(0);
        }
      }
      return;
    }

    // Płynne wygaszenie do 0 (pętla klatek lub interpolacja)
    const startTime = performance.now();
    const initialWeights: Map<THREE.Mesh, Float32Array> = new Map();

    for (const mesh of this.speechMeshes) {
      if (mesh.morphTargetInfluences) {
        initialWeights.set(mesh, new Float32Array(mesh.morphTargetInfluences));
      }
    }

    const step = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Cosine ease out
      const factor = 1 - Math.sin((progress * Math.PI) / 2);

      for (const mesh of this.speechMeshes) {
        const startValues = initialWeights.get(mesh);
        if (startValues && mesh.morphTargetInfluences) {
          for (let i = 0; i < mesh.morphTargetInfluences.length; i++) {
            mesh.morphTargetInfluences[i] = startValues[i] * factor;
          }
        }
      }

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }

  public getSpeechMeshes(): THREE.Mesh[] {
    return this.speechMeshes;
  }

  public getMorphTargetDictionary(): Record<string, number> {
    return this.masterMorphDict;
  }
}
