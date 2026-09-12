---
phase: 11-ui-dual-persona-i-modularny-frontend-user-studio-scene-prese
plan: 06
subsystem: user-layer
tags: [user-ui, conversation-dock, captions, algorithm-switcher, mic-device, locks, a11y, gsd]

requires:
  - phase: 11-03
    provides: PanelRegistry, shared primitives
  - phase: 11-04
    provides: Panele studia, store-driven zapis
  - phase: 11-05
    provides: CompareController, AnimationSourceRegistry, LastTurnBuffer
provides:
  - Warstwa user: conversation-dock, status-pill, captions, algorithm-switcher, user-settings (src/ui/user/)
  - Wybór mikrofonu end-to-end (mic-capture deviceId + listDevices, speech-backend setInputDevice/listInputDevices)
  - Spięcie rdzenia compare w containerze (AppServices: compare/animationSources/lastTurn)
  - Stany błędów, a11y (aria-label, focus-visible, prefers-reduced-motion)
affects:
  - src/ui/user/conversation-dock.ts
  - src/ui/user/status-pill.ts
  - src/ui/user/captions.ts
  - src/ui/user/algorithm-switcher.ts
  - src/ui/user/user-settings.ts
  - src/audio/mic-capture.ts
  - src/audio/speech-backend.ts
  - src/app/app-types.ts
  - src/app/container.ts
  - index.html
  - src/style.css

tech-stack:
  added: []
  patterns: [User shell montowany w body[data-mode="user"], Komponenty czytają locki ze store, Zero innerHTML (textContent)]

key-files:
  created:
    - src/ui/user/conversation-dock.ts
    - src/ui/user/status-pill.ts
    - src/ui/user/captions.ts
    - src/ui/user/algorithm-switcher.ts
    - src/ui/user/user-settings.ts
    - tests/mic-capture-device.test.ts
  modified:
    - src/audio/mic-capture.ts
    - src/audio/speech-backend.ts
    - src/app/app-types.ts
    - src/app/container.ts
    - index.html
    - src/style.css

key-decisions:
  - "Dock: „Rozpocznij/Zakończ rozmowę", „Wycisz", „Przerwij" przez services.conversation, stan z voice:state; ikony z widocznymi etykietami, aria-label na kontrolkach icon-only"
  - "Locki (UI-05): zablokowane klucze disabled + ikona locka + tooltip; store.setUser pozostaje no-op"
  - "Wybór mic: store.micDeviceId → speechBackend.setInputDevice → getUserMedia z deviceId: { exact } — test mapowania opcji"
  - "Stary top-dock usunięty i zastąpiony warstwą user; porównywarka i rejestr źródeł dostępne w trybie user"
  - "Błąd połączenia: komunikat + „Spróbuj ponownie" → services.conversation.start()"

patterns-established:
  - "Brak window keydown poza src/app/ (grep = 0) i brak getElementById w src/ui/user — komponenty dostają host z zewnątrz"

requirements-completed:
  - UI-01
  - UI-02
  - UI-05

duration: 150min
completed: 2026-09-10
status: complete
---

# Phase 11: Plan 06 Summary

**Warstwa usera kompletna: dock rozmowy, status, captions, segment algorytmu z porównywarką A/B i ustawienia z respektowaniem locków + wybór mikrofonu end-to-end. Tryb user jest domyślnym widokiem produktu.**

## Accomplishments
- Utworzono `conversation-dock.ts` (3 przyciski z Copywriting Contract), `status-pill.ts` (Gotowy/Słucham…/Mówię…/Myślę… z kolorami semantycznymi), `captions.ts` (TY/AGENT z transcript:*, wrap do 3 linii z wygaszaniem starszych).
- Utworzono `algorithm-switcher.ts`: segment LIVE|A2F z AnimationSourceRegistry, „Porównaj A/B" (disabled bez tury + copy empty, spinner „A2F: przetwarzanie…" podczas predicting), tryb blind, chipsy A/B, obsługa partial z tooltipem.
- Utworzono `user-settings.ts`: głośność, wybór mikrofonu, motyw, preset sceny (placeholder do 11-07); zablokowane klucze disabled + lock icon + tooltip.
- Rozszerzono `mic-capture.ts` (deviceId → `audio: { deviceId: { exact } }`, listDevices filtrujący audioinput) i `speech-backend.ts` (setInputDevice, listInputDevices); `tests/mic-capture-device.test.ts` pokrywa mapowanie i filtr.
- Container: instancjonuje LastTurnBuffer + CompareController + AnimationSourceRegistry (AppServices rozszerzone o compare/animationSources/lastTurn), montuje komponenty usera, stan błędu połączenia z retry, subskrypcja store na zmianę micDeviceId.
- style.css/index.html: tokeny UI-SPEC, :focus-visible, prefers-reduced-motion; grepy czyste (0 keydown poza src/app, 0 getElementById w src/ui/user); `npm test` + `npm run build` zielone.
- UAT manualny (rozmowa, A/B, blind, wybór mic w dev): pending — 11-VERIFICATION.md.