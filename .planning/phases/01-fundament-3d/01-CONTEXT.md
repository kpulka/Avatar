---
phase: "01"
name: "Fundament 3D"
created: 2026-09-01
---

# Phase 1: Fundament 3D — Context

## Decisions

- **Stack**: Vite + TypeScript + Three.js (WebGL).
- **Abstrakcje**: Interfejsy `AvatarLoader`, `FaceDriver`, `SpeechBackend` z `docs/1-architektura-i-modele-3d.md`.
- **Loader**: `MetaPersonLoader` z `GLTFLoader`, `DRACOLoader` (`https://www.gstatic.com/draco/versioned/decoders/1.5.6/`), przygotowany pod KTX2.
- **Fail-fast walidacja**: `REQUIRED_SHAPES` (`jawOpen`, `mouthClose`, `mouthFunnel`, `mouthPucker`, `mouthSmileLeft`, `mouthSmileRight`, `eyeBlinkLeft`, `eyeBlinkRight`). W przypadku braków — natychmiastowy, czytelny błąd w UI/konsoli.
- **Synchronizacja sub-meshy**: Siatki aparatu mowy (skóra, zęby, język, wnętrze ust) są traktowane łącznie; ta sama waga trafia do wszystkich siatek posiadających dany klucz.
- **Frustum culling**: `mesh.frustumCulled = false` na wszystkich sub-meshy głowy.
- **Oświetlenie i renderer**: Three.js WebGLRenderer z `antialias: true`, `powerPreference: 'high-performance'`, `outputColorSpace = THREE.SRGBColorSpace`, `toneMapping = THREE.ACESFilmicToneMapping`, `toneMappingExposure = 1.0`, miękkie cienie PCFSoft, `RoomEnvironment` PMREM, 3-punktowe oświetlenie studyjne (key, fill, rim/kontr).
- **Materiały skóry (PoC Etap 1)**: `MeshPhysicalMaterial` z `sheen: 0.35`, `sheenRoughness: 0.55`, `sheenColor: #ffd6c2`, `clearcoat: 0.08`, `clearcoatRoughness: 0.4`, anizotropia tekstur na max capability GPU.
- **Wbudowany model testowy / Fallback**: Aby aplikacja była natychmiast uruchamialna i w pełni testowalna bez zewnętrznych zależności, system zawiera generator testowego riga z blendshape'ami ARKit oraz obsługę wgrywania pliku `.glb` przez przeciągnięcie (drag & drop), URL lub przycisk wyboru pliku.

## Discretion Areas

- Stylistyka HUD: minimalistyczny, ciemny motyw z telemetrią (FPS, klatki, czas ładowania, stan loadera, lista blendshape'ów).
- Kontroler kamery: `OrbitControls` z restrykcją kątów i odległości zoptymalizowany pod widok popiersia/twarzy.
- Wybór wbudowanego RoomEnvironment vs proceduralnego sky/studio.

## Deferred Ideas

- Pre-integrated SSS przez `onBeforeCompile` (przeniesione do Fazy 5 wg ROADMAP.md).
- Animacje całego ciała Mixamo (Faza 2 / backlog).
