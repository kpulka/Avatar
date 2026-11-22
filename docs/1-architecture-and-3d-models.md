# 1. 3D Architecture: Decision, Abstractions, Models

## 📌 3D decision — option matrix (realism vs effort)

Requirement: **realistic appearance** + technological flexibility. Options we considered:

| Option | Realism | Effort | Infrastructure | Interaction latency | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **MetaPerson (Avatar SDK) → GLB + Three.js** | high (skin textures, PBR-ready) | low (export from the creator) | static files on a CDN | local rendering — minimal | ✅ **Default for PoC/MVP** |
| HeyGen LiveAvatar + ElevenAgents (official ElevenLabs guide) | very high (real-time video) | low | video streaming per session | depends on the stream | 🟡 "No 3D engine" option; priced per minute; no full control over procedural facial expression |
| MetaHuman + Unreal Pixel Streaming | highest | high (Unreal, baking, RigLogic) | GPU servers per session | 50–150 ms stream | 🔵 Phase 2, if the business requires premium photorealism |
| Own Blender model + ARKit blendshapes | any | very high (FACS rigging) | none | local rendering | 🟡 Only if a unique character/license is needed |
| Ready Player Me | — | — | — | — | ❌ Closed (project discontinued) |

**Recommendation:** MetaPerson + Three.js for PoC/MVP. The renderer and the model provider sit **behind adapters** (below), so switching to another option from the matrix does not touch the conversation or lip-sync logic.

---

## 🧩 Abstraction layers (technological flexibility)

The core of the project (conversation, lip-sync, interruptions) must not depend on Three.js or ElevenAgents. We define three interfaces:

```typescript
// Speech source — implementations: ElevenAgentsWs, (Phase 2) ElevenTtsWs + own STT/LLM
interface SpeechBackend {
  start(): Promise<void>;
  stop(): Promise<void>;
  onAudioChunk: (pcm: ArrayBuffer, alignment: CharAlignment, epoch: number) => void;
  onInterruption: (reason: string) => void;
  onUserTranscript: (text: string) => void;
  onStateChange: (s: 'listening' | 'speaking' | 'thinking' | 'idle') => void;
}

// Facial expression driver — implementations: ArKitBlendshapeDriver (Three.js), (alt) BabylonDriver
interface FaceDriver {
  // mapping from [docs/3] — the only function the viseme scheduler knows
  applyTargets(weights: Record<string, number>): void;
  listAvailableShapes(): string[]; // validation on load
  relaxToNeutral(durationMs: number): void;
}

// Model provider — implementations: MetaPersonGlb, (alt) CustomGlb, (alt) VideoAvatarStream
interface AvatarLoader {
  load(url: string, scene: unknown): Promise<{ faceDriver: FaceDriver; root: unknown }>;
}
```

**Contract:** the viseme scheduler ([docs/3](3-lip-sync-and-coarticulation.md)) produces `Record<arKitShape, weight>`; `FaceDriver` applies it. Replacing the renderer = a new `FaceDriver` implementation. Replacing the backend = a new `SpeechBackend` implementation. The rest of the code stays unchanged.

---

## 🦴 MetaPerson model structure: Rig and Blendshapes

MetaPerson models meet two industry standards:

### 1. Mixamo-compatible skeleton
* Standard bone hierarchy (Hips, Spine, Neck, Head, LeftArm...).
* In Phase 2 it allows attaching body animations (idle, gestures) from `.fbx`/`.glb` files without retargeting.

### 2. ARKit standard (52 shape keys / Blendshapes)
The head mesh contains 52 FACS keys compatible with Apple ARKit. Key morph targets:

| Category | ARKit keys (examples) | Usage |
| :--- | :--- | :--- |
| **Jaw / Mouth (speech)** | `jawOpen`, `mouthClose`, `mouthFunnel`, `mouthPucker` | Vowels and consonants — the core of lip-sync |
| **Lips and Corners** | `mouthSmileLeft/Right`, `mouthFrownLeft/Right`, `mouthRollLower/Upper`, `mouthPressLeft/Right` | Labial consonants (M, B, P, F, V) and expression |
| **Eyes and Eyelids** | `eyeBlinkLeft/Right`, `eyeWideLeft/Right`, `eyeLookIn/Out...` | Procedural blinking, saccades |
| **Brows and Forehead** | `browDownLeft/Right`, `browInnerUp`, `browOuterUpLeft/Right` | Emotions, speech emphasis |
| **Cheeks / Nose** | `cheekPuff`, `cheekSquint...`, `noseSneer...` | Additional visemes (phase 2) |

---

## 💻 Implementation in Three.js: loading a GLB

```javascript
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const REQUIRED_SHAPES = ['jawOpen', 'mouthClose', 'mouthFunnel', 'mouthPucker',
  'mouthSmileLeft', 'mouthSmileRight', 'eyeBlinkLeft', 'eyeBlinkRight'];

export class MetaPersonLoader {
  constructor() {
    this.loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    this.loader.setDRACOLoader(draco);
    // KTX2/meshopt: if the export uses Basis compression (recommended for VRAM)
    // const ktx2 = new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer);
    // this.loader.setKTX2Loader(ktx2);
    // this.loader.setMeshoptDecoder(MeshoptDecoder);
  }

  load(url, scene) {
    return new Promise((resolve, reject) => {
      this.loader.load(url, (gltf) => {
        const avatar = gltf.scene;
        scene.add(avatar);

        const speechMeshes = [];   // meshes carrying speech keys (skin, teeth, tongue, mouth interior)
        let morphDict = null;

        avatar.traverse((child) => {
          if (child.isSkinnedMesh && child.morphTargetDictionary
              && 'jawOpen' in child.morphTargetDictionary) {
            speechMeshes.push(child);
            if (!morphDict) morphDict = child.morphTargetDictionary;
          }
        });

        // Fail fast: without speech keys lip-sync will not work; a loud error beats silent degradation
        const missing = REQUIRED_SHAPES.filter((s) => !(s in (morphDict || {})));
        if (missing.length) {
          reject(new Error(`Model is missing blendshapes: ${missing.join(', ')}`));
          return;
        }

        resolve({ avatar, speechMeshes, morphDict });
      }, undefined, reject);
    });
  }
}
```

---

## ⚠️ Key implementation rules

1. **Verify key naming**: the export must use the exact ARKit `camelCase` names (`jawOpen`, not `Jaw_Open` or `viseme_aa`). If the exporter produces variants — normalize the names on load (alias map), but keep a log of the originals.
2. **Synchronize the speech-apparatus sub-meshes**: skin, teeth and tongue often have **their own** copies of morph targets (`jawOpen` on each). `FaceDriver.applyTargets()` must write the same weight to all speech meshes — otherwise the teeth "stick out" when the mouth is open.
3. **Frustum culling**: morph targets can push geometry outside the bounding sphere. Set `mesh.frustumCulled = false` for head meshes or update `boundingSphere` after the first animation frame.
4. **Resource budget**: `.glb` ≤ 25 MB (PoC), textures ≤ 2K, prefer KTX2/Basis compression (less VRAM than PNG) and meshopt for geometry. Head/bust for PoC — full body only in the MVP, if at all.
5. **Materials after export**: MetaPerson exports PBR-ready materials (albedo/normal/roughness). Realism configuration (SSS, sheen, lighting) — in [docs/5](5-shaders-and-realism.md).
6. **Eyes**: the cornea and iris are usually separate meshes with their own shader/highlight. Check the "eye parallax/reflection" options in the exporter — realistic eyes are the second most important factor in perceived realism after skin.
