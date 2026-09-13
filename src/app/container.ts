/**
 * Composition root (Faza 11, 11-04): scena, audio, kontrolery, bus, shared UI,
 * rejestr paneli i StudioShell. `main.ts` pozostaje cienkim bootstrapem.
 */
import { AppRenderer } from '../core/renderer';
import { AppCamera } from '../core/camera';
import { AppScene } from '../core/scene';
import { StudioLighting } from '../scene/lighting';
import { EnvironmentManager } from '../scene/environment';
import { MetaPersonLoader } from '../avatar/meta-person-loader';
import { AudioEngine } from '../audio/audio-engine';
import { ElevenAgentsSpeechBackend } from '../audio/speech-backend';
import { HeadMicroMovements } from '../realism/head-micro-movements';
import { GazeSaccades } from '../realism/gaze-saccades';
import { EmbedBridge } from '../prod/embed-bridge';
import { TelemetryManager } from '../prod/telemetry';
import { TypedEventBus } from './events';
import { AppEvents, AppServices } from './app-types';
import { SettingsStore } from './store/settings-store';
import { attachLegacyBridge } from './store/legacy-bridge';
import { createUiMode } from './ui-mode';
import { ConversationController } from '../features/conversation-controller';
import { AnimationController } from '../features/animation-controller';
import { TelemetryController } from '../features/telemetry-controller';
import { SceneController } from '../features/scene-controller';
import { LastTurnBuffer } from '../features/last-turn-buffer';
import { CompareController } from '../features/compare-controller';
import { ScenePresetController, ScenePresetHost } from '../features/scene-preset-controller';
import { createDefaultAnimationSources } from '../lipsync/animation-sources';
import { createToast } from '../ui/shared/toast';
import { createLoader } from '../ui/shared/loader';
import { createModal } from '../ui/shared/modal';
import { el } from '../ui/shared/dom';
import { PanelContext, PanelRegistry, PanelUi } from '../ui/studio/panel-registry';
import { createStudioShell, StudioShell } from '../ui/studio/studio-shell';
import { createAnimationPanel } from '../ui/studio/panels/animation-panel';
import { createVisemesPanel } from '../ui/studio/panels/visemes-panel';
import { createInspectorPanel } from '../ui/studio/panels/inspector-panel';
import { createA2fPanel } from '../ui/studio/panels/a2f-panel';
import { createSessionPanel } from '../ui/studio/panels/session-panel';
import { createScenePanel } from '../ui/studio/panels/scene-panel';
import { createConversationDock } from '../ui/user/conversation-dock';
import { createStatusPill } from '../ui/user/status-pill';
import { createCaptions } from '../ui/user/captions';
import { createAlgorithmSwitcher } from '../ui/user/algorithm-switcher';
import { createUserSettings } from '../ui/user/user-settings';

export interface AppHandle {
  readonly services: AppServices;
  readonly store: SettingsStore;
  readonly ui: PanelUi;
  readonly shell: StudioShell;
  start(): void;
  dispose(): void;
}

export function createApp(canvas: HTMLCanvasElement): AppHandle {
  // ---- Core 3D + światło/środowisko (docs/5)
  const renderer = new AppRenderer({ canvas });
  const camera = new AppCamera(canvas);
  const scene = new AppScene();
  const lighting = new StudioLighting();
  lighting.addToScene(scene.instance);
  const environment = new EnvironmentManager(renderer.instance);
  environment.setupRoomEnvironment(scene.instance);
  const loader = new MetaPersonLoader();
  const headMicro = new HeadMicroMovements();
  const gaze = new GazeSaccades();

  // ---- Audio + mowa
  const audioEngine = new AudioEngine();
  const speechBackend = new ElevenAgentsSpeechBackend(audioEngine);
  const embedBridge = new EmbedBridge();

  // ---- Stan (F11): store + mirror legacy + tryb UI
  const store = new SettingsStore(localStorage);
  const unsubLegacyBridge = attachLegacyBridge(store, localStorage);
  const uiMode = createUiMode(store, { search: window.location.search, body: document.body });
  const unsubUiModeShortcut = uiMode.attachShortcut(window);

  // Motyw i głośność z profilu — również przy zmianach ze store (panel Sesja, import).
  const applyAppearance = (): void => {
    document.body.classList.toggle('theme-light', store.getEffective<'dark' | 'light'>('theme') === 'light');
    audioEngine.masterGain.gain.setValueAtTime(
      store.getEffective<number>('volume'),
      audioEngine.ctx.currentTime
    );
  };
  applyAppearance();
  const unsubStore = store.subscribe(() => applyAppearance());

  // ---- Bus + telemetria + shared UI
  const events = new TypedEventBus<AppEvents>();
  const telemetryManager = new TelemetryManager();

  const hostRoot = document.getElementById('ui-root') ?? document.getElementById('app') ?? document.body;
  hostRoot.append(el('div', { className: 'vignette-overlay' }));
  const toast = createToast(hostRoot);
  const loaderUi = createLoader(hostRoot);
  const modal = createModal(hostRoot);
  const unsubToast = events.on('toast', (payload) => toast.show(payload.message, payload.type));
  // Loader znika, gdy awatar jest gotowy — również w ścieżce fallbacku (demo avatar),
  // bo `loadDefaultAvatar()` emituje `avatar:loaded` w obu przypadkach.
  // Bez tego `hide()` nie był wołany nigdzie i pływający wskaźnik wisiał na ekranie na zawsze.
  const unsubAvatarLoaded = events.on('avatar:loaded', () => loaderUi.hide());

  const ui: PanelUi = { toast, loader: loaderUi, modal };

  // ---- Kontrolery
  const sceneController = new SceneController({
    renderer,
    camera,
    scene,
    lighting,
    environment,
    loader,
    headMicro,
    gaze,
    events,
  });
  const conversationController = new ConversationController({
    speechBackend,
    audioEngine,
    embedBridge,
    events,
  });
  const animationController = new AnimationController({
    audioEngine,
    events,
    store,
    speak: (text) => speechBackend.triggerDemoSpeech(text),
  });
  const telemetryController = new TelemetryController(telemetryManager, events);

  // ---- Porównywarka A/B (F11): bufor ostatniej tury + rejestr źródeł
  const lastTurnBuffer = new LastTurnBuffer({ events });
  const animationSources = createDefaultAnimationSources();
  const compareController = new CompareController({
    buffer: lastTurnBuffer,
    audioEngine,
    getFaceController: () => animationController.getFaceController(),
    getA2fUrl: () => store.getEffective<string>('a2fUrl'),
    events,
  });

  // ---- Presety sceny (F11): host mutuje światła/scenę/renderer/kamerę
  const scenePresetHost: ScenePresetHost = {
    key: lighting.keyLight,
    fill: lighting.fillLight,
    rim: lighting.rimLight,
    ambient: lighting.ambientLight,
    setBackgroundColor: (hex) => scene.setBackgroundColor(hex),
    setGradientBackground: (from, to) => scene.setGradientBackground(from, to),
    setPedestal: (visible) => scene.setPedestal(visible),
    setFraming: (framing) => camera.setFraming(framing, sceneController.getFaceY()),
    getExposure: () => renderer.instance.toneMappingExposure,
    setExposure: (value) => {
      renderer.instance.toneMappingExposure = value;
    },
  };
  const scenePresetController = new ScenePresetController({
    host: scenePresetHost,
    store,
    events,
  });

  const services: AppServices = {
    conversation: conversationController,
    animation: animationController,
    telemetry: telemetryController,
    scene: sceneController,
    animationSources,
    compare: compareController,
    lastTurn: { hasTurn: () => lastTurnBuffer.hasTurn() },
    scenePresets: {
      apply: (id) => scenePresetController.apply(id),
      list: () => scenePresetController.list().map((preset) => ({ id: preset.id, label: preset.label })),
      getCurrentId: () => scenePresetController.getCurrentId(),
    },
  };

  // Urządzenie mikrofonu z profilu (F11) — stosowane przy starcie capture i przy zmianie.
  const applyInputDevice = (): void => {
    conversationController.setInputDevice(store.getEffective<string | null>('micDeviceId'));
  };
  applyInputDevice();
  const unsubMic = store.subscribe(() => applyInputDevice());
  const unsubSceneTheme = store.subscribe((state) => scenePresetController.onThemeChange(state.user.theme));
  const unsubSceneAttr = events.on('scene:preset', (id) => {
    document.body.setAttribute('data-scene', id);
  });
  // Po załadowaniu awatara ponownie zastosuj kadr presetu (SceneController ustawia własny bust).
  const unsubSceneReload = events.on('avatar:loaded', () => {
    scenePresetController.apply(scenePresetController.getCurrentId());
  });

  // ---- Panele studia (rejestr + shell)
  const registry = new PanelRegistry();
  registry.register(createAnimationPanel());
  registry.register(createVisemesPanel());
  registry.register(createInspectorPanel());
  registry.register(createA2fPanel());
  registry.register(createSessionPanel());
  registry.register(createScenePanel());

  const contextFactory = (panelContainer: HTMLElement): PanelContext => ({
    store,
    events,
    services,
    ui,
    container: panelContainer,
  });

  // ---- Panele warstwy user (zawsze zamontowane) + studio shell
  const userHost = el('div', { className: 'user-layer' });
  hostRoot.append(userHost);
  registry.register(createStatusPill());
  registry.register(createConversationDock());
  registry.register(createCaptions());
  registry.register(createAlgorithmSwitcher());
  registry.register(createUserSettings());
  for (const panel of registry.list('user')) {
    registry.mount(panel.id, contextFactory(userHost));
  }

  const shell = createStudioShell({ registry, contextFactory, host: hostRoot });

  // Studio otwiera się automatycznie w trybie studio (odświeżane przy starcie).
  if (uiMode.getMode() === 'studio') {
    shell.open();
  }

  // ---- Globalne listenery (tylko composition root)
  const onPointerMove = (event: PointerEvent): void => {
    const normX = (event.clientX / window.innerWidth) * 2 - 1;
    const normY = -((event.clientY / window.innerHeight) * 2 - 1);
    sceneController.pointerMove(normX, normY);
  };
  window.addEventListener('pointermove', onPointerMove);

  const onResize = (): void => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.onResize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);

  // ---- Tryb prezentacji (H/Esc) — jeden globalny handler klawiatury w src/app
  const exitPresentation = el('button', {
    className: 'btn-exit-presentation hidden',
    type: 'button',
    text: '👁️ Pokaż Panel Sterowania',
    ariaLabel: 'Pokaż interfejs',
  });
  hostRoot.append(exitPresentation);
  let presentation = false;
  const setPresentation = (value: boolean): void => {
    presentation = value;
    document.body.classList.toggle('presentation-mode', value);
    exitPresentation.classList.toggle('hidden', !value);
  };
  exitPresentation.addEventListener('click', () => setPresentation(false));

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return;
    if (event.key === 'Escape' || event.key === 'h' || event.key === 'H') {
      setPresentation(!presentation);
    }
  };
  window.addEventListener('keydown', onKeydown);

  // ---- Pętla render
  let lastTimestamp = performance.now();
  let rafId = 0;
  let frameCount = 0;
  let fpsWindowStart = performance.now();
  const animate = (timestamp: number): void => {
    rafId = requestAnimationFrame(animate);
    const deltaMs = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    const dt = Math.min(0.1, deltaMs / 1000);

    sceneController.update(dt, timestamp);
    animationController.update(dt);
    scenePresetController.update(dt);

    // FPS dla telemetrii — okno 500 ms.
    frameCount += 1;
    const elapsed = timestamp - fpsWindowStart;
    if (elapsed >= 500) {
      const fps = Math.round((frameCount * 1000) / elapsed);
      telemetryManager.updateFps(fps, deltaMs);
      frameCount = 0;
      fpsWindowStart = timestamp;
    }
  };

  return {
    services,
    store,
    ui,
    shell,
    start(): void {
      applyInputDevice();
      scenePresetController.apply(store.getEffective<string>('scenePreset'));
      loaderUi.show('Ładowanie zrigowanego modelu MetaPerson 3D...');
      sceneController.loadDefaultAvatar();
      rafId = requestAnimationFrame(animate);
      embedBridge.notifyReady();
      console.log('Aplikacja Avatar zainicjalizowana pomyślnie.');
    },
    dispose(): void {
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeydown);
      unsubToast();
      unsubStore();
      unsubMic();
      unsubAvatarLoaded();
      unsubUiModeShortcut();
      unsubLegacyBridge();
      unsubSceneTheme();
      unsubSceneAttr();
      unsubSceneReload();
      shell.destroy();
      compareController.dispose();
      lastTurnBuffer.dispose();
      scenePresetController.dispose();
      animationController.dispose();
      telemetryController.dispose();
      toast.destroy();
      loaderUi.destroy();
      modal.destroy();
      environment.dispose();
      loader.dispose();
    },
  };
}

/** Re-eksport dla komponentów (11-06). */
export type { AppEvents, AppServices } from './app-types';
