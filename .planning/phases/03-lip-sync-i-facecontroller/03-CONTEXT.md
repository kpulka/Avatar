---
phase: "03"
name: "Lip-Sync i FaceController"
created: 2026-09-01
---

# Phase 3: Lip-Sync i FaceController — Context

## Decisions

- **Jedyny właściciel twarzy**: Tylko `FaceController` pisze do `FaceDriver.applyWeight / applyTargets`. Eliminuje to konflikty pisarzy i drgania mimiki.
- **State Machine**: Stany `IDLE` -> `SPEAKING` -> `RELAXING` -> `IDLE` powiązane z epoce (`epoch`).
- **Tabela mapowań EN (z lookahead)**:
  - Sprawdzanie dwuznaków przed pojedynczymi znakami: `SH`, `CH`, `TH`, `PH`, `QU`, `WH`, `NG`.
  - Heurystyka dla `C`: przed `E/I/Y` -> jak `S`, inaczej jak `K`.
  - Spółgłoski wargowe `M`, `B`, `P`: priorytetowe pełne domknięcie `mouthClose: 1.0` (test kontrolny LIPS-02).
  - Samogłoski: `A`, `E`, `I`, `O`, `U` z dopasowaną aperturą żuchwy i zaokrągleniem warg.
- **Scheduler i koartykulacja**:
  - Cykl życia wizemu: Blend-In (30-40 ms cosine), Hold (czas znaku), Blend-Out (40-50 ms).
  - Additive blending z limitem `min(1.0, sum)`.
  - Exponential damping `alpha = 1 - exp(-lambda * dt)` (lambda ≈ 22 1/s) — wygładzanie niezależne od FPS.
  - Reguła fundamentu: klucze bez aktywnego wkładu naturalnie dążą do 0.
- **Proceduralne mruganie**: Mrugnięcia co 2.5–6 s (zamknięcie 80 ms / otwarcie 200 ms) aktywne zarówno w stanie IDLE, jak i w trakcie SPEAKING.
