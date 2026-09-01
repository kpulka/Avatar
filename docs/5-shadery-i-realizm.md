# 5. Shadery i Realizm Renderowania w Three.js

## 📌 Dlaczego nie NVIDIA DLSS 5 w WebGL?

Technologia neural renderingu NVIDII wymaga natywnego dostępu do sterowników i bibliotek GPU (serie RTX, `nvngx_dlssnr.dll`) oraz integracji C++ z silnikami klasy Unreal/Unity. Piaskownica przeglądarki (WebGL/WebGPU) nie ma do nich dostępu — i nie będzie miała. Realizm w przeglądarce budujemy klasycznym arsenałem: **PBR + dobre tekstury + oświetlenie studiem + tone mapping**, z docelowym upgrade'em SSS dla skóry.

---

## 🎨 Strategia realizmu skóry — etapami

### Etap 1 (PoC): stock `MeshPhysicalMaterial`

Sufit jakości bez custom shaderów. Skóra = dielektryk: `metalness: 0`, średnia chropowatość, subtelny sheen (miękki rim na skosach — najtańszy zamiennik SSS), minimalny clearcoat (film lipidowy):

```javascript
function skinMaterial(tex) { // tex: {map, normalMap, roughnessMap} z GLB MetaPerson
  return new THREE.MeshPhysicalMaterial({
    map: tex.map,
    normalMap: tex.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: tex.roughnessMap,
    roughness: 0.52,
    metalness: 0.0,

    sheen: 0.35,                       // miękki połysk krawędzi skóry
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color('#ffd6c2'),

    clearcoat: 0.08,                   // film sebum/potu — głównie nos/czoło
    clearcoatRoughness: 0.4,
  });
}
```

> ⚠️ **Korekta techniczna względem poprzedniej wersji dokumentu:** parametry `thickness`/`attenuationColor`/`attenuationDistance` w Three.js działają **tylko przy `transmission > 0`** (światło transmitowane). Ustawienie `transmission: 0` czyni je martwymi — poprzedni przykład "SSS bez transmission" niczego realnie nie robił. Skóra nie powinna też używać dużego `transmission` (przezroczysta skóra = woszek): prawidłową ścieżką SSS w Three.js jest **pre-integrated subsurface scattering** (niżej).

### Etap 2 (MVP): pre-integrated SSS (`onBeforeCompile`)

Symulacja rozproszenia podpowierzchniowego przez modyfikację oświetlenia diffuse — klasyczne przybliżenie Pennera (GDC "Pre-Integrated Skin Shading"):

1. **Wrap diffuse**: rozciągnięcie terminatora NdotL → `(NdotL + w) / (1 + w)` (w ≈ 0.2–0.4) — światło "oblewa" terminator zamiast go ścinać.
2. **Translucency term**: dodatkowy wkład światła "prześwieconego" przez skórę, widoczny pod kątem: `pow(saturate(dot(V, -(L + N·distortion))), power) · scale` — najmocniej na uszach, nosie, wargach (maska grubości z tekstury lub vertex color).
3. Kluczowa twardość światła zależna od kąta padania (profil pre-integrated dla skóry) — inaczej niż w stock PBR.

```javascript
material.onBeforeCompile = (shader) => {
  // ...podmiany fragmentShadera: wrap na lights_physical_fragment +
  // dodanie translucent termu sterowanego uniformami {distortion, scale, power, thicknessMap}
};
material.customProgramCacheKey = () => 'skin-sss-v1'; // pamięć cache programów!
```

Pełny referencyjny przykład: oficjalne demo Three.js `webgl_materials_subsurface_scattering` (technika: `onBeforeCompile` na materiale fizycznym). Nasza wersja: + maska grubości (znormalizowana czerwień tekstury albedo daje przyzwoitą aproksymację).

Zawsze porównujemy A/B (zrzuty referencyjne: uszy/nos/wargi pod kontr-światłem) — SSS jest subtelny i łatwo go "przesolić".

---

## 💡 Oświetlenie studiem + environment

**Środowisko jest obowiązkowe** — bez `scene.environment` PBR skóry wygląda płasko niezależnie od świateł:

```javascript
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;   // kluczowe dla naturalnych przejść świateł
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Environment: RoomEnvironment (zero zasobów) lub HDRI 2K z Poly Haven
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// 3-point studio:
const key  = new THREE.DirectionalLight(0xfff2e0, 2.2); key.position.set(1.5, 2.0, 2.0);
const fill = new THREE.DirectionalLight(0xdbe9ff, 0.7); fill.position.set(-2.0, 1.0, 1.5);
const rim  = new THREE.DirectionalLight(0xffe8d6, 2.6); rim.position.set(0.0, 2.5, -2.5); // kontr: akcentuje krawędzie — tam, gdzie SSS ma być widoczny
key.castShadow = true; // twarz = 1 odbierający cień; soft: shadow.radius
```

---

## 🔍 Tekstury i filtracja

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
        tex.anisotropy = maxAniso;                     // pory/skóra ostre pod kątem
        tex.colorSpace = prop === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      }
  });
}
```

* **Kompresja**: preferuj GLB z teksturami KTX2/Basis (VRAM ↓ 4–8× vs PNG). `KTX2Loader.detectSupport(renderer)` — patrz [docs/1](1-architektura-i-modele-3d.md).
* **Normal maps skóry**: nadmierne normalScale = "plastik". Przy 2K teksturach startuj od 0.8.

---

## ⚙️ Budżet wydajności (cel: 60 FPS @ 1080p, GPU klasy GTX 1060/M1)

| Dźwignia | Ustawienie | Uzasadnienie |
| :--- | :--- | :--- |
| Pixel ratio | `min(devicePixelRatio, 2)` | 4K DPR na laptopach zabija fill-rate |
| Cienie | 1 źródło, mapa 1024², `PCFSoft` | twarz potrzebuje jednego miękkiego cienia |
| Postprocessing | PoC: brak; MVP: maks. SSAO | każdy pass = kopia bufora |
| Materiały | 1 materiał na część ciała, bez `transmission` | transmission wymaga osobnego render passu |
| Tekstury | KTX2, max 2K | VRAM i czas ładowania |
| `frustumCulled = false` | tylko siatki głowy | patrz [docs/1](1-architektura-i-modele-3d.md) — morph targety vs bounding sphere |

---

## 👁️ Realizm detali (po skórze — największe "unlocki" odbioru)

1. **Oczy**: nie używaj emisyjnej "kartki" — rogówka z `clearcoat 1.0`, tęczówka z albedo teksturą, proceduralne odbicie środowiska; delikatne sakkady (docs/6) ożywiają spojrzenie bardziej niż jakikolwiek shader.
2. **Włosy/brwi/rzęsy**: kartony alpha-cut (nie alpha-blend — sortowanie artefaktów); `material.alphaToCoverage = true` na MSAA.
3. **Zęby/jama ustna**: lekki `clearcoat 0.3` (wilgotność); nie zostawiaj defaultowego materiału — "suche" zęby psują realizm przy `jawOpen`.
4. **Tone mapping + oświetlenie > shadery**: 80% odbioru "realistyczności" w WebGL to światło i ACES, nie SSS.