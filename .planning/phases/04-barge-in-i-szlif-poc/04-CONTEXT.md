---
phase: "04"
name: "Barge-in i szlif PoC"
created: 2026-09-01
---

# Phase 4: Barge-in i szlif PoC — Context

## Decisions

- **Deterministyczny potok przerwania**:
  1. Odebranie zdarzenia `interruption` z WebSocketu (lub kliknięcie przycisku Barge-in w UI).
  2. `AudioEngine.hardStop()`: inkrementacja `epoch++`, natychmiastowe `stop()` i `disconnect()` wszystkich aktywnych `AudioBufferSourceNode`, reset `tailTime = 0`.
  3. `FaceController.onInterruption()`: natychmiastowe wyczyszczenie kolejki wizemów, przejście do stanu `RELAXING` (płynny powrót do neutralu w 150 ms metodą cosine ease).
  4. Przełączenie stanu aplikacji w HUD na `SŁUCHAM...` (LISTENING).
- **Ochrona przed wyścigami sieciowymi (Race Conditions)**:
  Wszystkie chunki audio i wizemy są stemplowane numerem epoki (`epoch`). Pakiety spóźnione lub przychodzące z opóźnieniem sieciowym po zdarzeniu przerwania są cicho i natychmiast odrzucane.
- **Automatyczny PoC Test Harness**:
  Dedykowany runner testowy symulujący sekwencję 5 przerwanych wypowiedzi w zróżnicowanych momentach fonetycznych (w połowie samogłoski `A`, podczas domknięcia `M/B/P`, w trakcie narastania `blend-in`). Weryfikacja zerowych wycieków `AudioBufferSourceNode` oraz czystego powrotu mimiki do zera.
- **Bramka decyzyjna do MVP**:
  Formalna ocena kryteriów sukcesu PoC wg docs/0: latencja reakcji na przerwanie < 150 ms, brak desynchronizacji, brak trzasków audio, stabilne 60 FPS.
