# 1. Architektura 3D: Decyzja, Abstrakcje, Modele

## 📌 Decyzja 3D — macierz opcji (realizm vs wysiłek)

Wymaganie: **realistyczny wygląd** + elastyczność technologiczna. Opcje, które rozważaliśmy:

| Opcja | Realizm | Wysiłek | Infrastruktura | Opóźnienie interakcji | Werdykt |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **MetaPerson (Avatar SDK) → GLB + Three.js** | wysoki (tekstury skóry, PBR-ready) | niski (eksport z kreatora) | statyczne pliki na CDN | render lokalny — minimalne | ✅ **Domyślny dla PoC/MVP** |
| HeyGen LiveAvatar + ElevenAgents (oficjalny guide ElevenLabs) | bardzo wysoki (wideo czasu rzeczywistego) | niski | streaming wideo per sesja | zależny od streamu | 🟡 Opcja "bez silnika 3D"; droga per minuta; brak pełnej kontroli nad mimiką proceduralną |
| MetaHuman + Unreal Pixel Streaming | najwyższy | wysoki (Unreal, wypiekanie, RigLogic) | serwery GPU per sesja | 50–150 ms stream | 🔵 Faza 2, jeśli biznes wymaga fotorealizmu premium |
| Własny model Blender + ARKit blendshapes | dowolny | bardzo wysoki (rigging FACS) | brak | render lokalny | 🟡 Tylko jeśli potrzebna unikalna postać/licencja |
| Ready Player Me | — | — | — | — | ❌ Zamknięte (projekt wygaszony) |

**Rekomendacja:** MetaPerson + Three.js dla PoC/MVP. Renderer i dostawca modelu są **za adapterami** (poniżej), więc zamiana na inną opcję z macierzy nie dotyka logiki konwersacji ani lip-syncu.

---

## 🧩 Warstwy abstrakcji (elastyczność technologiczna)

Rdzeń projektu (konwersacja, lip-sync, przerwania) nie może zależeć od Three.js ani ElevenAgents. Definiujemy trzy interfejsy:

```typescript
// Źródło mowy — implementacje: ElevenAgentsWs, (Faza 2) ElevenTtsWs + własny STT/LLM
interface SpeechBackend {
  start(): Promise<void>;
  stop(): Promise<void>;
  onAudioChunk: (pcm: ArrayBuffer, alignment: CharAlignment, epoch: number) => void;
  onInterruption: (reason: string) => void;
  onUserTranscript: (text: string) => void;
  onStateChange: (s: 'listening' | 'speaking' | 'thinking' | 'idle') => void;
}

// Sterownik mimiki — implementacje: ArKitBlendshapeDriver (Three.js), (alt) BabylonDriver
interface FaceDriver {
  // mapowanie z [docs/3] — jedyna funkcja, którą zna scheduler wizemów
  applyTargets(weights: Record<string, number>): void;
  listAvailableShapes(): string[]; // walidacja przy ładowaniu
  relaxToNeutral(durationMs: number): void;
}

// Dostawca modelu — implementacje: MetaPersonGlb, (alt) CustomGlb, (alt) VideoAvatarStream
interface AvatarLoader {
  load(url: string, scene: unknown): Promise<{ faceDriver: FaceDriver; root: unknown }>;
}
```

**Kontrakt:** scheduler wizemów ([docs/3](3-lip-sync-i-koartykulacja.md)) produkuje `Record<arKitShape, weight>`; `FaceDriver` aplikuje. Wymiana renderera = nowa implementacja `FaceDriver`. Wymiana backendu = nowa implementacja `SpeechBackend`. Reszta kodu bez zmian.

---

## 🦴 Struktura modelu MetaPerson: Rig i Blendshapes

Modele MetaPerson spełniają dwa standardy branżowe:

### 1. Szkielet zgodny z Mixamo
* Standardowa hierarchia kości (Hips, Spine, Neck, Head, LeftArm...).
* W Fazie 2 pozwala podpiąć animacje ciała (idle, gesty) z plików `.fbx`/`.glb` bez retargetingu.

### 2. Standard ARKit (52 klucze kształtu / Blendshapes)
Siatka głowy zawiera 52 klucze FACS zgodne z Apple ARKit. Kluczowe morph targety:

| Kategoria | Klucze ARKit (przykłady) | Zastosowanie |
| :--- | :--- | :--- |
| **Szczęka / Usta (mowa)** | `jawOpen`, `mouthClose`, `mouthFunnel`, `mouthPucker` | Samogłoski i spółgłoski — rdzeń lip-syncu |
| **Wargi i Kąciki** | `mouthSmileLeft/Right`, `mouthFrownLeft/Right`, `mouthRollLower/Upper`, `mouthPressLeft/Right` | Spółgłoski wargowe (M, B, P, F, V) i ekspresja |
| **Oczy i Powieki** | `eyeBlinkLeft/Right`, `eyeWideLeft/Right`, `eyeLookIn/Out...` | Proceduralne mruganie, sakkady |
| **Brwi i Czoło** | `browDownLeft/Right`, `browInnerUp`, `browOuterUpLeft/Right` | Emocje, akcentowanie mowy |
| **Policzki / Nos** | `cheekPuff`, `cheekSquint...`, `noseSneer...` | Dodatkowe wizemy (faza 2) |

---

## 💻 Implementacja w Three.js: ładowanie GLB

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
    // KTX2/meshopt: jeśli eksport używa kompresji Basis (zalecane dla VRAM)
    // const ktx2 = new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer);
    // this.loader.setKTX2Loader(ktx2);
    // this.loader.setMeshoptDecoder(MeshoptDecoder);
  }

  load(url, scene) {
    return new Promise((resolve, reject) => {
      this.loader.load(url, (gltf) => {
        const avatar = gltf.scene;
        scene.add(avatar);

        const speechMeshes = [];   // siatki z kluczami mowy (skóra, zęby, język, wnętrze ust)
        let morphDict = null;

        avatar.traverse((child) => {
          if (child.isSkinnedMesh && child.morphTargetDictionary
              && 'jawOpen' in child.morphTargetDictionary) {
            speechMeshes.push(child);
            if (!morphDict) morphDict = child.morphTargetDictionary;
          }
        });

        // Fail-fast: bez kluczy mowy lips-sync nie zadziała — lepiej krzyk niż cicha degradacja
        const missing = REQUIRED_SHAPES.filter((s) => !(s in (morphDict || {})));
        if (missing.length) {
          reject(new Error(`Model nie posiada blendshape'ów: ${missing.join(', ')}`));
          return;
        }

        resolve({ avatar, speechMeshes, morphDict });
      }, undefined, reject);
    });
  }
}
```

---

## ⚠️ Najważniejsze zasady implementacji

1. **Weryfikacja nazewnictwa kluczy**: eksport musi mieć dokładne nazwy `camelCase` ARKit (`jawOpen`, nie `Jaw_Open` ani `viseme_aa`). Jeśli eksporter produkuje warianty — normalizuj nazwy przy ładowaniu (mapa aliasów), ale zachowaj log oryginałów.
2. **Synchronizacja sub-meshy aparatu mowy**: skóra, zęby i język często mają **własne** kopie morph targetów (`jawOpen` na każdym). `FaceDriver.applyTargets()` musi pisać tę samą wagę do wszystkich siatek mowy — inaczej zęby "wystają" przy otwartych ustach.
3. **Frustum culling**: morph targety potrafią wysunąć geometrię poza bounding sphere. Ustaw `mesh.frustumCulled = false` dla siatek głowy lub zaktualizuj `boundingSphere` po pierwszej klatce animacji.
4. **Budżet zasobów**: `.glb` ≤ 25 MB (PoC), tekstury ≤ 2K, preferuj kompresję KTX2/Basis (mniejsze VRAM niż PNG) i meshopt dla geometrii. Głowa/bust dla PoC — pełne ciało dopiero w MVP, jeśli w ogóle.
5. **Materiały po eksporcie**: MetaPerson eksportuje PBR-ready materiały (albedo/normal/roughness). Konfiguracja realizmu (SSS, sheen, oświetlenie) — w [docs/5](5-shadery-i-realizm.md).
6. **Oczy**: rogówka i tęczówka zwykle osobne siatki z własnym shaderem/blikiem. Sprawdź w eksportorze opcje "eye parallax/reflection" — realistyczny wzrok to drugi najważniejszy czynnik odbioru realizmu po skórze.