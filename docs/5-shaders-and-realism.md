# 5. Shaders and Realistic Rendering in Three.js

## 📌 Why not NVIDIA DLSS 5 in WebGL?

NVIDIA's neural rendering technology requires native access to GPU drivers and libraries (RTX series, `nvngx_dlssnr.dll`) and C++ integration with Unreal/Unity-class engines. The browser sandbox (WebGL/WebGPU) has no access to them — and never will. In the browser we build realism with the classic toolkit: **PBR + good textures + studio lighting + tone mapping**, with a planned SSS upgrade for skin.

---

## 🎨 Skin realism strategy — in stages

### Stage 1 (PoC): stock `MeshPhysicalMaterial`

A quality ceiling without custom shaders. Skin = dielectric: `metalness: 0`, medium roughness, subtle sheen (a soft rim on the edges — the cheapest substitute for SSS), minimal clearcoat (sebum film):

```javascript
function skinMaterial(tex) { // tex: {map, normalMap, roughnessMap} from the MetaPerson GLB
  return new THREE.MeshPhysicalMaterial({
    map: tex.map,
    normalMap: tex.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: tex.roughnessMap,
    roughness: 0.52,
    metalness: 0.0,

    sheen: 0.35,                       // soft sheen on the skin edges
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color('#ffd6c2'),

    clearcoat: 0.08,                   // sebum/sweat film — mainly nose/forehead
    clearcoatRoughness: 0.4,
  });
}
```

> ⚠️ **Technical correction relative to the previous version of this document:** the `thickness`/`attenuationColor`/`attenuationDistance` parameters in Three.js work **only when `transmission > 0`** (transmitted light). Setting `transmission: 0` makes them dead — the previous "SSS without transmission" example did nothing real. Skin should also not use a large `transmission` (transparent skin = a wax-figure look): the correct SSS path in Three.js is **pre-integrated subsurface scattering** (below).

### Stage 2 (MVP): pre-integrated SSS (`onBeforeCompile`)

Simulating subsurface light scattering by modifying the diffuse lighting — the classic approximation by Penner (GDC "Pre-Integrated Skin Shading"):

1. **Wrap diffuse**: stretching the NdotL terminator → `(NdotL + w) / (1 + w)` (w ≈ 0.2–0.4) — light "wraps around" the terminator instead of cutting it off.
2. **Translucency term**: an additional contribution of light "shining through" the skin, visible at an angle: `pow(saturate(dot(V, -(L + N·distortion))), power) · scale` — strongest on the ears, nose and lips (thickness mask from a texture or vertex color).
3. The key hardness of the light depends on the angle of incidence (a pre-integrated profile for skin) — unlike stock PBR.

```javascript
material.onBeforeCompile = (shader) => {
  // ...fragment shader substitutions: wrap on lights_physical_fragment +
  // adding a translucent term driven by the uniforms {distortion, scale, power, thicknessMap}
};
material.customProgramCacheKey = () => 'skin-sss-v1'; // program cache!
```

Full reference example: the official Three.js demo `webgl_materials_subsurface_scattering` (technique: `onBeforeCompile` on a physical material). Our version: + a thickness mask (the normalized red channel of the albedo texture gives a decent approximation).

Always compare A/B (reference shots: ears/nose/lips against backlight) — SSS is subtle and easy to overdo.

---

## 💡 Studio lighting + environment

**The environment is mandatory** — without `scene.environment` the PBR skin looks flat regardless of the lights:

```javascript
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;   // key for natural light transitions
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Environment: RoomEnvironment (zero assets) or a 2K HDRI from Poly Haven
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// 3-point studio:
const key  = new THREE.DirectionalLight(0xfff2e0, 2.2); key.position.set(1.5, 2.0, 2.0);
const fill = new THREE.DirectionalLight(0xdbe9ff, 0.7); fill.position.set(-2.0, 1.0, 1.5);
const rim  = new THREE.DirectionalLight(0xffe8d6, 2.6); rim.position.set(0.0, 2.5, -2.5); // rim: accentuates the edges — where SSS should be visible
key.castShadow = true; // face = 1 receiving shadow; soft: shadow.radius
```

---

## 🔍 Textures and filtering

```javascript
function configureTextures(root, renderer) {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  root.traverse((child) => {
    if (!child.isMesh) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of mats)
      for (const prop of ['map', 'normalMap', 'roughnessMap']) {
        const tex = mat[prop];
        if (!tex) continue;
        tex.anisotropy = maxAniso;                     // pores/skin sharp at an angle
        tex.colorSpace = prop === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      }
  });
}
```

* **Compression**: prefer GLB with KTX2/Basis textures (VRAM ↓ 4–8× vs PNG). `KTX2Loader.detectSupport(renderer)` — see [docs/1](1-architecture-and-3d-models.md).
* **Skin normal maps**: an excessive normalScale = "plastic". With 2K textures start from 0.8.

---

## ⚙️ Performance budget (target: 60 FPS @ 1080p, GTX 1060/M1-class GPU)

| Lever | Setting | Rationale |
| :--- | :--- | :--- |
| Pixel ratio | `min(devicePixelRatio, 2)` | 4K DPR on laptops kills fill-rate |
| Shadows | 1 source, 1024² map, `PCFSoft` | the face needs one soft shadow |
| Postprocessing | PoC: none; MVP: max SSAO | every pass = a copy of the buffer |
| Materials | 1 material per body part, no `transmission` | transmission requires a separate render pass |
| Textures | KTX2, max 2K | VRAM and loading time |
| `frustumCulled = false` | head meshes only | see [docs/1](1-architecture-and-3d-models.md) — morph targets vs bounding sphere |

---

## 👁️ Detail realism (beyond skin — the biggest "unlocks" for perception)

1. **Eyes**: don't use an emissive "card" — a cornea with `clearcoat 1.0`, an iris with an albedo texture, a procedural reflection of the environment; gentle saccades (docs/6) bring the gaze to life more than any shader.
2. **Hair/brows/lashes**: alpha-cut cards (not alpha-blend — sorting artifacts); `material.alphaToCoverage = true` on MSAA.
3. **Teeth/mouth cavity**: a light `clearcoat 0.3` (moisture); don't leave the default material — "dry" teeth break realism at `jawOpen`.
4. **Tone mapping + lighting > shaders**: 80% of the perceived "realism" in WebGL comes from light and ACES, not SSS.

---

## 🎬 Scene presets (Phase 11)

Four presets switchable at runtime (`src/features/scene-presets.ts`, controller with a 280 ms tween):

| Preset | Background | Key | Fill | Rim | Ambient | Exposure | Pedestal | Framing |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `studio-dark` | `#0e1117` | 2.2 `#fff2e0` | 0.7 `#dbe9ff` | 2.6 `#ffe8d6` | 0.15 | 1.0 | on | bust (z=1.22) |
| `studio-soft` | gradient `#1a2233 → #0b0f17` | 1.8 `#fff6ea` | 1.1 | 1.4 | 0.25 | 1.05 | on | bust |
| `cinema` | `#05070c` + CSS vignette | 2.6 | 0.35 | 3.2 | 0.08 | 0.95 | off | bust |
| `light` | `#e8eef7` | 1.4 | 1.2 | 0.9 | 0.5 | 1.0 | off | bust |

Rules:
- **Zero new postprocessing passes** — the `cinema` vignette is a CSS overlay (`body[data-scene="cinema"]`); the 60 FPS budget stays intact.
- **Background gradient** = a cached `CanvasTexture` (sRGB) with `dispose()` of the previous one when it is swapped.
- **`prefers-reduced-motion: reduce`** → the preset is applied immediately (no crossfade).
- **Theme sync**: a change of theme suggests a preset (`light` / `studio-dark`) only when the user has not chosen a preset manually (`user.scenePresetManual`).
