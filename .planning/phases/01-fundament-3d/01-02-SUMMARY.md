---
phase: 01-fundament-3d
plan: 02
subsystem: avatar-rig
tags: [gltfloader, draco, arkit, blendshapes, face-driver, fail-fast, normalization]

requires:
  - phase: 01-01
    provides: Three.js core renderer, camera and scene
provides:
  - MetaPersonLoader with GLTFLoader and DRACOLoader
  - Fail-fast REQUIRED_SHAPES validation with descriptive error reporting
  - Shape name normalizer supporting camelCase ARKit and common exporter aliases
  - ArKitBlendshapeDriver synchronizing weights across all speech sub-meshes
  - Automatic frustumCulled=false on all avatar head meshes
  - Procedural 52 ARKit blendshape test avatar generator for instant runtime verification
affects: [01-03, 03-01, 03-02]

tech-stack:
  added: [vitest]
  patterns: [Adapter pattern (FaceDriver/AvatarLoader), Fail-fast hardware/data verification, Sub-mesh synchronization]

key-files:
  created:
    - src/types/avatar.ts
    - src/avatar/shape-normalizer.ts
    - src/avatar/face-driver.ts
    - src/avatar/meta-person-loader.ts
    - src/avatar/test-avatar-generator.ts
    - tests/shape-normalizer.test.ts
    - tests/face-driver.test.ts
  modified:
    - src/main.ts
    - package.json

key-decisions:
  - "Zastosowanie fail-fast w assertRequiredShapes — brak któregokolwiek z 8 kluczowych kluczy mowy rzuca natychmiastowy, czytelny błąd"
  - "FaceDriver mapuje wagi do wielu sub-meshy równocześnie (skóra, zęby, język), zapobiegając rozchodzeniu się geometrii"
  - "Proceduralny generator riga 52 ARKit pozwala na pełny test i demo interaktywne bez zewnętrznego pliku GLB"

patterns-established:
  - "FaceDriver jako jedyny interfejs manipulujący wagami morphTargetInfluences w Three.js"
  - "Automatyczne testy jednostkowe Vitest weryfikujące logikę normalizacji i synchronizacji riga"

requirements-completed:
  - AVAT-01
  - AVAT-03

duration: 15min
completed: 2026-09-01
status: complete
---

# Phase 01: Plan 02 Summary

**Wdrożono loader modeli MetaPerson GLB z dekoderem DRACO, fail-fast walidacją 52 blendshape'ów ARKit, synchronizacją sub-meshy aparatu mowy i adapterem FaceDriver.**

## Accomplishments
- Zdefiniowano interfejsy `SpeechBackend`, `FaceDriver`, `AvatarLoader` w `src/types/avatar.ts`.
- Zaimplementowano moduł `shape-normalizer.ts` z listą `REQUIRED_SHAPES` i bezwzględną walidacją fail-fast.
- Stworzono `ArKitBlendshapeDriver` przekazujący wagi mowy symultanicznie do wszystkich sub-meshy (skóra, zęby).
- Zaimplementowano `MetaPersonLoader` z obsługą plików lokalnych (File / drag & drop) oraz URL.
- Dodano `createTestAvatar()` z 52 deformowalnymi blendshape'ami ARKit dla natychmiastowego demo i weryfikacji.
- Pokryto moduły testami jednostkowymi w Vitest (wszystkie 5 testów przechodzi pomyślnie).
