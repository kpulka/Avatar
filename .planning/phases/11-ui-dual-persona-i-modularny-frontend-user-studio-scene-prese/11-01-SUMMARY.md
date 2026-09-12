---
phase: 11-ui-dual-persona-i-modularny-frontend-user-studio-scene-prese
plan: 01
subsystem: app-store-ui-mode-events
tags: [settings-store, migration, ui-mode, event-bus, legacy-bridge, gsd]

requires:
  - phase: 11-00
    provides: Plany i research fazy 11 (11-CONTEXT/RESEARCH/PATTERNS/UI-SPEC)
provides:
  - SettingsStore v1 (schemat, precedencja, locki, persistence, export/import)
  - Idempotentna migracja legacy localStorage → blob `avatar_settings_v1` z backupem
  - Legacy bridge write-through (mirror kluczy legacy dla hud.ts/settings-modal.ts)
  - UiMode (`?studio=1`, Ctrl+Shift+D, persystencja, body[data-mode])
  - TypedEventBus + disposables
affects:
  - src/main.ts
  - src/app/store/settings-schema.ts
  - src/app/store/migrate.ts
  - src/app/store/settings-store.ts
  - src/app/store/legacy-bridge.ts
  - src/app/ui-mode.ts
  - src/app/events.ts
  - tests/settings-store.test.ts
  - tests/ui-mode.test.ts
  - tests/events.test.ts
  - tests/helpers/memory-storage.ts

tech-stack:
  added: []
  patterns: [Single SettingsStore with precedence resolution, Legacy write-through mirror, Typed event bus with subscription snapshot]

key-files:
  created:
    - src/app/store/settings-schema.ts
    - src/app/store/migrate.ts
    - src/app/store/settings-store.ts
    - src/app/store/legacy-bridge.ts
    - src/app/ui-mode.ts
    - src/app/events.ts
    - tests/settings-store.test.ts
    - tests/ui-mode.test.ts
    - tests/events.test.ts
    - tests/helpers/memory-storage.ts
  modified:
    - src/main.ts

key-decisions:
  - "Precedencja getEffective: locked ? studio[k] ?? default : user[k] ?? studio[k] ?? default — test tabelaryczny każdej kombinacji"
  - "Migracja legacy tylko gdy blob avatar_settings_v1 nie istnieje; przed pierwszym zapisem kopia avatar_settings_backup_<epoch>; kalibracja v3 i wizemy v1 porównywane pole-po-polu w testach"
  - "Klucze legacy pozostają zapisywane write-through (legacy-bridge) do czasu usunięcia starych modułów w 11-04 — brak split-brain"
  - "micSensitivity usunięte ze schematu (martwe pole, UI-05)"
  - "validateSettings odrzuca __proto__/constructor/prototype; mapy na Object.create(null); limit 512 wpisów wizemów; a2fUrl tylko http/https"

patterns-established:
  - "Jeden store jako jedyna brama zapisu localStorage; adaptery legacy tylko w store/legacy-bridge"

requirements-completed:
  - UI-04
  - UI-05
  - UI-01

duration: 90min
completed: 2026-09-10
status: complete
---

# Phase 11: Plan 01 Summary

**Fundament modułowy fazy 11: SettingsStore (schemat v1, precedencja, locki, migracja, export/import), UiMode i TypedEventBus — bez zmian wizualnych; bootstrap w main.ts.**

## Accomplishments
- Utworzono `settings-schema.ts` (SettingsStateV1, DEFAULT_SETTINGS, validateSettings, clampVolume, isValidA2fUrl) — walidacja odrzuca prototype pollution, clampuje volume, ogranicza mapę wizemów do 512 wpisów, URL tylko http/https.
- Utworzono `migrate.ts` (migrateLegacy, LEGACY_KEYS): idempotentna migracja 8 kluczy legacy, backup `avatar_settings_backup_<epoch>`, uszkodzony JSON → default pola bez przerywania migracji; `avatar_settings_mic_sensitivity` świadomie ignorowany.
- Utworzono `settings-store.ts` (SettingsStore, StorageLike, BLOB_KEY): getEffective z precedencją, setUser no-op na zablokowanym kluczu, setStudio/setLock/subscribe, exportProfile/importProfile (round-trip, brak mutacji przy błędzie), reset.
- Utworzono `ui-mode.ts` (createUiMode: `?studio=1`, Ctrl+Shift+D ignorowany w polach edycji, persystencja `user.uiMode`, `body[data-mode]`) oraz `events.ts` (TypedEventBus z bezpiecznym emit, disposables).
- Utworzono `legacy-bridge.ts` (attachLegacyBridge): write-through mirror kluczy legacy dla starych hud.ts/settings-modal.ts (migracja etapowa; mirror usunięty w 11-04).
- Bootstrap w `main.ts`: store → migrate → legacy-bridge → ui-mode + attachShortcut — zero zmian wizualnych.
- Testy: `tests/settings-store.test.ts` (244 linie), `tests/ui-mode.test.ts` (116), `tests/events.test.ts` (78), wspólny fake `tests/helpers/memory-storage.ts`.
- UAT manualny (przełączanie trybu w dev, działanie starych suwaków przez mirror): pozostaje pending — do odhaczenia w 11-VERIFICATION.md.