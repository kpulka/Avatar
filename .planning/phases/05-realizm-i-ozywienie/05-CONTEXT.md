---
phase: "05"
name: "Realizm i ożywienie"
created: 2026-09-01
---

# Phase 5: Realizm i ożywienie — Context

## Decisions

- **Mikroruchy głowy i oddech (REAL-01)**:
  - Szum harmoniczny (simplex/perlin) modulujący rotację głowy i szyi awatara w granicach yaw/pitch < 2° (0.035 rad) oraz roll < 1°.
  - Rytm oddechu: 0.25 Hz (1 cykl co ~4 s) ze zmienną amplitudą i subtelnym ruchem w osi pionowej.
- **Wzrok i sakady (REAL-02)**:
  - Śledzenie wskaźnika myszy / kamery: clampowane do 15° z dampingiem.
  - Sakady oczne: automatyczne mikro-skoki co 0.5–2 s (< 5°, czas 35–50 ms) eliminujące efekt "szklistych, nieruchomych oczu".
  - Współpraca: oczy kierują się pierwsze na cel, a głowa podąża z opóźnieniem (koordynacja oko-głowa).
- **Warstwa emocji i sentyment (REAL-03)**:
  - Analiza sentymentu wypowiedzi agenta (radość, neutralny, skupienie, zaskoczenie).
  - Warstwa bazowa emocji (uśmiech `mouthSmile`, brwi `browInnerUp`, `browDownLeft/Right`) miksowana z wizemami aparatu mowy bez zakłócania domknięcia `mouthClose`.
- **Shader skóry SSS (REAL-04)**:
  - Stage 2 wg `docs/5`: `MeshPhysicalMaterial.onBeforeCompile` z mechanizmem Wrap Lighting Diffuse (rozproszenie podpowierzchniowe) zmiękczającym cienie w strefach nosa, policzków i uszu.
  - Eye wetness: dedykowana wilgotność rogówki z `clearcoat: 1.0` i `roughness: 0.03`.
