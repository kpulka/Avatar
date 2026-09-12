import * as THREE from 'three';
import { LoadedAvatar } from '../types/avatar';
import { ArKitBlendshapeDriver } from './face-driver';

/**
 * Wszystkie 52 blendshape'y Apple ARKit
 */
export const ARKIT_52_SHAPES = [
  'eyeBlinkLeft', 'eyeLookDownLeft', 'eyeLookInLeft', 'eyeLookOutLeft', 'eyeLookUpLeft', 'eyeSquintLeft', 'eyeWideLeft',
  'eyeBlinkRight', 'eyeLookDownRight', 'eyeLookInRight', 'eyeLookOutRight', 'eyeLookUpRight', 'eyeSquintRight', 'eyeWideRight',
  'jawForward', 'jawLeft', 'jawRight', 'jawOpen',
  'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthLeft', 'mouthRight',
  'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight',
  'mouthDimpleLeft', 'mouthDimpleRight', 'mouthStretchLeft', 'mouthStretchRight',
  'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper',
  'mouthPressLeft', 'mouthPressRight', 'mouthLowerDownLeft', 'mouthLowerDownRight',
  'mouthUpperUpLeft', 'mouthUpperUpRight',
  'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
  'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight',
  'noseSneerLeft', 'noseSneerRight', 'tongueOut'
];

/**
 * Generuje realistyczną teksturę ludzkiej gałki ocznej (twardówka, tęczówka, źrenica, blik)
 */
function createEyeballTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 1. Twardówka (sclera) z miękkim cieniowaniem
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 512, 256);

    const cx = 256;
    const cy = 128;
    const irisRadius = 62;
    const pupilRadius = 24;

    // 2. Ciemny rąbek rogówki (limbal ring)
    const gradLimbal = ctx.createRadialGradient(cx, cy, irisRadius - 6, cx, cy, irisRadius + 2);
    gradLimbal.addColorStop(0, '#0f172a');
    gradLimbal.addColorStop(1, '#f8fafc');
    ctx.fillStyle = gradLimbal;
    ctx.beginPath();
    ctx.arc(cx, cy, irisRadius + 2, 0, Math.PI * 2);
    ctx.fill();

    // 3. Tęczówka (głęboki szafirowy błękit z promienistym gradientem)
    const gradIris = ctx.createRadialGradient(cx, cy, pupilRadius, cx, cy, irisRadius);
    gradIris.addColorStop(0, '#0284c7');
    gradIris.addColorStop(0.4, '#0369a1');
    gradIris.addColorStop(0.8, '#0c4a6e');
    gradIris.addColorStop(1, '#082f49');
    ctx.fillStyle = gradIris;
    ctx.beginPath();
    ctx.arc(cx, cy, irisRadius, 0, Math.PI * 2);
    ctx.fill();

    // Włókna tęczówki
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.2;
    for (let a = 0; a < Math.PI * 2; a += 0.12) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (pupilRadius + 2), cy + Math.sin(a) * (pupilRadius + 2));
      ctx.lineTo(cx + Math.cos(a) * (irisRadius - 3), cy + Math.sin(a) * (irisRadius - 3));
      ctx.stroke();
    }

    // 4. Źrenica (głęboka czerń)
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.arc(cx, cy, pupilRadius, 0, Math.PI * 2);
    ctx.fill();

    // 5. Optyczny blik światła (rogówka)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(cx - 14, cy - 14, 7, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  } catch {
    return null;
  }
}

/**
 * Tworzy kompletny model awatara z popiersiem (głowa, szyja, ramiona),
 * wszystkimi 52 blendshape'ami ARKit oraz w pełni animowalnymi oczami.
 */
export function createTestAvatar(): LoadedAvatar {
  const root = new THREE.Group();
  root.name = 'ProceduralMetaPersonAvatar';

  // 1. Siatka Głowy / Twarzy (Head Skinned Mesh)
  const headGeo = new THREE.SphereGeometry(0.22, 48, 48);
  headGeo.scale(1.0, 1.25, 1.05); // anatomiczny kształt głowy

  const posAttr = headGeo.attributes.position;
  const vertexCount = posAttr.count;

  // Tworzymy morph targets dla wszystkich 52 kształtów ARKit
  const morphDict: Record<string, number> = {};
  const morphTargets: THREE.BufferAttribute[] = [];

  ARKIT_52_SHAPES.forEach((shapeName, index) => {
    morphDict[shapeName] = index;

    const morphPositions = new Float32Array(vertexCount * 3);

    for (let i = 0; i < vertexCount; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);

      let dx = 0;
      let dy = 0;
      let dz = 0;

      // Deformacje dla kluczowych stref twarzy
      const isMouthArea = y < -0.04 && y > -0.16 && z > 0.08;
      const isLeftEyeArea = y > 0.03 && y < 0.11 && x < -0.04 && z > 0.12;
      const isRightEyeArea = y > 0.03 && y < 0.11 && x > 0.04 && z > 0.12;

      if (shapeName === 'jawOpen') {
        if (y < -0.05) {
          dy = -0.08 * Math.abs((y + 0.05) / 0.2);
          dz = -0.01;
        }
      } else if (shapeName === 'mouthClose') {
        if (isMouthArea) {
          dy = (y < -0.1 ? 0.03 : -0.03);
          dz = 0.01;
        }
      } else if (shapeName === 'mouthFunnel') {
        if (isMouthArea) {
          dz = 0.04;
          dx = -x * 0.3;
        }
      } else if (shapeName === 'mouthPucker') {
        if (isMouthArea) {
          dz = 0.05;
          dx = -x * 0.5;
        }
      } else if (shapeName === 'mouthSmileLeft') {
        if (isMouthArea && x < 0) {
          dy = 0.035;
          dx = -0.025;
        }
      } else if (shapeName === 'mouthSmileRight') {
        if (isMouthArea && x > 0) {
          dy = 0.035;
          dx = 0.025;
        }
      } else if (shapeName === 'eyeBlinkLeft') {
        if (isLeftEyeArea) {
          dy = -0.035;
          dz = 0.005;
        }
      } else if (shapeName === 'eyeBlinkRight') {
        if (isRightEyeArea) {
          dy = -0.035;
          dz = 0.005;
        }
      }

      morphPositions[i * 3] = dx;
      morphPositions[i * 3 + 1] = dy;
      morphPositions[i * 3 + 2] = dz;
    }

    morphTargets.push(new THREE.BufferAttribute(morphPositions, 3));
  });

  headGeo.morphAttributes.position = morphTargets;

  // Materiał skóry (PBR zgodny z docs/5)
  const skinMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xdcb097),
    roughness: 0.52,
    metalness: 0.0,
    sheen: 0.35,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color('#ffd6c2'),
    clearcoat: 0.08,
    clearcoatRoughness: 0.4,
  });

  const headMesh = new THREE.Mesh(headGeo, skinMaterial);
  headMesh.name = 'Avatar_Head_Skin';
  headMesh.morphTargetDictionary = { ...morphDict };
  headMesh.morphTargetInfluences = new Array(ARKIT_52_SHAPES.length).fill(0);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headMesh.frustumCulled = false;
  root.add(headMesh);

  // 2. Sub-mesh: Zęby (Teeth Mesh z synchronizowanym jawOpen)
  const teethGeo = new THREE.BoxGeometry(0.08, 0.02, 0.02);
  const teethPos = teethGeo.attributes.position;
  const teethMorph: THREE.BufferAttribute[] = [];
  const teethDict: Record<string, number> = { jawOpen: 0, mouthClose: 1 };

  const teethMorphJaw = new Float32Array(teethPos.count * 3);
  for (let i = 0; i < teethPos.count; i++) {
    teethMorphJaw[i * 3 + 1] = -0.04;
  }
  teethMorph.push(new THREE.BufferAttribute(teethMorphJaw, 3));

  const teethMorphClose = new Float32Array(teethPos.count * 3);
  teethMorph.push(new THREE.BufferAttribute(teethMorphClose, 3));

  teethGeo.morphAttributes.position = teethMorph;

  const teethMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xf5f5f0,
    roughness: 0.2,
    clearcoat: 0.3,
  });

  const teethMesh = new THREE.Mesh(teethGeo, teethMaterial);
  teethMesh.name = 'Avatar_Teeth_Submesh';
  teethMesh.position.set(0, -0.1, 0.16);
  teethMesh.morphTargetDictionary = teethDict;
  teethMesh.morphTargetInfluences = [0, 0];
  teethMesh.frustumCulled = false;
  root.add(teethMesh);

  // 3. Sub-mesh: Oczy z realistyczną twardówką i źrenicą
  const eyeTexture = createEyeballTexture();
  const eyeGeo = new THREE.SphereGeometry(0.024, 32, 32);
  const eyeMat = new THREE.MeshPhysicalMaterial({
    map: eyeTexture ?? undefined,
    color: eyeTexture ? 0xffffff : 0x2b4c7e,
    roughness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    ior: 1.376,
  });

  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.name = 'Avatar_LeftEye';
  leftEye.position.set(-0.065, 0.055, 0.18);
  leftEye.rotation.y = -Math.PI / 2; // skierowanie źrenicy do przodu w stronę kamery
  root.add(leftEye);

  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.name = 'Avatar_RightEye';
  rightEye.position.set(0.065, 0.055, 0.18);
  rightEye.rotation.y = -Math.PI / 2;
  root.add(rightEye);

  // Zapisujemy referencje do obiektów oczu w userData, aby kontroler wzroku mógł nimi fizycznie obracać
  root.userData.leftEye = leftEye;
  root.userData.rightEye = rightEye;

  // 4. Szyja (Neck)
  const neckGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.22, 32);
  const neckMesh = new THREE.Mesh(neckGeo, skinMaterial);
  neckMesh.name = 'Avatar_Neck';
  neckMesh.position.set(0, -0.20, -0.01);
  neckMesh.receiveShadow = true;
  root.add(neckMesh);

  // 5. Popiersie / Ramiona (Torso / Shoulders)
  const torsoGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.35, 32);
  torsoGeo.scale(1.35, 1.0, 0.7); // anatomiczny owal ramion
  const shirtMaterial = new THREE.MeshStandardMaterial({
    color: 0x1e293b, // elegancki grafitowy garnitur/koszula
    roughness: 0.7,
    metalness: 0.05,
  });
  const torsoMesh = new THREE.Mesh(torsoGeo, shirtMaterial);
  torsoMesh.name = 'Avatar_Torso';
  torsoMesh.position.set(0, -0.44, -0.03);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  root.add(torsoMesh);

  root.userData.torso = torsoMesh;
  root.userData.head = headMesh;

  // Pozycja riga głowy na wysokości kamery (~1.45m)
  root.position.set(0, 1.45, 0);

  const speechMeshes = [headMesh, teethMesh];
  const faceDriver = new ArKitBlendshapeDriver(speechMeshes, morphDict);

  return {
    root,
    faceDriver,
    speechMeshes,
    morphTargetDictionary: morphDict,
  };
}
