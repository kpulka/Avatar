---
phase: "06"
name: "Produktyzacja MVP"
created: 2026-09-01
---

# Phase 6: Produktyzacja MVP — Context

## Decisions

- **Architektura embedu (PROD-01)**:
  - Widget embedowalny z obsługą `postMessage` (`avatar:connect`, `avatar:disconnect`, `avatar:interrupt`, `avatar:set_agent`, `avatar:say`).
  - Parametry startowe przez URL query string: `agent_id`, `model_url`, `theme`, `autostart`.
  - Cache modeli 3D w `IndexedDB` eliminujący konieczność ponownego pobierania pliku `.glb` przy kolejnych wizytach użytkownika.
- **Konfigurator i bezpieczeństwo (PROD-02)**:
  - Panel ustawień konfiguracyjnych w HUD (edycja `agent_id`, wybór modelu z cache/demo/pliku, suwak czułości i głośności).
  - Klucze API prywatne nigdy nie trafiają na front-end (klient używa publicznych agentów lub signed conversation tokenów).
- **Odporność i Graceful Degradation (ROB-02)**:
  - Brak wsparcia WebGL: estetyczny fallback 2D zachowujący pełny potok audio, transkrypcję i responsywność.
  - Adaptacyjny prebuffer: automatyczne zwiększanie okna prebuffera w `AudioEngine` (80ms -> 180ms) przy wykryciu jittera sieciowego.
- **Kompletna telemetria w czasie rzeczywistym**:
  - Panel telemetryczny w HUD: FPS, Frame Time, TTFB pierwszego pakietu audio, liczba przerwanych wypowiedzi (barge-ins), czas trwania sesji i stan węzłów Web Audio.
