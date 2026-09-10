# Phase 11: UI dual-persona i modularny frontend — Research

**Researched:** 2026-09-10
**Domain:** Vanilla TS + Vite + Three.js + vitest — modularny frontend, dual-persona (user/studio), scene presets, porównywarka A/B
**Confidence:** MEDIUM-HIGH (cały kod repo zweryfikowany bezpośrednio; wzorce zewnętrzne oznaczone `[ASSUMED]`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

| Temat | Decyzja |
|---|---|
| Dostęp do studia | `?studio=1` + skrót (Ctrl+Shift+D), wybór persystuje; bez osobnego builda |
| Porównywarka A/B | Segment `LIVE | A2F` + „Porównaj" **na ostatniej turze** (to samo audio + alignment; A2F zasilony tym samym PCM); chipsy A/B; opcjonalny tryb blind „który lepszy?" |
| Zakres refaktoru | Pełny, etapowany (store + panele + kontrolery + scene presets), bez frameworka |
| Timing | Teraz jako Phase 11; start po UAT 08-04, równolegle z Fazą 9 |

Dodatkowo wiążące z CONTEXT.md (sekcje „Model person i precedencja ustawień" oraz „Zasady nienaruszalne"):
- Precedencja: defaults → profil tweakera → wybory usera (tylko dozwolony podzbiór); tweaker może zablokować ustawienie i eksportować/importować profil JSON.
- Tylko `FaceController` pisze do `FaceDriver`; porównywarka używa `deferToTurnEnd`; timing pól nie może ciąć twarzy.
- Domyślny preset sceny i tryb user trzymają 60 FPS @ 1080p (AVAT-02).
- `index.html` przestaje być źródłem prawdy markupu — panele w modułach.
- Bez frameworka i bez nowych zależności runtime.

### the agent's Discretion

CONTEXT.md nie zawiera osobnej sekcji „Discretion". Kształt API modułów (factory vs class, sygnatury rejestrów, schemat kluczy store) jest przedmiotem tego researchu — rekomendacje poniżej. Układ plików jest zalecony w CONTEXT (`src/app/`, `src/features/`, `src/ui/{user,studio,shared}`) — traktować jako domyślny, ale nie święty.

### Deferred Ideas (OUT OF SCOPE)

Brak jawnej sekcji. Poza zakresem tej fazy pozostają: rejestracja źródła `a2f-cloud` i chmura (Faza 10), zmiany w torze animacji/A2F w rdzeniu (Fazy 8–10), zmiana `docs/` rdzenia poza update'm wymaganym przez 11-05.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Dwie warstwy UI (user/studio) + `panel-registry` z `visibleIn` | Pattern 1/3 (component factory + PanelRegistry), ui-mode (sekcja 7), CSS `body[data-mode]` |
| UI-02 | Porównywarka A/B na ostatniej turze (to samo PCM), chipsy, blind, deferToTurnEnd | Pattern 5 (CompareController + LastTurnBuffer), analiza fairness (sekcja 6), istniejące `FaceController.setAnimationMode({deferToTurnEnd})` i `feedFrames` |
| UI-03 | Scene presets (min. 3 + light), 60 FPS | Pattern 6 (ScenePresetController + tween), inwentaryzacja `StudioLighting`/`AppScene`/`AppRenderer` |
| UI-04 | SettingsStore + kontrolery z `main.ts` ≤ ~100 linii + panele zamiast `hud.ts` | Pattern 2/3/4, mapa god-objects (sekcja 1), struktura `src/app`+`src/features` |
| UI-05 | Profil tweakera (export/import), locki, zero martwych ustawień (`micSensitivity`) | Schemat store (sekcja 2), migration inventory localStorage, ASVS V5 (walidacja importu) |
</phase_requirements>

## Summary

Faza 11 to refaktor starego, ale działającego frontendu (main.ts 676 linii, hud.ts 871 linii, index.html 621 linii) plus trzy nowe zdolności: persony user/studio, porównywarka A/B na ostatniej turze i presety sceny. Wszystkie potrzebne mechanizmy toru animacji już istnieją i są zweryfikowane w kodzie: `FaceController.setAnimationMode(mode, { deferToTurnEnd })` (face-controller.ts:115-125), `feedFrames(clip, baseSec, epoch)` z guardem epoki (face-controller.ts:167-192), `AudioEngine.playChunk` zwracające `startSec` na osi `ctx.currentTime` i `hardStop()` inkrementujące epoch (audio-engine.ts:40-99) oraz parser/predict A2F przyjmujący WAV jako `Blob` (a2f-backend.ts:78-107). Brakuje natomiast: bufora ostatniej tury (PCM + alignment per chunk), enkodera PCM→WAV (brak w `src/audio/`), jednego SettingsStore i rejestrów.

Największe ryzyko fazy to **migracja localStorage**: kalibracja (`avatar_lip_calibration_profile_v3`) i nadpisania wizemów (`avatar_viseme_overrides_v1`) są danymi użytkownika, których utrata jest niedopuszczalna. Rekomendacja: store z `schemaVersion: 1`, migracja przy pierwszym starcie z pozostawieniem kluczy legacy jako backupu (write-through mirror) i usunięciem mirroru dopiero w 11-05.

**Primary recommendation:** budować od dołu — 11-01 store+ui-mode+bus z testami w środowisku `node` (bez nowych zależności, storage wstrzykiwany), potem kontrolery, potem rejestry/persony, na końcu scene presets; DOM testować per-plik przez `// @vitest-environment happy-dom` tylko dla glue paneli.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Persona user/studio (`?studio=1`, skrót, persisted) | Browser (UI shell) | — | Czysto klienckie przełączanie widoczności; brak backendu |
| SettingsStore (schemat, precedencja, locki, eksport) | Browser (app core) | — | localStorage jest jedynym nośnikiem; brak serwera w tej fazie |
| Panel registry / AnimationSource registry | Browser (app core) | — | Rejestry UI; źródła animacji wołane lokalnie (A2F wrapper fetch) |
| Porównywarka A/B – scheduling audio | Browser (Web Audio) | — | `AudioContext.currentTime`; brak nowych wywołań serwera oprócz `/predict` A2F |
| Porównywarka A/B – ramki A2F | Browser (fetch) | A2F wrapper (F9/F10) | Ten sam kontrakt `/predict`; klient tylko wysyła PCM i gra ramki |
| Scene presets (tło/rig/exposure/kadr) | Browser (Three.js) | CSS (winieta) | Mutacje sceny w runtime; winieta CSS bez postprocessingu |
| Animacja twarzy podczas replay | Browser (FaceController) | — | Nadal jedyny właściciel zapisu do FaceDriver |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.7.3 (installed 5.7.3) | język | już w projekcie |
| Vite | ^6.2.0 | dev/build | już w projekcie; `npm run build` = `tsc && vite build` |
| Three.js | ^0.174.0 | scena/presety | już w projekcie; `RoomEnvironment` z `three/examples/jsm` |
| vitest | ^4.1.11 | testy | już w projekcie (installed 4.1.11); domyślne env `node` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| happy-dom (devDep, opcjonalnie) | 20.14.3 (npm) | DOM env dla testów glue paneli | Tylko dla plików z `// @vitest-environment happy-dom`; patrz Package Legitimacy Audit |
| jsdom (devDep, alternatywa) | 30.0.1 (npm) | j.w., verdic OK bez checkpointu | Gdy zespół nie chce checkpointu SUS dla happy-dom |

**Installation:** `npm install -D happy-dom` (opcjonalnie; wariant minimalny = zero nowych devDep).

**Version verification:** `npm view happy-dom version` → 20.14.3; `npm view jsdom version` → 30.0.1; installed vitest → 4.1.11 (data dostępu 2026-09-10). Brak `vitest.config.*` — vitest działa na defaultach (env `node`); `vite.config.ts` nie definiuje sekcji `test`.

## Package Legitimacy Audit

| Package | Registry | Age (sygnał) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|--------------|-----------|-------------|---------|-------------|
| happy-dom | npm | ostatni release 2026-09-09 ("too-new" wg heurystyki) | 8.9M/wk | github.com/capricorn86/happy-dom | SUS | `happy-dom` [WARNING: flagged as suspicious — verify before using.] — jeśli instalowany, planner MUSI dodać `checkpoint:human-verify` przed `npm install -D happy-dom` |
| jsdom | npm | release 2026-07-29 | 53.3M/wk | github.com/jsdom/jsdom | OK | Approved (fallback bez checkpointu) |

**Uwaga o false-positive:** verdict SUS dla happy-dom wynika wyłącznie z sygnału `too-new` liczonego z daty **ostatniego** release (2026-09-09), a nie wieku pakietu — projekt istnieje od lat, ma 8.9M weekly downloads i publiczne repo bez `postinstall`. Mimo to protokół wymaga flagi; decyzja planu: albo happy-dom + checkpoint, albo jsdom (OK) bez checkpointu, albo **zero nowych devDep** (wariant minimalny — rekomendowany jako domyślny, patrz Validation Architecture).

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious (SUS):** happy-dom (jeśli wybrany)

## Architecture Patterns

### System Architecture Diagram

```
 speechBackend (WSS) ──onAudioChunk(pcm,align,epoch,start)──▶ ConversationController
      │                                                            │ capture (LastTurnBuffer)
      │ viseme                                                      ▼
      ▼                                                 CompareController
 FaceController ◀── feedFrames(clip,base,epoch) ── B: encodeWav(PCM)→POST /predict→frames
      ▲ └────────── onAudioChunk(align,start,epoch) ─ A: replay stored PCM + alignment
      │                                                (replay start: AudioEngine.playChunk @ currentTime)
   FaceDriver (jedyny pisarz: FaceController)
 UI: UserShell(dock/captions/segment) + StudioShell(panel-registry) ─┬─▶ TypedEventBus
      SettingsStore(precedence/locks) ◀───────────────────────────────┘
      ScenePresetController ─▶ StudioLighting / scene.background / renderer.exposure / pedestal
```

Przepływ kluczowy: **jedno źródło PCM dla obu torów** — `CompareController` zapisuje oryginalne bajty w `LastTurnBuffer`, więc uczciwość porównania jest konstrukcyjna, nie „staramy się".

### Recommended Project Structure

```
src/app/
  container.ts          # composition root; main.ts tylko bootstrap ≤ ~100 linii
  ui-mode.ts            # user|studio, URL/skrót, data-mode (env wstrzykiwany — testowalne)
  events.ts             # TypedEventBus<AppEvents> + Disposables
  store/
    settings-store.ts   # schema v1, persistence, precedence, locki, export/import
    settings-schema.ts  # typy + defaults + clamp/validate (czysto testowalne)
    migrate.ts          # legacy localStorage → blob v1
src/features/
  conversation-controller.ts   # z main.ts: start/stop/mute/interrupt/transcripts
  animation-controller.ts      # źródło animacji, demo, kalibracja, wizemy → FaceController
  compare-controller.ts        # A/B na ostatniej turze (+ LastTurnBuffer)
  telemetry-controller.ts      # FPS/TTFB/align/A2F do UI
  scene-preset-controller.ts   # apply/tween presetów
src/audio/pcm-to-wav.ts        # encodeWav(pcm, sampleRate) — nowy, czysty helper
src/ui/user/  conversation-dock.ts, algorithm-switcher.ts, captions.ts, status-pill.ts, user-settings.ts
src/ui/studio/ studio-shell.ts, panel-registry.ts, panels/{animation,visemes,inspector,a2f,session,scene}.ts
src/ui/shared/ toast.ts, loader.ts, modal.ts, dom.ts (el(), on(), listen())
tests/{settings-store,ui-mode,panel-registry,compare-controller,scene-presets,pcm-to-wav}.test.ts
```

### Pattern 1: Composite component = factory + PanelHandle (nie klasa)

**What:** komponent = factory przyjmująca `{ store, events, services, container }`, zwracająca `{ el: HTMLElement; destroy(): void }`. Klasy tylko dla kontrolerów z maszyną stanu (CompareController, ScenePresetController).
**When to use:** wszystkie komponenty UI i panele.
**Example:**
```ts
export interface PanelHandle { destroy(): void }
export interface PanelContext {
  store: SettingsStore; events: TypedEventBus<AppEvents>;
  services: AppServices; container: HTMLElement;
}
export function mountCaptions(ctx: PanelContext): PanelHandle {
  const el = div({ class: 'captions' }); ctx.container.append(el);
  const off = ctx.events.on('transcript', (t) => { el.textContent = t.text; });
  return { destroy() { off(); el.remove(); } };
}
```
Uzasadnienie: brak `this`-pułapek, naturalny `destroy`, trywialne testy z fake-containerem. Kontrolery klasowe zachowują wzorzec z repo (`AudioEngine`, `FaceController`).

### Pattern 2: TypedEventBus + Disposables (zero wycieków listenerów)

**What:**
```ts
type Unsub = () => void;
export class TypedEventBus<E extends Record<string, unknown>> {
  private map = new Map<keyof E, Set<(p: any) => void>>();
  on<K extends keyof E>(type: K, h: (p: E[K]) => void): Unsub { /* ... */ }
  emit<K extends keyof E>(type: K, payload: E[K]): void { /* kopia seta przed iteracją */ }
}
export function disposables(): { add(u: Unsub): void; dispose(): void }
```
**When to use:** cała komunikacja UI↔kontrolery. Globalne listenery (`resize`, `keydown`, `dragover/drop`, `pointermove`) rejestrowane raz w `container.ts` i sprzątane przez `dispose()`; komponenty wyłącznie przez bus.
**Pitfall do uniknięcia:** obecny `Hud` rejestruje `keydown`/`drop` bez usuwania i podpina listenery pod stałe ID — przy remoncie paneli to źródło duplikatów. Kontrakt: „kto `add`, ten `remove` w `destroy()`"; test regresyjny na licznik listenerów (fake target) jest tani.

### Pattern 3: SettingsStore — schemat, precedencja, locki

**What:** jeden blob `avatar_settings_v1`:
```ts
interface SettingsStateV1 {
  schemaVersion: 1;
  user: { uiMode: 'user'|'studio'; volume: number; theme: 'dark'|'light';
          scenePreset: string; animationSource: string; micDeviceId: string|null };
  studio: { agentId: string; a2fUrl: string; lipSyncEngine: 'phoneme'|'char';
            calibration: CalibrationProfile; visemeOverrides: VisemeOverrideMap;
            locks: Record<string, boolean> }; // klucz = ścieżka user.* np. 'volume'
}
```
Effective value: `locked ? (studio[X] ?? default) : (user[X] ?? studio[X] ?? default)`. API: `get/getEffective/setUser (no-op gdy locked)/setStudio/setLock/subscribe/export/import/reset`. Storage wstrzykiwany (`interface StorageLike`) → testy w env `node` bez DOM.
**Ustawianie „dla usera”:** tweaker ustawia `studio.volume`, może `setLock('volume', true)` i ma „Przywróć z profilu" (usuwa `user.volume`). Lock = disabled + tooltip (rekomendacja spójna z UI-SPEC „disabled/ukryte").

### Pattern 4: Rejestry — PanelRegistry i AnimationSourceRegistry

**What:**
```ts
interface PanelDefinition { id: string; title: string; icon: string;
  visibleIn: 'user' | 'studio'; lazy?: boolean; // default true w studio
  mount(ctx: PanelContext): PanelHandle }
class PanelRegistry { register(d): void; list(mode): PanelDefinition[];
  mount(id, ctx): PanelHandle /* idempotentny; destroy poprzedniego */ }

interface AnimationSourceSpec { id: string; label: string; short: string; // 'LIVE'|'A2F'
  available(): boolean | Promise<boolean>; apply(services: AppServices): void }
class AnimationSourceRegistry { register(s); list(); }
```
**When to use:** przeniesienie funkcji między personami = zmiana `visibleIn`; F10 rejestruje `a2f-cloud` (`available()` = `fetchA2fStatus(cloudUrl)`), a segment i „Porównaj" czytają z rejestru — zero hardcode w HTML/markupie. Per-panel boundary błędu (UI-SPEC): `try { handle = def.mount(ctx) } catch { renderPanelError(container) }`.

### Pattern 5: CompareController — sekwencyjny replay A/B z jednego PCM

**What:** `LastTurnBuffer` zbiera per tura LIVE: `{ pcm: Uint8Array; alignment: CharAlignment; startSecAbs: number }[]` + `sampleRate` + `text`. „Porównaj" = dwa przebiegi sekwencyjne: **A (LIVE)** → `audioEngine.hardStop()` (nowa epoka), `playChunk(te same bajty, ten sam sampleRate)` per chunk + `faceController.onAudioChunk(alignment, scheduledStart, epoch)`; **B (A2F)** → `encodeWav(concat(pcm), sampleRate)` → `predictFrames(url, wav)` → po odpowiedzi `hardStop()` → `playChunk(te same bajty)` → `feedFrames(clip, baseSec, epoch)`. Etykiety: `predictMs`, RTF, liczba ramek. Blind: kolejność A/B losowana raz, etykiety ukryte do głosu „który lepszy?".
**When to use:** TYLKO gdy ostatnia tura istnieje i żadna tura LIVE nie trwa; przyjście nowego `onAudioChunk` z WSS anuluje replay (`hardStop`, stan `idle`). Mid-turn przełącznik źródła nadal przez `setAnimationMode(..., { deferToTurnEnd: true })` — bez zmian.
**Fairness:** ten sam bufor bajtów i ten sam `sampleRate` w obu torach; test może policzyć RMS obu ścieżek i porównać (backstop z UI-SPEC: < 1%).

### Pattern 6: ScenePresetController — presety jako dane + tween

**What:** `SCENE_PRESETS: ScenePreset[]` (`studio-dark`, `studio-soft`, `cinema`, `light`) z polami: `background {type:'color'|'gradient'}`, key/fill/rim `{intensity,color}`, `ambient`, `exposure`, `pedestal`, `framing:'bust'|'head'`. Apply: tween 280 ms intensywności/kolorów świateł i `renderer.toneMappingExposure` w pętli render (`update(dt)`); background: `Color` albo cache'owany `CanvasTexture` (gradient) przypisany do `scene.background` (stare tekstury `dispose()`); pedestal `visible`; framing → `camera.position.z` (1.22 / 0.9) i `controls.target`. `prefers-reduced-motion: reduce` → apply natychmiast (bez tweenu).
**When to use:** wybór usera (`user.scenePreset`) i panel Scena w studiu; `light` sparowany z `body.theme-light`.

### Anti-Patterns to Avoid
- **Per-panel `document.getElementById`:** zakaz — panel dostaje `container` i buduje własny markup.
- **Zapisy bezpośrednie do `localStorage` w komponentach:** tylko store (adaptery legacy do 11-05).
- **Nasłuch globalny w każdej instancji komponentu:** resize/keydown tylko w composition root.
- **`innerHTML` z danymi dynamicznymi** (tekst agenta/user/import): zawsze `textContent`.
- **Nowy postprocessing (bloom/DoF) w domyślnym presecie:** tylko preset-gated po pomiarze FPS; domyślnie CSS winieta.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persystencja ustawień | własne gettery per klucz | `SettingsStore` + `StorageLike` | precedencja/locki/migracja w jednym miejscu; testowalne |
| Pub/sub | mini-emitter per moduł | `TypedEventBus` | typowanie zdarzeń, jeden wzorzec unsubscribe |
| Gradient tła | własny shader/plane za avatarem | `CanvasTexture` → `scene.background` | bez dodatkowego draw calla; wzorzec three.js `[ASSUMED]` |
| Crossfade świateł | ręczne `setTimeout` | tween w `update(dt)` z render loop | deterministyczny, frame-rate independent |
| Enkodowanie WAV | „jakoś skleić string" | `pcm-to-wav.ts` z testem nagłówka RIFF | błąd nagłówka = cichy błąd /predict |
| Timeline replay | własny zegar `setInterval` | `AudioEngine.playChunk` + `ctx.currentTime` | spójność z LIVe i epoką barge-in |

**Key insight:** wszystkie „ciężkie" mechanizmy (epoch, defer, feedFrames, parser A2F) już istnieją i są przetestowane — faza ma je komponować, nie przepisywać.

## Runtime State Inventory

> Faza refaktoryzacyjna + migracja danych — kategoria „stored data” obowiązkowa.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | localStorage: `avatar_lip_calibration_profile_v3` (JSON CalibrationProfile, calibration.ts:73), `avatar_viseme_overrides_v1` (JSON map, viseme-overrides.ts:145), `avatar_lipsync_engine` (hud.ts:12), `avatar_anim_source` (hud.ts:15), `elevenlabs_agent_id` (agent-config.ts:52,64), `avatar_settings_theme/volume/mic_sensitivity/a2f_url` (settings-modal.ts:14-20) | Migracja do bloba `avatar_settings_v1` (store/migrate.ts); **nie gubić** kalibracji i wizemów; write-through do kluczy legacy do 11-05; `mic_sensitivity` porzucić (dead setting, UI-05) |
| Live service config | URL wrappera A2F i agentId żyją w localStorage/użytkownika — brak konfiguracji w UI zewnętrznych usług poza tym | Brak akcji poza migracją; zmiana URL przez store |
| OS-registered state | None — verified: brak zadań/daemonów; aplikacja czysto webowa | — |
| Secrets/env vars | None — verified: brak `.env`, brak kluczy API w repo (ROB-03 signed URL poza zakresem) | — |
| Build artifacts | `dist/` istnieje (stary build) | `npm run build` po fazie; nie jest częścią migracji |

**Canonical question:** po aktualizacji wszystkich plików repo, systemy runtime ze starym stringiem/kluczem to wyłącznie localStorage przeglądarki operatora — pokryte migracją i backupem.

## Common Pitfalls

### Pitfall 1: Utrata kalibracji/wizemów przy migracji store
**What goes wrong:** nowy store startuje z defaults i nadpisuje legacy klucze.
**Why:** brak jawnej migracji lub migracja przed odczytem starych kluczy.
**How to avoid:** `migrate()` czyta legacy tylko gdy blob nie istnieje; przed nadpisaniem zapisuje `avatar_settings_backup_<ts>`; test: „legacy calibration → store.calibration identyczne pole po polu".
**Warning signs:** `npm test` zielone, ale ręczna strona traci suwaki po pierwszym wejściu.

### Pitfall 2: Wyciek listenerów przy remoncie paneli
**What goes wrong:** przełączenie tabu studia podwaja handler (np. `input` na suwakach wizemów).
**Why:** `addEventListener` w `mount`, brak `destroy`.
**How to avoid:** każdy `PanelHandle.destroy()` odpina wszystko (bus `Unsub`, DOM `remove()`); test licznika listenerów na fake target.
**Warning signs:** po kilku przełączeniach jedna akcja wykonuje się N razy; wolno rosnąca pamięć.

### Pitfall 3: Split-brain localStorage w trakcie etapowania
**What goes wrong:** store pisze blob, stary `hud.ts` pisze `avatar_anim_source` — wartości się rozjeżdżają.
**Why:** dwa pisma w 11-01..11-03.
**How to avoid:** w okresie przejściowym store jest write-through do legacy kluczy i przy starcie składa blob z legacy; dopiero 11-05 usuwa mirror.
**Warning signs:** ustawienie wraca do starej wartości po reloadzie.

### Pitfall 4: Nieuczciwe porównanie A/B (dryf/timing)
**What goes wrong:** tor A gra z WSS (start w przeszłości), tor B odtwarza z innego bufora; różne sample rate/konwersje → porównanie bez sensu.
**Why:** brak bufora ostatniej tury i wspólnego źródła bajtów.
**How to avoid:** `LastTurnBuffer` przechowuje dokładne bajty i sampleRate; replay zawsze przez `playChunk` z bieżącym `ctx.currentTime`; oba tory po `hardStop()` (świeża epoka); test RMS identyczności ścieżek.
**Warning signs:** „A brzmi inaczej niż B", inny początek/cisza.

### Pitfall 5: Compare replay „walczy" z turą LIVE
**What goes wrong:** user wciska Porównaj, agent zaczyna mówić — dwa tory piszą do FaceDriver.
**Why:** brak polityki wyłączności.
**How to avoid:** `onAudioChunk` z WSS natychmiast anuluje compare; replay startuje tylko w IDLE; stan w CompareController (`idle|ready|predicting|playing-a|playing-b|done|error`) testowany jednostkowo.
**Warning signs:** miganie twarzy, podwójne audio.

### Pitfall 6: `/predict` bez poprawnego WAV
**What goes wrong:** `predictFrames` dostaje Blob bez nagłówka RIFF → 400/500 albo ciche złe ramki.
**Why:** brak enkodera; `new Blob([pcm])` to nie WAV.
**How to avoid:** `encodeWav` (mono, 16-bit PCM, sampleRate z tury) + test porównujący bajty nagłówka i długość; timeout z `predictFrames` już jest (60 s default).
**Warning signs:** A2F zawsze offline w porównywarce mimo działającego `/status`.

### Pitfall 7: Gradient/CanvasTexture bez colorSpace i bez dispose
**What goes wrong:** gradient wygląda wyprany; po przełączeniu presetów rosną tekstury.
**Why:** brak `texture.colorSpace = THREE.SRGBColorSpace`, brak `dispose()` starych.
**How to avoid:** cache per preset id, dispose przy wymianie; `[ASSUMED]` — potwierdzić wizualnie w UAT.
**Warning signs:** z czasem spadek FPS po przeskakiwaniu presetów.

### Pitfall 8: Import profilu jako wektor ataku (prototype pollution / DoS)
**What goes wrong:** JSON z `__proto__`/ogromną mapą wizemów psuje store.
**Why:** brak walidacji importu.
**How to avoid:** walidator schematu (klucze whitelist, klampy liczb, limit wpisów map np. 512, `Object.create(null)`, odrzucanie `__proto__/constructor/prototype`), wszystko przez `try/catch` → toast błędu (UI-SPEC error state).
**Warning signs:** po imporcie losowe pola w obiektach; zawieszony start.

### Pitfall 9: Esc/H vs Ctrl+Shift+D i tryb prezentacji
**What goes wrong:** skrót studia koliduje z prezentacją (Esc/H) albo łapie się w inputach.
**Why:** dwa globalne handlery.
**How to avoid:** jeden keydown-handler w root z tabelą skrótów, ignoruje `input/textarea/select/[contenteditable]` (wzorzec z hud.ts:282-284), Ctrl+Shift+D osobny od H/Esc.
**Warning signs:** wpisywanie w polu tekstowym przełącza widoki.

## Code Examples

### SettingsStore — precedencja (rdzeń logiki, `src/app/store/settings-store.ts`)
```ts
export function resolveEffective<T>(
  key: string, state: SettingsStateV1, defaults: SettingsDefaults
): T {
  const locked = state.studio.locks[key] === true;
  const user = locked ? undefined : (state.user as Record<string, unknown>)[key];
  const studio = (state.studio as Record<string, unknown>)[key];
  return (user ?? studio ?? (defaults as Record<string, unknown>)[key]) as T;
}
```

### PCM → WAV (helper, `src/audio/pcm-to-wav.ts`)
```ts
// Wejście: PCM 16-bit little-endian mono (bajty z AudioEngine/WSS), sampleRate Hz.
export function encodeWav(pcm: Uint8Array, sampleRate: number): Blob {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const writeStr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF'); v.setUint32(4, 36 + pcm.byteLength, true); writeStr(8, 'WAVE');
  writeStr(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  writeStr(36, 'data'); v.setUint32(40, pcm.byteLength, true);
  return new Blob([header, pcm], { type: 'audio/wav' });
}
```

### Scene preset — apply z tweenem
```ts
// src/features/scene-preset-controller.ts (szkic)
apply(id: string): void {
  const p = SCENE_PRESETS.find((x) => x.id === id) ?? SCENE_PRESETS[0];
  this.storeDelta = { key: p.key, fill: p.fill, rim: p.rim, exposure: p.exposure };
  this.t = this.reducedMotion ? 1 : 0; // 1 = natychmiast
  this.applyBackground(p); this.scene.setPedestal(p.pedestal); this.camera.setFraming(p.framing);
}
update(dt: number): void { /* lerp intensywności/kolorów + exposure; koniec → t=1 */ }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 6+ rozsianych kluczy localStorage | jeden versioned store z lockami i profilem | ta faza (11-01) | migracja danych, eksport/import |
| `hud.ts` god-object z 40+ `getElementById` | panel registry + moduły z `mount/destroy` | 11-03 | przenoszenie funkcji = 1 pole |
| Jeden poziom widoczności UI | `body[data-mode]` + `visibleIn` | 11-02/11-03 | persony bez osobnego builda |
| Statyczne światła i tło | presety sceny z crossfade 280 ms | 11-05 | wybór usera, 60 FPS budżet |
| Brak DOM env w vitest | testy node-first; opcjonalnie happy-dom per plik | 11-01+ | szybki `npm test`, bez frameworka |

**Deprecated/outdated:** `micSensitivity` (nigdy niekonsumowane — usunąć, UI-05); `settings-modal` jako właściciel kluczy (tylko adapter do store).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `CanvasTexture` z gradientem jako `scene.background` działa bez dodatkowego kosztu i z `colorSpace` sRGB | Pattern 6, Pitfall 7 | Wizualny (wyprane tło) lub drobny perf; łatwe do korekty w UAT |
| A2 | happy-dom 20.14.3 współpracuje z vitest 4.1.11 na Node 25 (nie uruchomiono instalacji) | Standard Stack | Konieczny fallback na jsdom; dlatego DOM tests są opcjonalne |
| A3 | 280 ms tween świateł nie wpływa na 60 FPS (mutacje uniformów, brak nowych passów) | Pattern 6 | Presety dotkną AVAT-02 → skrócenie/instant apply |
| A4 | UI-SPEC „light sparowany z motywem jasnym" znaczy: wybór presetu `light` ustawia theme light i odwrotnie | Pattern 6 | Niespójność produktowa; do potwierdzenia w planie (Open Q2) |
| A5 | Replay A/B jest sekwencyjny (najpierw A, potem B), nie jednoczesny split-screen | Pattern 5 | Architektura CompareController; CONTEXT mówi „chipsy A/B", co wspiera sekwencję |

## Open Questions

1. **Blind mode — co dokładnie jest losowane?**
   - What we know: UI-SPEC dopuszcza tryb bez etykiet („który lepszy?").
   - What's unclear: kolejność torów, czy wynik zapisujemy gdzieś (telemetria/sesja).
   - Recommendation: losować kolejność odtwarzania raz per porównanie; wynik trzymać w pamięci sesji + `studio` telemetria opcjonalnie.

2. **Sync presetu `light` z motywem jasnym — kierunek zależności.**
   - What we know: UI-SPEC: preset `light` „sparowany z `body.theme-light`".
   - What's unclear: czy zmiana motywu wymusza preset, czy tylko sugeruje.
   - Recommendation: jednokierunkowo theme→preset tylko gdy user nie wybrał presetu ręcznie; zapisać decyzję w planie 11-05.

3. **Mic device picker (UserSettings „urządzenia").**
   - What we know: `MicCapture` używa `getUserMedia({ audio: {...} })` bez `deviceId` (zweryfikowane: mic-capture.ts:34).
   - What's unclear: czy 11-04 ma rozszerzyć MicCapture o `deviceId` + `enumerateDevices`.
   - Recommendation: tak — dodać `deviceId?: string` i method `listDevices()`; test jednostkowy na mapowanie opcji getUserMedia.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build/test | ✓ | v25.6.1 | — |
| npm | instalacje | ✓ | 11.9.0 | — |
| vitest | testy | ✓ | 4.1.11 (installed) | — |
| three | scena | ✓ | 0.174 (package.json) | — |
| happy-dom / jsdom | opcjonalne DOM testy | ✗ | — | jsdom (OK) lub testy node-first bez env |
| A2F wrapper `/predict` | tor B porównywarki | ✗ (lokalnie, F9) | — | tryb B disabled + copy „A2F jest niedostępny…" (UI-SPEC) |
| GPU/1080p 60 FPS | UI-03 walidacja | ✗ (manual) | — | UAT na maszynie operatora (blocking dla kryterium, nie dla kodu) |

**Missing dependencies with no fallback:** brak (A2F wrapper jest zależnością F9; porównywarka projektowana na offline w torze B).
**Missing dependencies with fallback:** DOM env (happy-dom/jsdom lub testy node-first); 60 FPS weryfikowane manualnie.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.11 (bez configu — defaults; env `node`) |
| Config file | none — `vite.config.ts` bez sekcji `test` (jeśli potrzebny per-file env, wystarczy komentarz `// @vitest-environment happy-dom`) |
| Quick run command | `npx vitest run tests/settings-store.test.ts tests/ui-mode.test.ts` (podczas iteracji) |
| Full suite command | `npm test` (`vitest run`) — 32 istniejące pliki muszą pozostać zielone |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | `visibleIn` filtruje panele; przeniesienie funkcji = 1 pole; `data-mode` steruje widocznością | unit (+ opc. DOM smoke) | `npx vitest run tests/panel-registry.test.ts tests/ui-mode.test.ts` | ❌ Wave 0 |
| UI-02 | CompareController: capture→ready→A→B; ten sam PCM (RMS diff < 1%); anulowanie przy turze LIVE; deferToTurnEnd bez cięcia | unit (fake ports) | `npx vitest run tests/compare-controller.test.ts` | ❌ Wave 0 |
| UI-03 | Presety: apply background/exposure/pedestal/framing; tween kończy w wartościach; reduced-motion = instant | unit (real THREE lights, bez WebGL) | `npx vitest run tests/scene-presets.test.ts` | ❌ Wave 0 |
| UI-04 | Store: precedence defaults→studio→user, locki, persistence, migracja v3/v1 bez utraty | unit | `npx vitest run tests/settings-store.test.ts` | ❌ Wave 0 |
| UI-05 | Export→import round-trip; odrzucenie złego JSON; `micSensitivity` nieobecne w schemacie | unit | `npx vitest run tests/settings-store.test.ts` | ❌ Wave 0 |
| UI-02 | `encodeWav` nagłówek RIFF/długości | unit | `npx vitest run tests/pcm-to-wav.test.ts` | ❌ Wave 0 |
| (regresja) | cała domena F1–F10 | unit | `npm test` | ✅ |
| (build) | TS + bundling | build | `npm run build` | ✅ |

### Sampling Rate
- **Per task commit:** quick run (pliki dotknięte) + `npm test` przed commitem etapu (CONTEXT: każdy etap kończy zielony `npm test` i `npm run build`).
- **Per wave merge:** `npm test && npm run build`.
- **Phase gate:** pełny `npm test` + build + manualny UAT w `11-VERIFICATION.md` (60 FPS @1080p, presety wizualnie, blind mode, a11y focus/aria, brak regresji rozmowy).

### Wave 0 Gaps
- [ ] `tests/settings-store.test.ts` — precedence/locks/export-import/migracja (UI-04/UI-05)
- [ ] `tests/ui-mode.test.ts` — URL/shortcut/persistencja (UI-01)
- [ ] `tests/panel-registry.test.ts` — visibleIn/mount/destroy (UI-01)
- [ ] `tests/compare-controller.test.ts` — sekwencja A/B, anulowanie, fairness (UI-02)
- [ ] `tests/scene-presets.test.ts` — apply/tween/pedestal/framing (UI-03)
- [ ] `tests/pcm-to-wav.test.ts` — nagłówek WAV (UI-02)
- [ ] `tests/helpers/memory-storage.ts` — wspólny fake storage (wydzielić ze `tests/settings-modal.test.ts`)
- [ ] (opcjonalnie) `npm i -D happy-dom` — tylko dla ≤ 2 plików DOM smoke (panel mount, aria/focus)

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | brak auth w kliencie (ROB-03 poza zakresem) |
| V3 Session Management | no | brak sesji serwerowej; AudioContext/epoch to nie bezpieczeństwo |
| V4 Access Control | no | `?studio=1` nie jest kontrolą dostępu — tylko widoczność; operator lokalny |
| V5 Input Validation | yes | walidacja importu profilu, klampy wartości, whitelist kluczy, sanityzacja URL A2F (http/https), limity rozmiaru map |
| V6 Cryptography | no | brak kryptografii w fazie; nie hand-rollować |

### Known Threat Patterns for vanilla-TS + localStorage UI
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS przez tekst transkryptu/etykiety do `innerHTML` | Tampering | `textContent` wszędzie; markup paneli statyczny w kodzie |
| Prototype pollution przez import JSON | Tampering | odrzucać `__proto__/constructor/prototype`; `Object.create(null)` dla map |
| DoS przez wielki import (miliony kluczy wizemów) | DoS | limity wpisów (np. 512) i rozmiaru stringa przed parse |
| Zatruty localStorage (ręczna edycja) | Tampering | store traktuje odczyt jako untrusted: walidacja + defaults + toast |
| SSRF/mixed-content przez `a2fUrl` | Tampering | walidacja URL (http/https), info o mixed content; fetch tylko do podanego hosta |

## Sources

### Primary (HIGH confidence)
- `[VERIFIED: codebase]` — `src/main.ts`, `src/ui/hud.ts`, `src/prod/settings-modal.ts`, `src/lipsync/{face-controller,animation-router}.ts`, `src/audio/{audio-engine,speech-backend,a2f-backend,mic-capture}.ts`, `src/core/{scene,camera,renderer}.ts`, `src/scene/{lighting,environment}.ts`, `src/types/avatar.ts`, `index.html`, `src/style.css`, `vite.config.ts`, `package.json`, `tests/*`.
- `.planning/phases/11-*/11-CONTEXT.md`, `11-UI-SPEC.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` (Phase 11), `.planning/STATE.md`.
- npm registry (`npm view`) + package-legitimacy seam: happy-dom 20.14.3 (SUS: too-new), jsdom 30.0.1 (OK).

### Secondary (MEDIUM confidence)
- `[CITED: vitest.dev/guide/environment]` — env `node`/`jsdom`/`happy-dom`, per-file `@vitest-environment`; happy-dom szybszy, ale niepełny API.
- `[CITED: developer.mozilla.org/.../prefers-reduced-motion]` — `reduce` (Baseline od 2020).
- `[CITED: threejs.org/docs/#api/en/scenes/Scene]` — ogólna dokumentacja Scene; konkretne pola nietestowane (patrz A1).

### Tertiary (LOW confidence)
- Wzorce architektoniczne (factory + handle, rejestry, tween w pętli render) — `[ASSUMED]`, nie źródła zewnętrzne.

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — wszystko z `package.json`/`node_modules`/npm registry; brak nowych zależności runtime wymaganych.
- Architecture: HIGH dla wzorców zakotwiczonych w istniejącym kodzie (event bus/registry to rekomendacja); MEDIUM dla scene presetów (gradient `[ASSUMED]`).
- Pitfalls: HIGH — wynikają z konkretnych linii kodu (brak destroy, pojedyncze epoch, brak deviceId, brak WAV).
- Validation: HIGH — testy node-first bez nowych zależności; opcjonalny happy-dom z flagą SUS.

**Research date:** 2026-09-10
**Valid until:** ~2026-10-10 (stabilny stack; happy-dom/wersje do re-weryfikacji przy instalacji).
