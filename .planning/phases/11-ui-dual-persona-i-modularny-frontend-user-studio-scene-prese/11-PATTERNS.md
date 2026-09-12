# Phase 11: UI dual-persona i modularny frontend — Pattern Map

**Mapped:** 2026-09-10
**Files analyzed:** 43 (new/modified w 11-01..11-05)
**Analogs found:** 39 z bezpośrednim lub rolowym analogiem / 43 (4 bez dokładnego odpowiednika — patrz „No Analog Found")

> Zasada repo: **wszystkie komentarze modułów po polsku**, nazwy symboli po angielsku, importy względne
> (`../lipsync/calibration`), bez path aliasów. Klasy dla kontrolerów/stanu, funkcje dla czystych helperów.
> Testy: `import { describe, it, expect, vi } from 'vitest'` + import z `../src/...`; brak `vitest.config`.

> **Sync z PLAN.md (2026-09-10, po rewizji plan-checkera):** finalnie 7 planów (11-01..11-07) i doprecyzowane nazwy:
> `src/features/demo-controller.ts` → `animation-controller.ts`; `src/scene/presets.ts` → `src/features/scene-presets.ts`;
> `src/features/animation-source-registry.ts` → `src/lipsync/animation-sources.ts`; `panels/animation.ts` → `panels/animation-panel.ts`;
> `src/ui/shared/*` powstaje w 11-03; rdzeń porównywarki (`pcm-to-wav`, `last-turn-buffer`, `compare-controller`) w 11-05;
> user shell w 11-06; scene presets w 11-07. Mapa analogów pozostaje aktualna merytorycznie.

---

## File Classification

### 11-01 — SettingsStore + ui-mode + event bus

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/store/settings-schema.ts` | config | transform | `src/lipsync/calibration.ts` | exact (typy + defaults + presety + clamp) |
| `src/app/store/settings-store.ts` | store | CRUD (localStorage) | `src/prod/settings-modal.ts` + `src/lipsync/calibration.ts` | role-match (precedencja/locki są nowe; persistence exact) |
| `src/app/store/migrate.ts` | utility | transform | `src/audio/agent-config.ts` + `calibration.ts` (load) | role-match |
| `src/app/ui-mode.ts` | utility | request-response | `src/audio/agent-config.ts` | role-match (URL+storage precedencja) |
| `src/app/events.ts` | utility | pub-sub | `src/prod/embed-bridge.ts` (callback map) | partial (brak typowanego busa w repo) |
| `src/main.ts` (mod → bootstrap ≤ ~100 linii) | config/bootstrap | request-response | `src/main.ts` (obecny `initApp`) | exact (to jest źródło do wycięcia) |
| `tests/settings-store.test.ts` | test | — | `tests/calibration.test.ts` + `tests/settings-modal.test.ts` | exact |
| `tests/ui-mode.test.ts` | test | — | `tests/animation-router.test.ts` + fake storage | role-match |
| `tests/helpers/memory-storage.ts` | test helper | — | inline `mockStorage` z `tests/calibration.test.ts` | exact |

### 11-02 — Composition root + kontrolery z `main.ts`

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/container.ts` | provider / composition root | request-response | `src/main.ts` `initApp` (wiring) | exact (ekstrakcja) |
| `src/features/conversation-controller.ts` | controller | event-driven | callbacki `SpeechBackend` w `main.ts:226-267` + `speech-backend.ts` | role-match |
| `src/features/animation-controller.ts` | controller | event-driven | `main.ts` `onDemoA2fFrames`/`onAnimationSourceChange` | role-match |
| `src/features/demo-controller.ts` | controller | file-I/O + fetch | `main.ts:86-190` (schedule demo / tryRealA2fDemo) | exact |
| `src/features/telemetry-controller.ts` | controller | batch/transform | `src/prod/telemetry.ts` | role-match |
| `src/ui/shared/dom.ts` | utility | transform | wzorce `document.createElement` z `hud.ts` (chipsy) | role-match |
| `src/ui/shared/toast.ts` | component | request-response | `hud.ts` `showToast` | exact |
| `src/ui/shared/loader.ts` | component | request-response | `hud.ts` `showLoader/hideLoader` | exact |
| `src/ui/shared/modal.ts` | component | request-response | dialog wiring w `main.ts:484-500, 563-592` | role-match |

### 11-03 — Studio shell + panele z `hud.ts`

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/ui/studio/panel-registry.ts` | registry | pub-sub | `VISEME_GROUPS` (data table) + `HudCallbacks` (kontrakt) | partial (brak rejestru z mount/destroy) |
| `src/ui/studio/studio-shell.ts` | component | request-response | drawer toggles w `hud.ts:206-303` | role-match (tab-shell nowy) |
| `src/ui/studio/panels/animation.ts` | component | request-response | kalibrator w `hud.ts:289-420, 680-703` | exact |
| `src/ui/studio/panels/visemes.ts` | component | request-response | `hud.ts` `initVisemeEditor` (`709-870`) | exact |
| `src/ui/studio/panels/inspector.ts` | component | request-response | inspektor w `hud.ts:226-259, 422-477` | exact |
| `src/ui/studio/panels/a2f.ts` | component | request-response | `main.ts` `onDemoA2fFrames` + `hud.setA2fStats` | exact |
| `src/ui/studio/panels/session.ts` | component | request-response | `main.ts` settings + PoC stress + `hud.updateTelemetry` | role-match |
| `src/ui/studio/panels/scene.ts` | component | request-response | nowy kontroler presets + `lighting.ts`/`scene.ts` | partial |

### 11-04 — User layer + porównywarka

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/ui/user/conversation-dock.ts` | component | request-response | `hud.ts` `setVoiceButtonText`/`setMuteButtonText` + index.html dock | exact |
| `src/ui/user/algorithm-switcher.ts` | component | event-driven | `hud.ts:305-331` (select silnika/źródła) + chipsy `779-796` | role-match |
| `src/ui/user/captions.ts` | component | streaming (tekst) | `hud.ts` `setUserTranscript/setAgentTranscript` | exact |
| `src/ui/user/status-pill.ts` | component | request-response | `hud.ts` `setVoiceState` (`536-561`) | exact |
| `src/ui/user/user-settings.ts` | component | CRUD | `SettingsModal` + wiring `main.ts:563-592` | role-match |
| `src/features/compare-controller.ts` | controller | state machine + streaming | `face-controller.ts` (state/epoch) + `a2f-backend.ts` | partial (nowa kompozycja; maszyna stanu exact) |
| `src/audio/pcm-to-wav.ts` | utility | transform | `src/audio/pcm-resampler.ts` | role-match |

### 11-05 — Scene presets + szlif

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/features/scene-preset-controller.ts` | controller | transform (tween w update) | `lighting.ts` + `scene.ts` + `renderer.ts` + `environment.ts` (dispose) | partial (brak wzorca tween-kontrolera) |
| `src/features/animation-source-registry.ts` | registry | pub-sub | `src/lipsync/animation-router.ts` | partial |
| `src/scene/presets.ts` (dane presetów) | config | transform | `CALIBRATION_PRESETS` w `calibration.ts:35-71` | exact |
| `src/style.css` (mod: `[data-mode]`, winieta) | style | transform | `body.theme-light` / `body.presentation-mode` reguły (`style.css:681-690, 879-894`) | exact |
| `index.html` (mod → tylko shell) | shell | request-response | obecny `index.html` (struktura) | exact |
| `src/audio/mic-capture.ts` (mod: `deviceId?`) | service | streaming | sam plik (`mic-capture.ts:29-41`) | exact |
| `tests/panel-registry.test.ts` | test | — | `tests/animation-router.test.ts` | role-match |
| `tests/compare-controller.test.ts` | test | — | `tests/face-controller-state.test.ts` + `tests/audio-engine.test.ts` | role-match |
| `tests/scene-presets.test.ts` | test | — | `tests/lighting-materials.test.ts` (real THREE, bez WebGL) | role-match |
| `tests/pcm-to-wav.test.ts` | test | — | `tests/pcm-resampler.test.ts` (round-trip bajtów) | exact |

---

## Pattern Assignments

### 11-01 — SettingsStore

#### `src/app/store/settings-schema.ts` (config, transform)

**Analog:** `src/lipsync/calibration.ts`

**Kontrakt modułu** — typ + defaults + presety w JEDNYM pliku, bez klas (lines 5-29, 35-71):
```typescript
export interface CalibrationProfile {
  /** Mnożnik gustowy głębokości otwierania żuchwy (jawOpen) [0.5 - 1.3] */
  jawScale: number;
  /** Prędkość ... [8 - 35] */
  coarticulationSpeed: number;
  syncOffsetMs: number;
}
export const CALIBRATION_PRESETS: Record<CalibrationPresetName, CalibrationProfile> = { /* ... */ };
export const DEFAULT_CALIBRATION_PROFILE: CalibrationProfile = CALIBRATION_PRESETS.balanced;
```

**Wzorzec clampów** — clampy żyją w loaderze, nie w typie (lines 62-68):
```typescript
return {
  agentId: savedAgentId,
  theme: savedTheme,
  volume: Math.max(0, Math.min(1, savedVolume)),
  micSensitivity: Math.max(0.5, Math.min(2.0, savedMicSens)),
  a2fUrl: savedA2fUrl.trim() || DEFAULT_A2F_URL,
};
```

**Rules to respect:**
- Exportuj `SettingsStateV1`, `SettingsDefaults`, `DEFAULT_SETTINGS`, oraz czyste `clampSettings(raw): SettingsStateV1` (walidacja importu — ASVS V5: whitelist kluczy, `Object.create(null)` dla map wizemów, odrzucanie `__proto__/constructor/prototype`, limit wpisów 512).
- `micSensitivity` **nie występuje** w schemacie (UI-05). Schemat ma `schemaVersion: 1`.
- Sekcja `user.*`: `uiMode`, `volume`, `theme`, `scenePreset`, `animationSource`, `micDeviceId`; sekcja `studio.*`: `agentId`, `a2fUrl`, `lipSyncEngine`, `calibration`, `visemeOverrides`, `locks`.
- Plik czysty (bez DOM/localStorage) → testy w env `node`.

#### `src/app/store/settings-store.ts` (store, CRUD)

**Analog:** `src/prod/settings-modal.ts` (klasa + guard localStorage + try/catch) i `src/lipsync/calibration.ts` (merge defaults).

**Guard + odczyt odporny na błędy** (`settings-modal.ts:41-60`):
```typescript
if (typeof localStorage !== 'undefined') {
  try {
    const storedAgent = localStorage.getItem(STORAGE_KEYS.AGENT_ID);
    if (storedAgent) savedAgentId = storedAgent;
    // ...
  } catch {
    // Ignoruj błędy dostępu do localStorage
  }
}
```

**Zapis + callback po zmianie** (`settings-modal.ts:71-89`):
```typescript
public saveSettings(partial: Partial<AvatarSettings>): AvatarSettings {
  this.settings = { ...this.settings, ...partial };
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEYS.AGENT_ID, this.settings.agentId);
      // ...
    } catch { /* Ignoruj błędy zapisu do localStorage */ }
  }
  setActiveAgentId(this.settings.agentId);
  this.onSaveCallback?.(this.settings);
  return this.settings;
}
```

**Merge defaults przy odczycie JSON** (`calibration.ts:78-91`):
```typescript
const parsed = JSON.parse(stored) as Partial<CalibrationProfile>;
return { ...DEFAULT_CALIBRATION_PROFILE, ...parsed };
```

**Rules to respect:**
- Storage **wstrzykiwany**: `constructor(private storage: StorageLike = safeLocalStorage())` — `interface StorageLike { getItem(k): string|null; setItem(k,v): void; removeItem(k): void }`; testy w env `node` bez DOM (RESEARCH Pattern 3).
- API: `get/getEffective/setUser/setStudio/setLock/subscribe/export/import/reset`.
- Precedencja: `locked ? (studio[key] ?? default) : (user[key] ?? studio[key] ?? default)`; `setUser` = no-op gdy locked.
- Write-through do kluczy legacy w okresie etapowania (Pitfall 3): `avatar_lip_calibration_profile_v3`, `avatar_viseme_overrides_v1`, `avatar_lipsync_engine`, `avatar_anim_source`, `elevenlabs_agent_id`, `avatar_settings_theme/volume/a2f_url`. Mirror usuwany dopiero w 11-05.
- Blob: `avatar_settings_v1`; przed migracją zapisz `avatar_settings_backup_<ts>`.
- Nigdy `innerHTML`; komunikacja do UI przez `subscribe` (callback) → docelowo event bus.

#### `src/app/store/migrate.ts` (utility, transform)

**Analog:** `src/lipsync/calibration.ts` (load) + `src/audio/agent-config.ts`.

**Łańcuch precedencji URL → storage → memory** (`agent-config.ts:42-59`):
```typescript
export function getActiveAgentId(): string {
  if (typeof window !== 'undefined' && window.location) {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('agent_id');
    if (fromUrl && fromUrl.trim() !== '') return fromUrl.trim();
  }
  if (typeof localStorage !== 'undefined') {
    const fromStorage = localStorage.getItem('elevenlabs_agent_id');
    if (fromStorage && fromStorage.trim() !== '') return fromStorage.trim();
  }
  return memoryAgentId;
}
```

**Rules to respect:**
- Migracja czyta legacy **tylko gdy blob nie istnieje** (Pitfall 1). Test: „legacy calibration → store.calibration identyczne pole po polu".
- `mic_sensitivity` porzucone; reszta mapowana 1:1.
- Kolejność kluczy, brak rzucania wyjątków — każdy odczyt w `try/catch` z `console.warn('[SettingsMigrate] ...')`.

#### `src/app/ui-mode.ts` (utility, request-response)

**Analog:** `src/audio/agent-config.ts` (URL + storage) + guard klawiatury z `hud.ts:281-287`.

```typescript
// hud.ts:281-287 — wzorzec ignorowania klawiszy w polach formularzy
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'h' || e.key === 'H') {
    const activeTag = document.activeElement?.tagName.toLowerCase();
    if (activeTag === 'input' || activeTag === 'select' || activeTag === 'textarea') return;
    togglePresentation();
  }
});
```

**Rules to respect:**
- Wejścia wstrzykiwane (URL search string + storage), wyjście: `'user' | 'studio'` → zapis `user.uiMode` przez store; ustawia `document.body.dataset.mode`.
- `?studio=1` + Ctrl+Shift+D; persystencja; brak osobnego builda.
- Jeden globalny keydown w root (Pitfall 9): ignoruj `input/textarea/select/[contenteditable]`, Ctrl+Shift+D osobny od H/Esc.
- Czysta funkcja parsowania (bez `window`) → testy node.

#### `src/app/events.ts` (utility, pub-sub)

**Analog (partial):** `src/prod/embed-bridge.ts` (mapa callbacków) + callbacki jako pola `SpeechBackend`.

```typescript
// embed-bridge.ts:20-28, 51-53 — rejestr callbacków (do zastąpienia przez TypedEventBus)
private callbacks: EmbedBridgeCallbacks = {};
public setCallbacks(callbacks: EmbedBridgeCallbacks): void {
  this.callbacks = { ...this.callbacks, ...callbacks };
}
```

**Rules to respect:**
- Implementuj `TypedEventBus<E>` wg RESEARCH Pattern 2: `on<K>(type, h): Unsub`, `emit<K>(type, payload)` z **kopią seta przed iteracją**, `disposables(): { add(u), dispose() }`.
- Kontrakt: „kto `add`, ten `remove` w `destroy()`" (Pitfall 2). Globalne listenery (resize/keydown/dragover/drop/pointermove) rejestrowane raz w `container.ts` i sprzątane przez `dispose()`.
- Komponenty komunikują się wyłącznie przez bus — zero własnych `window.addEventListener` w modułach UI.

#### `src/main.ts` (modified — bootstrap)

**Analog:** obecny `src/main.ts:34-50` (start) i `:676` (DOMContentLoaded).

```typescript
function initApp(): void {
  if (!isWebGLAvailable()) { handleWebGLFailure(); return; }
  const canvas = document.getElementById('avatar-canvas') as HTMLCanvasElement;
  if (!canvas) { console.error('Nie znaleziono canvas elementu #avatar-canvas'); return; }
  // ...
}
window.addEventListener('DOMContentLoaded', initApp);
```

**Rules to respect:**
- `main.ts` ≤ ~100 linii: fail-fast WebGL + `new AppContainer({ canvas }).start()`.
- Resize (`main.ts:594-600`), pointermove (`:70-74`), pętla animacji (`:602-651`) przenoszą się do kontenera/kontrolerów.

#### Testy 11-01

**`tests/settings-store.test.ts`** — analog `tests/calibration.test.ts:12-30` (fake storage z `removeItem`):
```typescript
const mockStorage: Record<string, string> = {};
beforeEach(() => {
  for (const k in mockStorage) delete mockStorage[k];
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => mockStorage[k] ?? null,
    setItem: (k: string, v: string) => { mockStorage[k] = v; },
    removeItem: (k: string) => { delete mockStorage[k]; },
    clear: () => { for (const k in mockStorage) delete mockStorage[k]; },
  });
});
```
oraz `tests/settings-modal.test.ts:20-45` (round-trip: instancja → reload → wartości).

**`tests/helpers/memory-storage.ts`** — wydziel dokładnie powyższy blok (RESEARCH Wave 0), by `settings-store`, `ui-mode`, `compare` testy nie duplikowały.

**`tests/ui-mode.test.ts`** — analog `tests/animation-router.test.ts` (czyste wejście → wyjście, bez DOM):
```typescript
it('LIVE tura (WSS) → ZAWSZE wizemy, nawet gdy mode=frames', () => {
  expect(resolveAnimationSource({ mode: 'frames', liveTurn: true })).toBe('viseme');
});
```

---

### 11-02 — Kontrolery i shared UI

#### `src/app/container.ts` (provider / composition root)

**Analog:** `src/main.ts` `initApp` (całe okablowanie). Konstrukcja obiektów z zależnościami:
```typescript
const renderer = new AppRenderer({ canvas });
const camera = new AppCamera(canvas);
const scene = new AppScene();
const lighting = new StudioLighting();
lighting.addToScene(scene.instance);
const envManager = new EnvironmentManager(renderer.instance);
envManager.setupRoomEnvironment(scene.instance);
const audioEngine = new AudioEngine();
const speechBackend = new ElevenAgentsSpeechBackend(audioEngine);
```
(main.ts:48-63)

**Rules to respect:**
- Kolejność init z RESEARCH diagramu: renderer→camera→scene→lighting/env→audio→backend→FaceController (dopiero po loadzie awatara, `main.ts:192-196`)→UI.
- Pętla renderu (`main.ts:605-651`) wywołuje: `headMicro.update`, `camera.update`, `faceController.render(dt)`, `gazeSaccades`, `renderer.render`, telemetria; w 11-05 dodatkowo `scenePresetController.update(dt)`.
- Nadal **tylko `FaceController` pisze do `FaceDriver`** — kontener tylko przekazuje serwisy kontrolerom.

#### `src/features/conversation-controller.ts` (controller, event-driven)

**Analog:** pola-callbacki `SpeechBackend` (`speech-backend.ts:12-21`) + okablowanie `main.ts:226-267`.

```typescript
// speech-backend.ts:12-21 — kontrakt callbacków klasy backendu
public onAudioChunk: (pcm: ArrayBuffer, alignment: CharAlignment, epoch: number, scheduledStartTime?: number) => void = () => {};
public onInterruption: (reason: string) => void = () => {};
public onUserTranscript: (text: string) => void = () => {};
public onAgentResponse: (text: string) => void = () => {};
public onStateChange: (state: 'listening' | 'speaking' | 'thinking' | 'idle') => void = () => {};
```

```typescript
// main.ts:246-260 — tor LIVE: telemetria + FaceController.onAudioChunk
speechBackend.onAudioChunk = (_pcm, alignment, epoch, scheduledStartTime) => {
  telemetry.markFirstAudioChunk();
  telemetry.recordAlignmentChunk(alignment.source ?? 'elevenlabs');
  if (faceController) {
    const source = resolveAnimationSource({ mode: animMode, liveTurn: true });
    if (faceController.getAnimationMode() !== source) faceController.setAnimationMode(source);
    const startTime = typeof scheduledStartTime === 'number' ? scheduledStartTime : audioEngine.getTailTime();
    faceController.onAudioChunk(alignment, startTime, epoch);
  }
};
```

**Rules to respect:**
- Kontroler emituje na bus (`voice-state`, `transcript`, `audio-chunk`, `interruption`) — zero direct DOM.
- **11-04:** `onAudioChunk` z WSS musi natychmiast anulować compare replay (Pitfall 5) — emituj zdarzenie `audio-chunk` zanim wywołasz `faceController`.
- `triggerDemoSpeech` (demo bez klucza) zostaje w backendzie; kontroler tylko woła.
- Emituj też `mic-muted` / `running` (dock i embed-bridge konsumują — `main.ts:269-291`).

#### `src/features/animation-controller.ts` (controller, event-driven)

**Analog:** `main.ts:343-406` (demo A2F + zmiana źródła) i `face-controller.ts:115-125`.

```typescript
// main.ts:397-406 — zmiana źródła mid-turn NIE tnie twarzy
onAnimationSourceChange: (mode) => {
  animMode = mode;
  if (faceController) {
    faceController.setAnimationMode(mode, {
      deferToTurnEnd: faceController.getState() === 'SPEAKING',
    });
  }
  hud.showToast(`Źródło animacji: ...`, 'success');
},
```

```typescript
// face-controller.ts:115-125 — deferToTurnEnd: zapis do pendingMode; commit na granicy tury
public setAnimationMode(mode: AnimationMode, opts?: { deferToTurnEnd?: boolean }): void {
  if (mode === this.animationMode) { this.pendingMode = null; return; }
  if (opts?.deferToTurnEnd && this.state === 'SPEAKING') { this.pendingMode = mode; return; }
  this.applyModeImmediate(mode);
}
```

**Rules to respect:**
- Odczyt/zapis wyboru źródła i silnika **przez store** (`user.animationSource`, `studio.lipSyncEngine`) — nie `localStorage` w kontrolerze.
- Demo A2F: `hardStop()` → `onInterruption()` → `/predict` → `feedFrames(clip, baseSec, audioEngine.getEpoch())` (main.ts:356-364) — kolejność obowiązkowa (świeża epoka przed feedFrames).
- Kalibracja/viseme operations: `activeCalibration` i `faceController.setCalibrationProfile`, `applyVisemeOverridesRecord` — przez store adapter (11-03 deduplikacja).
- `onInterrupt` (barge-in) zostaje: `audioEngine.hardStop()` → `faceDriver.relaxToNeutral(150)` → `faceController.onInterruption()` (main.ts:413-422).

#### `src/features/demo-controller.ts` (controller, file-I/O + fetch)

**Analog:** `main.ts:86-190` — całość przenoszona prawie 1:1.

```typescript
async function tryRealA2fDemo(baseUrl: string): Promise<{ clip: FramesClip; baseSec: number; durationSec: number; predictMs: number } | null> {
  const cleanUrl = (baseUrl || '').trim();
  if (!cleanUrl) return null;
  try {
    const bytes = await fetchDemoVoiceBytes();
    if (!bytes) return null;
    const audio = await audioEngine.ctx.decodeAudioData(bytes.slice(0));
    if (audio.length === 0) return null;
    const wav = new Blob([bytes], { type: 'audio/wav' });
    const { parsed, predictMs } = await predictFrames(cleanUrl, wav, { timeoutMs: 20_000 });
    if (!parsed.clip.frames.length) return null;
    const baseSec = scheduleDecodedAudio(audio);
    return { clip: parsed.clip, baseSec, durationSec: audio.duration, predictMs };
  } catch (err) { return null; }
}
```
oraz `scheduleSyntheticSpeech`/`scheduleDecodedAudio` (`main.ts:88-128`) i `buildDemoFrames` (`demo-frames.ts:82-127`).

**Rules to respect:**
- Fallback chain: realny `/predict` → nagranie `public/demo/demo-speech.wav` → syntetyka (`main.ts:343-395`); każdy catch → `console.warn` + dalszy fallback, nigdy throw do UI.
- Int16 konwersja jak `main.ts:90-95` (`Math.floor(v * 0x7fff)`), `playChunk` zwraca `baseSec`.
- Telemetria + UI stats przez bus/`telemetryController.recordA2fRequest(...)`.

#### `src/features/telemetry-controller.ts` (controller, batch/transform)

**Analog:** `src/prod/telemetry.ts` (klasa `TelemetryManager` z getterami) + wywołania w pętli.

```typescript
// telemetry.ts:110-119 — raport dla UI
public getReport(): TelemetryReport {
  return { sessionDurationSec: this.getSessionDurationSec(), fps: this.currentFps,
           frameTimeMs: this.currentFrameTimeMs, ttfbMs: this.lastTtfbMs,
           bargeInCount: this.bargeInCount, jitterEvents: this.jitterEvents };
}
```
```typescript
// main.ts:641-648 — per-frame push do HUD
hud.updateFps(timestamp, deltaMs);
hud.setAudioNodesCount(audioEngine.getActiveNodesCount());
hud.updateTelemetry(telemetry.getReport().ttfbMs, telemetry.getReport().bargeInCount,
                    telemetry.getFormattedSessionDuration());
```

**Rules to respect:**
- Cienki wrapper: deleguje do `TelemetryManager` i publikuje na bus (throttling — nie emitować 60×/s co ramkę; np. 2 Hz albo przy zmianie).
- Brak formatowania tekstu w kontrolerze — formatują komponenty („-- ms" itd.).

#### `src/ui/shared/dom.ts` (utility, transform)

**Analog:** wzorce createElement z `hud.ts:779-796` (chipsy) — do wyciągnięcia jako `el(tag, attrs, children)`:
```typescript
const chip = document.createElement('button');
chip.type = 'button';
chip.className = 'viseme-chip';
if (v.key === selectedKey) chip.classList.add('active');
chip.textContent = v.label;              // textContent, NIGDY innerHTML z danymi
chip.title = v.key;
chip.addEventListener('click', () => selectViseme(v));
```

**Rules to respect:**
- `el()`, `on()` (zwracające `Unsub`), `listen()` z opcjami; `textContent` wyłącznie (XSS — Security Domain).
- Zero globalnych lookups (`document.getElementById`) — komponent dostaje `container`.

#### `src/ui/shared/toast.ts` / `loader.ts` / `modal.ts` (component)

**Analog:** `hud.ts:663-678` (toast z timeoutem i typem), `:647-655` (loader), dialog wiring `main.ts:484-500, 563-592`.

```typescript
// hud.ts:663-678
public showToast(message: string, type: 'error' | 'success' = 'error'): void {
  if (this.toastTimeout !== null) window.clearTimeout(this.toastTimeout);
  this.toastElement.textContent = message;
  this.toastElement.className = `toast ${type === 'success' ? 'toast-success' : ''}`;
  this.toastElement.classList.remove('hidden');
  this.toastTimeout = window.setTimeout(() => { /* hide */ }, 5000);
}
```

**Rules to respect:**
- Factory `mountToast(ctx): PanelHandle` (+ `destroy` czyści timeout) — RESEARCH Pattern 1; koniec z `this.toastElement` lookupami.
- Copy 1:1 z `## Copywriting Contract`; toast auto-hide 5 s, błąd połączenia pozostaje do zamknięcia.
- Modal: `<dialog>` + `showModal()/close()` jak `main.ts:498`; focus/aria zgodnie z UI-SPEC.

---

### 11-03 — Studio shell i panele

#### `src/ui/studio/panel-registry.ts` (registry, pub-sub)

**Analog (partial):** tabela danych `VISEME_GROUPS` (`viseme-overrides.ts:138-141`) + kontrakt `HudCallbacks` (`hud.ts:79-105`).

```typescript
// viseme-overrides.ts — wzorzec „rejestr jako dane, UI czyta z tabeli”
export const VISEME_GROUPS = [
  { id: 'en', label: 'Silnik EN (fonemy G2P)', visemes: EN_VISEMES },
  { id: 'char', label: 'Ścieżka znaków (PL / fallback)', visemes: CHAR_VISEMES },
] as const;
```
```typescript
// hud.ts:79-105 — wzorzec kontraktu (wszystkie callbacki opcjonalne)
export interface HudCallbacks {
  onLoadDemo: () => void;
  onAnimationSourceChange?: (mode: AnimationMode) => void;
  onVisemeRecordChange?: (record: VisemeOverrideMap) => void;
}
```

**Rules to respect:**
- `PanelDefinition { id, title, icon, visibleIn: 'user'|'studio', lazy?, mount(ctx): PanelHandle }`; `PanelRegistry.register/list(mode)/mount(id, ctx)` — `mount` **idempotentny**: destroy poprzedniego handle przed ponownym mount (Pitfall 2).
- Przeniesienie funkcji między personami = zmiana `visibleIn` (UI-01).
- Per-panel boundary: `try { handle = def.mount(ctx) } catch { renderPanelError(container) }` — błąd jednego panelu nie zabija innych (UI-SPEC error).
- Rejestracja paneli w `container.ts`; `PanelContext = { store, events, services, container }`.

#### `src/ui/studio/studio-shell.ts` (component, request-response)

**Analog:** toggling drawerów w `hud.ts:206-246` + markup `index.html:125-563` + CSS `.side-drawer/.right-drawer/.left-drawer/.hidden` (`style.css:343-355`).

```typescript
if (btnCalibration && calibrationDrawer) {
  btnCalibration.addEventListener('click', () => {
    const isHidden = calibrationDrawer.classList.toggle('hidden');
    btnCalibration.classList.toggle('active', !isHidden);
  });
}
```

**Rules to respect:**
- Shell czyta `panelRegistry.list('studio')` i buduje taby (Drawer prawy z tabami: Animacja | A2F | Sesja | Scena); panele Wizemy/Inspektor lewe dla zgodności z obecnym UI (UI-SPEC „Visual Direction").
- Markup paneli budowany w modułach; `index.html` tylko shell (bez zmian prawdy markupu).
- Aktywny tab/panel **nie remountuje** przy każdym przełączeniu — lazy mount raz + hide (patrz Pitfall 2) albo konsekwentny destroy.

#### `src/ui/studio/panels/animation.ts` (component, request-response)

**Analog:** kalibrator `hud.ts:289-420` + `updateCalibrationSliders` (`680-703`).

```typescript
// hud.ts:356-375 — generyczny wiring suwaka (id, label, format)
const wireCalSlider = (sliderId: string, labelId: string, format: (val: number) => string, onChange: (val: number) => void) => {
  const slider = document.getElementById(sliderId) as HTMLInputElement | null;
  const label = document.getElementById(labelId);
  if (slider) slider.addEventListener('input', () => {
    const val = parseFloat(slider.value);
    if (label) label.textContent = format(val);
    onChange(val);
  });
};
```

**Rules to respect:**
- Suwaki budowane w panelu (nie `getElementById`) — pętla po konfiguracji `{id, key, min, max, format}`.
- Silnik lip-sync A/B i źródło animacji zostają w tym panelu (diagnoza: obecnie w kalibratorze — UI-SPEC mapa).
- `input` handler emituje `calibration-change`; zapis przez store (`studio.calibration`) zamiast `saveCalibrationProfile`.
- Presety (`subtle/balanced/expressive`) — `CALIBRATION_PRESETS` bez zmian.

#### `src/ui/studio/panels/visemes.ts` (component, request-response)

**Analog:** `hud.ts` `initVisemeEditor` (`709-870`) — przenoszony niemal 1:1, ze zmianą źródła danych na `ctx`.

```typescript
// hud.ts:804-847 — selectViseme: budowa suwaków + aktualizacja record + notify + preview
const selectViseme = (ref: { key: string; label: string }): void => {
  selectedKey = ref.key;
  renderChips();
  if (detailNameEl) detailNameEl.textContent = `${ref.key} — ${ref.label}`;
  if (stateEl) stateEl.textContent = record[ref.key] ? '⚙ nadpisana' : 'domyślna';
  slidersEl.innerHTML = '';   // JEDYNY dozwolony innerHTML: czyszczenie kontenera bez danych
  for (const control of SHAPE_CONTROLS) { /* input range + valueSpan */ }
  preview();
};
```

**Rules to respect:**
- `record: VisemeOverrideMap` source of truth → store (`studio.visemeOverrides`); reset-all zachowuje potwierdzenie destructive (UI-SPEC: „Reset wszystkich nadpisań wizemów: usunie zapisane zmiany. Kontynuować?").
- `notifyRecord()` → `events.emit('viseme-record-change', record)` — koniec `callbacks.onVisemeRecordChange`.
- Zachowaj `VISEME_GROUPS`/`SHAPE_CONTROLS`/`defaultVisemeShapes` 1:1 (bez zmian funkcjonalnych).

#### `src/ui/studio/panels/inspector.ts` (component, request-response)

**Analog:** `hud.ts:423-477` (sliders + mirror + reset).

```typescript
// hud.ts:428-442 — pary lustrzane bezpieczne do pracy symetrycznej
const MIRROR_BASES = ['eyeBlink', 'eyeSquint', 'eyeWide', /* ... */ 'mouthStretch'];
const isMirrorShape = (s: string): boolean => { /* Left/Right + base w MIRROR_BASES */ };
const mirrorCounterpart = (s: string): string =>
  s.endsWith('Left') ? s.replace(/Left$/, 'Right') : s.replace(/Right$/, 'Left');
```

**Rules to respect:**
- 51 blendshape'ów: wiersze budowane w panelu z `faceDriver.listAvailableShapes()` (przekazane w `services`) — obecnie statyczne w HTML.
- Symetria L/R i checkbox „mirror" bez zmian semantyki.
- `onMorphChange` → `animationController` → `faceController.setManualOverride` (zawsze przez FaceController).

#### `src/ui/studio/panels/a2f.ts` (component, request-response)

**Analog:** `main.ts:343-396` + `hud.setA2fStats` (`609-628`).

```typescript
// hud.ts:609-628 — formatowanie statystyk
const parts: string[] = [];
if (stats.source) parts.push(stats.source);
if (stats.predictMs !== undefined) parts.push(`${stats.predictMs} ms`);
if (stats.frames !== undefined) parts.push(`${stats.frames} ramek`);
if (stats.rtf !== undefined) parts.push(`RTF ${stats.rtf.toFixed(2)}`);
el.textContent = `A2F: ${parts.join(' · ')}`;
```

**Rules to respect:**
- URL wrappera + `/status` + demo frames + statystyki predict/RTF (mapa UI studio).
- `a2fUrl` edytowany przez store (`studio.a2fUrl`); walidacja URL http/https przy zapisie (ASVS V5).
- Błędy A2F pokazywane w panelu (nie toast globalny dla każdego pollingu).

#### `src/ui/studio/panels/session.ts` (component, request-response)

**Analog:** `main.ts:563-592` (agent ID/theme/volume modal) + `main.ts:424-454` (PoC stress) + `hud` telemetria.

```typescript
// main.ts:424-454 — sekwencja stress testu (3 frazy, 2 przerwania) — przenieść jako handler panelu
hud.setUserTranscript('Test obciążeniowy PoC');
speechBackend.triggerDemoSpeech('First phrase will be abruptly interrupted midway.');
await new Promise((r) => setTimeout(r, 600));
audioEngine.hardStop();
if (faceController) faceController.onInterruption();
```

**Rules to respect:**
- Zawartość: agent ID, mic/urządzenia, telemetria (TTFB/FPS/align/nodes/A2F), PoC stress.
- **Usuń `micSensitivity`** (dead setting, UI-05) — nie pojawia się w markupie ani w schemacie.
- `micDeviceId` (nowy) → store; `MicCapture` rozszerzony o `deviceId?` + `listDevices()` (patrz modified file).

#### `src/ui/studio/panels/scene.ts` (component, request-response)

**Analog (partial):** brak — nowy panel; dane z `src/scene/presets.ts`, akcje przez `ScenePresetController`.

**Rules to respect:**
- Picker presetów: min. 3, ukryty gdy < 2 (UI-SPEC zero-one-many) → dane z rejestru presetów, zero hardcode.
- Tweaker może dodać preset JSON (import) — walidacja jak store.

---

### 11-04 — User layer + porównywarka

#### `src/ui/user/conversation-dock.ts` (component, request-response)

**Analog:** `hud.ts:630-645` (tekst przycisków) + `index.html:40-56` (dock markup).

```typescript
public setVoiceButtonText(isRunning: boolean): void {
  if (this.btnToggleVoice) {
    this.btnToggleVoice.innerHTML = isRunning
      ? `<span class="btn-icon">🛑</span><span class="btn-label">Zakończ</span>`
      : `<span class="btn-icon">🎙️</span><span class="btn-label">Rozmowa</span>`;
    this.btnToggleVoice.className = `dock-btn btn-call ${isRunning ? 'active' : ''}`;
  }
}
```

**Rules to respect:**
- Copy: „Rozpocznij rozmowę" (idle) / „Zakończ rozmowę" (aktywne); ikony inline SVG w stylu Lucide (UI-SPEC Design System) — **nie emoji** w nowej warstwie user.
- `innerHTML` tylko dla statycznego markupu bez danych; etykiety przez `textContent`.
- Akcje: start/stop → `conversationController.start/stop`; mute → `toggleMute`; Przerwij = destructive (`btn-danger`, `#ef4444`).
- Stan przycisków subskrybowany z bus (`voice-state`), nie pchany krok po kroku.

#### `src/ui/user/algorithm-switcher.ts` (component, event-driven)

**Analog:** `hud.ts:319-331` (select źródła) + chipsy `hud.ts:779-796` + `animation-router.ts`.

```typescript
// hud.ts:319-331 — odczyt stanu + zmiana
const animSource = document.getElementById('sel-anim-source') as HTMLSelectElement | null;
if (animSource) {
  const stored = localStorage.getItem(ANIM_SOURCE_KEY);
  if (stored === 'viseme' || stored === 'frames') animSource.value = stored;
  animSource.addEventListener('change', () => {
    const mode = animSource.value === 'frames' ? 'frames' : 'viseme';
    localStorage.setItem(ANIM_SOURCE_KEY, mode);
    callbacks.onAnimationSourceChange?.(mode);
  });
}
```

**Rules to respect:**
- Segment `LIVE | A2F` + „Porównaj A/B" + toggle blind; źródła z `AnimationSourceRegistry` (`available()` async → disabled + tooltip gdy offline; copy: „A2F jest niedostępny — sprawdź adres serwisu w Studio → A2F.").
- Zmiana trybu w runtime **zawsze** `deferToTurnEnd` (bez cięcia twarzy w pół słowa).
- ComparePanel (chipsy A/B, etykiety toru, czas predict) w tym samym module — dokładnie 2 chipsy, overflow niemożliwy z konstrukcji.
- Empty state: „Brak wypowiedzi do porównania" + body z Copywriting Contract; „Porównaj A/B" disabled do pierwszej tury.

#### `src/ui/user/captions.ts` (component, streaming)

**Analog:** `hud.ts:563-573` + `index.html:565-577`.

```typescript
public setUserTranscript(text: string): void {
  if (this.transcriptUserElement) this.transcriptUserElement.textContent = text;
}
public setAgentTranscript(text: string): void {
  if (this.transcriptAgentElement) this.transcriptAgentElement.textContent = text;
}
```

**Rules to respect:**
- TY / AGENT; wrap do 3 linii z wygaszaniem starszych; pełna treść w Studio → Sesja (UI-SPEC long-text).
- `textContent` wyłącznie (bezpieczeństwo transkryptu).
- Max 720px szerokości, nad dockiem (Visual Direction).

#### `src/ui/user/status-pill.ts` (component, request-response)

**Analog:** `hud.ts:536-561`.

```typescript
const labels: Record<string, string> = {
  idle: 'IDLE', listening: 'SŁUCHAM', speaking: 'MÓWIĘ...', thinking: 'MYŚLĘ...',
};
this.voiceStateElement.textContent = labels[state] ?? state.toUpperCase();
this.voiceStateElement.className = `status-pill voice-${state}`;
```

**Rules to respect:**
- Stany zamknięte: Gotowy / Słucham… / Mówię… / Myślę… (UI-SPEC); kolory semantyczne: `#10b981` słucham, `#eab308` myślę, `#94a3b8` idle, akcent `#38bdf8` mówię.
- Brand + status top-left (user layer).

#### `src/ui/user/user-settings.ts` (component, CRUD)

**Analog:** `SettingsModal` + wiring `main.ts:484-500, 563-592`.

```typescript
// main.ts:563-566 — callback zapisu
const settingsModal = new SettingsModal((saved) => {
  document.body.classList.toggle('theme-light', saved.theme === 'light');
  audioEngine.masterGain.gain.setValueAtTime(saved.volume, audioEngine.ctx.currentTime);
});
```

**Rules to respect:**
- Zakres usera: głośność, urządzenia (mic), motyw, preset sceny; **agent ID i URL A2F przeniesione do studio** (diagnoza: URL A2F w modalu = zły dom).
- Zapis przez store; `setVolume` na `AudioEngine.masterGain` jak wyżej.
- Pola zablokowane przez tweakera: `disabled` + tooltip (rekomendacja UI-SPEC locków).
- `enumerateDevices()` + `deviceId` — patrz `mic-capture.ts` modified.

#### `src/features/compare-controller.ts` (controller, state machine)

**Analog:** `face-controller.ts` (maszyna stanu + epoka) — najbliższy wzorzec klasy stanowej w repo.

```typescript
// face-controller.ts:36-46 — pola stanu + epoch
export class FaceController {
  private state: FaceState = 'IDLE';
  private epoch = 0;
  private relaxStartedAt = 0;
  // ...
}
```
```typescript
// face-controller.ts:167-172 — guard epoki przed feedFrames
public feedFrames(clip: FramesClip, baseSec: number, epoch: number): void {
  if (epoch !== this.engine.getEpoch()) {
    console.warn('[FaceController] feedFrames ze starej epoki — ignoruję');
    return;
  }
  this.epoch = epoch;
  // ...
}
```
```typescript
// audio-engine.ts:40-55 — playChunk zwraca zaplanowany start (oś ctx.currentTime)
public playChunk(pcmBytes: Uint8Array, sampleRate = 44100, chunkEpoch = this.epoch): number {
  if (chunkEpoch !== this.epoch) return 0;
  // ...
  const startTime = Math.max(now + this.prebufferSeconds, this.tailTime);
  // ...
  return startTime;
}
```
```typescript
// a2f-backend.ts:78-107 — kontrakt predict /predict (WAV Blob → FramesClip + predictMs)
export async function predictFrames(baseUrl: string, wavBlob: Blob, opts?: RequestOptions): Promise<PredictFramesResult> {
  const form = new FormData();
  form.append('file', wavBlob, 'speech.wav');
  const res = await fetch(`${clean}/predict`, { method: 'POST', body: form, signal: controller.signal, headers: { Accept: 'application/json' } });
  const text = await res.text();
  const parsed = parseA2fJson(text);
  return { parsed, predictMs: Math.round(performance.now() - started) };
}
```

**Rules to respect:**
- Stany: `idle | ready | predicting | playing-a | playing-b | done | error` — testowane jednostkowo (RESEARCH Pattern 5).
- `LastTurnBuffer` zbiera **dokładne bajty** per chunk: `{ pcm: Uint8Array; alignment: CharAlignment; startSecAbs: number }[]` + `sampleRate` + `text`; replay zawsze przez `playChunk(z bieżącym currentTime)` po `hardStop()` (świeża epoka) — Pitfall 4.
- Tor A (LIVE): `hardStop()` → per chunk `playChunk(te same bajty)` + `faceController.onAudioChunk(alignment, scheduledStart, epoch)`.
- Tor B (A2F): `encodeWav(concat(pcm), sampleRate)` → `predictFrames` → **po odpowiedzi** `hardStop()` → `playChunk` → `feedFrames(clip, baseSec, epoch)`.
- Nowy `onAudioChunk` z WSS natychmiast anuluje replay (Pitfall 5); start tylko w IDLE.
- Blind: kolejność losowana raz; etykiety ukryte do wyboru; wynik trzymany w sesji.
- `deferToTurnEnd` obsługuje przełączenie mid-turn — compare nie zmienia `FaceController` poza wyżej wymienionymi wywołaniami.
- Test fairness: RMS obu ścieżek < 1% (backstop UI-SPEC).

#### `src/audio/pcm-to-wav.ts` (utility, transform)

**Analog:** `src/audio/pcm-resampler.ts` (byte-level helper + test).

```typescript
// pcm-resampler.ts:80-90 — wzorzec pracy na bajtach (DataView po byteOffset, little-endian)
export function pcmBytesToFloat32(bytes: Uint8Array): Float32Array {
  const sampleCount = Math.floor(bytes.length / 2);
  const out = new Float32Array(sampleCount);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < sampleCount; i++) out[i] = view.getInt16(i * 2, true) / 32768;
  return out;
}
```

**Rules to respect:**
- `encodeWav(pcm: Uint8Array, sampleRate: number): Blob` — mono, 16-bit PCM LE, nagłówek RIFF 44 B (RESEARCH Code Examples); `new Blob([header, pcm], { type: 'audio/wav' })`.
- Plik czysty (bez DOM) → test na bajtach nagłówka i długości (`tests/pcm-to-wav.test.ts`, analog `tests/pcm-resampler.test.ts:33-48`).

---

### 11-05 — Scene presety

#### `src/scene/presets.ts` (config, transform)

**Analog:** `CALIBRATION_PRESETS` (`calibration.ts:35-71`).

```typescript
export const CALIBRATION_PRESETS: Record<CalibrationPresetName, CalibrationProfile> = {
  subtle: { jawScale: 0.85, /* ... */ },
  balanced: { jawScale: 1.00, /* ... */ },
  expressive: { jawScale: 1.15, /* ... */ },
};
export const DEFAULT_CALIBRATION_PROFILE: CalibrationProfile = CALIBRATION_PRESETS.balanced;
```

**Rules to respect:**
- `SCENE_PRESETS: ScenePreset[]` — dane z tabeli UI-SPEC („Visual Direction"): `studio-dark`, `studio-soft`, `cinema`, `light`; pola: `background {type:'color'|'gradient', ...}`, key/fill/rim `{intensity,color}`, `ambient`, `exposure`, `pedestal`, `framing:'bust'|'head'`.
- Default = `studio-dark` (obecne wartości z `lighting.ts:18-44` i `scene.ts:9`).

#### `src/features/scene-preset-controller.ts` (controller, transform)

**Analog (composition, brak jednego odpowiednika):** `lighting.ts` + `scene.ts` + `renderer.ts` + `environment.ts`.

```typescript
// lighting.ts:6-49 — publiczne pola świateł (mutowalne przez kontroler)
export class StudioLighting {
  public readonly keyLight: THREE.DirectionalLight;   // intensity/color
  public readonly fillLight: THREE.DirectionalLight;
  public readonly rimLight: THREE.DirectionalLight;
  public readonly ambientLight: THREE.AmbientLight;
  public readonly group: THREE.Group;
}
```
```typescript
// scene.ts:7-16 — tło jako Color (do podmiany na Color/CanvasTexture)
this.instance = new THREE.Scene();
this.instance.background = new THREE.Color(0x0e1117);
this.createGroundPedestal();
```
```typescript
// renderer.ts:18-21 — exposure jako mutowalna właściwość
this.instance.outputColorSpace = THREE.SRGBColorSpace;
this.instance.toneMapping = THREE.ACESFilmicToneMapping;
this.instance.toneMappingExposure = 1.0;
```
```typescript
// environment.ts:17-29 — dispose starych tekstur przed wymianą (wzorzec do naśladowania)
public setupRoomEnvironment(scene: THREE.Scene): THREE.Texture {
  if (this.currentEnvTexture) this.currentEnvTexture.dispose();
  // ...
}
```
```typescript
// camera.ts:18-23 — kadr (do sterowania framingiem bust/head)
this.instance.position.set(0, 1.5, 1.3);
this.controls.target.set(0, 1.45, 0);
```

**Rules to respect:**
- `apply(id)` ustawia cel tweenu; `update(dt)` lerpuje intensywności/kolory świateł i `toneMappingExposure` — deterministycznie, frame-rate independent, bez `setTimeout` (Don't Hand-Roll).
- Crossfade 280 ms; `prefers-reduced-motion: reduce` → apply natychmiast.
- Background: `Color` dla `color`, cache'owany `CanvasTexture` dla `gradient` + `texture.colorSpace = THREE.SRGBColorSpace`; **dispose starych tekstur** przy wymianie (Pitfall 7).
- Pedestal: `visible` (obecny mesh w `scene.ts:26-29` — wystawić referencję/dostęp).
- Framing: `camera.instance.position.z` 1.22 (bust) / 0.9 (head) + `controls.target`; uwzględnić auto-kadrowanie po loadzie (`main.ts:213-217`) — preset aplikuje się po tym.
- Budżet: brak nowego postprocessingu; winieta CSS; bloom/DoF tylko preset-gated po pomiarze (AVAT-02).
- Panel Scena + `user.scenePreset` czytają z kontrolera; `light` sparowany z `body.theme-light` (kierunek: theme→preset — Open Q2).

#### `src/features/animation-source-registry.ts` (registry, pub-sub)

**Analog:** `src/lipsync/animation-router.ts` + tabela źródeł w `VISEME_GROUPS`.

```typescript
// animation-router.ts:14-33 — polityka wyboru źródła per tura
export type AnimationSource = 'viseme' | 'frames';
export function resolveAnimationSource(ctx: RouterContext): AnimationSource {
  if (ctx.liveTurn) return 'viseme';
  const language = ctx.language ?? 'en';
  if (language !== 'en') return 'viseme';
  if (ctx.mode === 'viseme') return 'viseme';
  if (ctx.a2fHealthy === false) return 'viseme';
  return 'frames';
}
```

**Rules to respect:**
- `AnimationSourceSpec { id, label, short: 'LIVE'|'A2F', available(): boolean | Promise<boolean>, apply(services): void }` — F10 rejestruje `a2f-cloud`; segment i porównywarka czytają z rejestru (zero hardcode w HTML).
- `available()` może być async (`fetchA2fStatus`) → segment pokazuje busy/disabled.

#### `src/style.css` + `index.html` (modified)

**Analog:** istniejące reguły motywu/prezentacji w `style.css:681-690, 879-894`.

```css
/* style.css:681-690 — wzorzec ukrywania chrome wg klasy body */
body.presentation-mode .top-dock,
body.presentation-mode .telemetry-pill-card,
body.presentation-mode .side-drawer { /* ukryte */ }
body.presentation-mode .btn-exit-presentation { /* widoczne */ }
```

**Rules to respect:**
- Nowe reguły: `body[data-mode="user"]` ukrywa chrome studia; `body[data-mode="studio"]` pokazuje wszystko; winieta `cinema` jako CSS overlay.
- `index.html` redukowany do shella (canvas, fallback WebGL, loader, toast, dialog?) — markupy paneli w modułach (Zasady nienaruszalne).
- Spacing/typografia wg UI-SPEC (8px, 12/14/18px); kontrast i `:focus-visible` z akcentem `#38bdf8`.

#### `src/audio/mic-capture.ts` (modified — `deviceId`)

**Analog:** sam plik, `mic-capture.ts:29-41`.

```typescript
public async start(onChunk: (base64Chunk: string) => void): Promise<void> {
  const ctx = await this.unlockAudioContext();
  this.mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  // ...
}
```

**Rules to respect (Open Q3 — rekomendacja: rozszerzyć):**
- Dodaj `deviceId?: string` do opcji `getUserMedia` i `listDevices()` (`navigator.mediaDevices.enumerateDevices()` → `audioinput`).
- Test jednostkowy na mapowanie opcji (fake `navigator.mediaDevices`).
- Nie zmieniaj reszty toru (resampling 16 kHz, base64, ScriptProcessor) — poza zakresem.

#### Testy 11-05

**`tests/panel-registry.test.ts`** — analog `tests/animation-router.test.ts` (czysty kontrakt: `visibleIn` filtruje, mount idempotentny, destroy odpina).
**`tests/compare-controller.test.ts`** — analog `tests/face-controller-state.test.ts:6-40` (mock ports) + `tests/audio-engine.test.ts:4-78` (MockAudioContext).
**`tests/scene-presets.test.ts`** — analog `tests/lighting-materials.test.ts:7-17`: realne obiekty THREE bez WebGL.
```typescript
const lighting = new StudioLighting();
expect(lighting.keyLight.intensity).toBeCloseTo(2.2);
lighting.addToScene(scene);
expect(scene.children).toContain(lighting.group);
```
**`tests/pcm-to-wav.test.ts`** — analog `tests/pcm-resampler.test.ts:33-48` (round-trip i długości bajtów; sprawdź `RIFF`/`WAVE`/`data` i `36 + pcm.byteLength`).

---

## Shared Patterns

### Persistence / localStorage
**Source:** `src/prod/settings-modal.ts:41-59` i `src/lipsync/calibration.ts:78-91`
**Apply to:** `settings-store`, `migrate`, adaptery legacy
```typescript
if (typeof localStorage !== 'undefined') {
  try { /* getItem/setItem/removeItem */ }
  catch (e) { console.warn('[Module] ...', e); }
}
```
- Nigdy bezpośredni `localStorage` w komponentach UI (Anti-Pattern); w okresie etapowania store jest write-through do kluczy legacy.

### Defensywny odczyt i walidacja (untrusted storage/import)
**Source:** `src/lipsync/viseme-overrides.ts:148-159` + `calibration.ts:82-88`
**Apply to:** `settings-store.import`, `migrate`, panel Scena (JSON preset)
```typescript
const parsed = JSON.parse(raw) as VisemeOverrideMap;
return parsed && typeof parsed === 'object' ? parsed : {};
```
- Odrzucaj `__proto__/constructor/prototype`, klampuj liczby, limity rozmiaru (512 wpisów), wszystko w `try/catch` → toast błędu (ASVS V5).

### Event/DOM lifecycle
**Source:** `hud.ts` (anti-wzorzec: brak destroy) + RESEARCH Pattern 2
**Apply to:** wszystkie nowe komponenty UI i panele
- `mount(ctx): PanelHandle { destroy(); }`; `destroy` odpina `Unsub`(y) i usuwa DOM; globalne listenery tylko w `container.ts`.
- Test regresyjny: licznik listenerów na fake target po N mount/destroy.

### FaceDriver ownership
**Source:** `face-controller.ts:32-35` (komentarz) + `main.ts` użycia
**Apply to:** wszystkie kontrolery i panele
- Tylko `FaceController` pisze do `FaceDriver`. Panele/inspector → `faceController.setManualOverride/clearManualOverrides`; compare → `onAudioChunk`/`feedFrames`/`onInterruption`.

### Epoch / barge-in
**Source:** `audio-engine.ts:40-44, 83-99` + `face-controller.ts:167-172, 271-275`
**Apply to:** `compare-controller`, `conversation-controller`, `animation-controller`
- Każdy tor replay: `hardStop()` przed `playChunk`/`feedFrames`; guard `epoch !== engine.getEpoch()` ignoruje spóźnione chunki.

### Copy UI (PL)
**Source:** `11-UI-SPEC.md` `## Copywriting Contract`
**Apply to:** wszystkie komponenty user/studio
- Dokładne stringi: „Rozpocznij rozmowę"/„Zakończ rozmowę", „LIVE"/„A2F", „Porównaj A/B", „Brak wypowiedzi do porównania", statusy „Gotowy/Słucham…/Mówię…/Myśle…", error połączenia i A2F offline — bez wymyślania wariantów.

### Testy (node-first)
**Source:** `tests/calibration.test.ts:12-30`, `tests/face-controller-state.test.ts:6-50`, `tests/audio-engine.test.ts:4-78`
**Apply to:** wszystkie nowe pliki testów
- `vi.stubGlobal` / wstrzykiwane porty zamiast DOM; realne THREE bez WebGL; brak nowych devDep (happy-dom tylko opcjonalnie + checkpoint — RESEARCH).

---

## No Analog Found

Pliki bez dokładnego odpowiednika w repo (planner korzysta z RESEARCH.md):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/app/events.ts` | utility | pub-sub | Brak TypedEventBus w repo; najbliżej: callback-map `EmbedBridge` i pola-callbacki `SpeechBackend` — użyć RESEARCH Pattern 2 |
| `src/ui/studio/panel-registry.ts` | registry | pub-sub | Brak rejestru z lifecycle `mount/destroy`; wzorce danych: `VISEME_GROUPS`, kontrakt: `HudCallbacks` — RESEARCH Pattern 4 |
| `src/features/scene-preset-controller.ts` | controller | transform | Brak kontrolera z tweenem w pętli; kompozycja istniejących klas sceny — RESEARCH Pattern 6 |
| `src/features/compare-controller.ts` | controller | state machine | Brak wzorca sekwencyjnego replay A/B; maszyna stanu wg `FaceController`, pipeline z `predictFrames`+`playChunk` — RESEARCH Pattern 5 |

---

## Metadata

**Analog search scope:** `src/` (app, audio, core, lipsync, prod, realism, scene, types, ui), `tests/`, `index.html`, `src/style.css`, `vite.config.ts`, `package.json`
**Files scanned:** 30 source/test/scene/config files read in full; structure grep `src/ui/hud.ts` (871 l.) i `index.html` (621 l. / ~100 ID)
**Pattern extraction date:** 2026-09-10
**Kluczowe ograniczenia:** brak `AGENTS.md`, brak `.claude/skills/` w repo; brak `vitest.config` (defaults, env `node`); brak path aliasów — importy względne.
