/**
 * Composition root (Phase 11, 11-04): scene, audio, controllers, bus, shared UI,
 * panel registry and StudioShell. `main.ts` remains a thin bootstrap.
 */
import { AppRenderer } from '../core/renderer';
import { AdaptiveResolution } from '../core/adaptive-resolution';
import { AppCamera } from '../core/camera';
import { AppScene } from '../core/scene';
import { StudioLighting } from '../scene/lighting';
import { EnvironmentManager } from '../scene/environment';
import { MetaPersonLoader } from '../avatar/meta-person-loader';
import { AudioEngine } from '../audio/audio-engine';
import { ElevenAgentsSpeechBackend } from '../audio/speech-backend';
import { resolveAgentId } from '../audio/agent-config';
import { HeadMicroMovements } from '../realism/head-micro-movements';
import { GazeSaccades } from '../realism/gaze-saccades';
import { ANIM_DEFAULTS } from '../realism/anim-config';
import { EmbedBridge } from '../prod/embed-bridge';
import { TelemetryManager } from '../prod/telemetry';
import { TypedEventBus } from './events';
import { t } from './copy';
import { AppEvents, AppServices } from './app-types';
import { SettingsStore } from './store/settings-store';
import { attachLegacyBridge } from './store/legacy-bridge';
import { createUiMode, isEditableTarget } from './ui-mode';
import { ConversationController } from '../features/conversation-controller';
import { AnimationController } from '../features/animation-controller';
import { TelemetryController } from '../features/telemetry-controller';
import { SceneController } from '../features/scene-controller';
import { LastTurnBuffer } from '../features/last-turn-buffer';
import { CompareController } from '../features/compare-controller';
import { ScenePresetController, ScenePresetHost } from '../features/scene-preset-controller';
import { createDefaultAnimationSources } from '../lipsync/animation-sources';
import { createConnectionBanner } from '../ui/user/connection-banner';
import { createToast } from '../ui/shared/toast';
import { createLoader } from '../ui/shared/loader';
import { createModal } from '../ui/shared/modal';
import { el } from '../ui/shared/dom';
import { icon } from '../ui/shared/icons';
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
  // ---- Core 3D + lighting/environment (docs/5)
  const renderer = new AppRenderer({ canvas });
  const camera = new AppCamera(canvas);
  const scene = new AppScene();
  const lighting = new StudioLighting();
  lighting.addToScene(scene.instance);
  const environment = new EnvironmentManager(renderer.instance);
  environment.setupSoftboxEnvironment(scene.instance);
  const loader = new MetaPersonLoader();
  const headMicro = new HeadMicroMovements();
  const gaze = new GazeSaccades();

  // ---- Audio + speech
  const audioEngine = new AudioEngine();
  const embedBridge = new EmbedBridge();

  // ---- Stan (F11): store + mirror legacy + tryb UI
  const store = new SettingsStore(localStorage);
  const unsubLegacyBridge = attachLegacyBridge(store, localStorage);
  const speechBackend = new ElevenAgentsSpeechBackend(audioEngine, () => resolveAgentId(store.getEffective<string>('agentId')).id);
  const uiMode = createUiMode(store, { search: window.location.search, body: document.body });
  const unsubUiModeShortcut = uiMode.attachShortcut(window);

  // Theme and volume from the profile — also on store changes (Session panel, import).
  const applyAppearance = (): void => {
    document.body.classList.toggle('theme-light', store.getEffective<'dark' | 'light'>('theme') === 'light');
    audioEngine.masterGain.gain.setValueAtTime(store.getEffective<number>('volume'), audioEngine.ctx.currentTime);
  };
  applyAppearance();
  const unsubStore = store.subscribe(() => applyAppearance());

  // ---- Bus + telemetry + shared UI
  const events = new TypedEventBus<AppEvents>();
  const telemetryManager = new TelemetryManager();

  const hostRoot = document.getElementById('ui-root') ?? document.getElementById('app') ?? document.body;
  const vignette = el('div', { className: 'vignette-overlay' });
  hostRoot.append(vignette);
  const toast = createToast(hostRoot);
  // The retry of an avatar load failure falls back to the synchronous demo avatar (known good).
  const loaderUi = createLoader(hostRoot, {
    onRetry: () => sceneController.loadDemo(),
    retryLabel: t('errors.avatarRetry'),
  });
  const modal = createModal(hostRoot);
  const unsubToast = events.on('toast', (payload) => toast.show(payload.message, payload.type));
  // The loader disappears when the avatar is ready — also on the fallback path (demo avatar),
  // because `loadDefaultAvatar()` emits `avatar:loaded` in both cases.
  // Without this `hide()` was never called and the floating indicator stayed on screen forever.
  let avatarReady = false;
  const unsubAvatarLoaded = events.on('avatar:loaded', () => {
    avatarReady = true;
    loaderUi.hide();
  });
  const unsubAvatarProgress = events.on('avatar:progress', ({ fraction }) => {
    if (avatarReady) return;
    loaderUi.show(fraction === null ? t('loader.avatar') : t('loader.avatarProgress', { percent: Math.round(fraction * 100) }));
  });
  // S1: a double failure keeps the loader pill visible as an error with a retry (demo avatar), no dead end.
  const unsubAvatarError = events.on('avatar:error', () => {
    avatarReady = true;
    loaderUi.error(t('errors.avatarBody'));
  });

  const ui: PanelUi = { toast, loader: loaderUi, modal };

  // ---- Controllers
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

  // Gaze: the scene computes the weights, FaceController applies them (single morph writer);
  // an A2F clip that carries its own eyes switches off the procedural eyes (morphs AND bones).
  animationController.setGazeProvider(() => sceneController.getGazeWeights());
  sceneController.setProceduralEyesGate(() => animationController.getFaceController()?.areProceduralEyesActive() ?? true);

  // ---- A/B comparison (F11): last-turn buffer + source registry
  const lastTurnBuffer = new LastTurnBuffer({ events });
  const animationSources = createDefaultAnimationSources();
  const compareController = new CompareController({
    buffer: lastTurnBuffer,
    audioEngine,
    getFaceController: () => animationController.getFaceController(),
    getA2fUrl: () => store.getEffective<string>('a2fUrl'),
    events,
  });

  // ---- Scene presets (F11): the host mutates lights/scene/renderer/camera
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
    uiMode,
  };

  // Microphone device from the profile (F11) — applied at capture start and on change.
  const applyInputDevice = (): void => {
    conversationController.setInputDevice(store.getEffective<string | null>('micDeviceId'));
  };
  applyInputDevice();
  const unsubMic = store.subscribe(() => applyInputDevice());
  const unsubSceneTheme = store.subscribe((state) => scenePresetController.onThemeChange(state.user.theme));
  const unsubSceneAttr = events.on('scene:preset', (id) => {
    document.body.setAttribute('data-scene', id);
  });
  // After the avatar loads, re-apply the preset framing (SceneController sets its own bust).
  const unsubSceneReload = events.on('avatar:loaded', () => {
    scenePresetController.apply(scenePresetController.getCurrentId());
  });

  // ---- Studio panels (registry + shell)
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

  // ---- User-layer panels (always mounted) + studio shell
  const userHost = el('div', { className: 'user-layer' });
  hostRoot.append(userHost);
  registry.register(createStatusPill());
  registry.register(createConversationDock());
  registry.register(createCaptions());
  registry.register(createConnectionBanner());
  registry.register(createAlgorithmSwitcher());
  registry.register(createUserSettings());
  for (const panel of registry.list('user')) {
    registry.mount(panel.id, contextFactory(userHost));
  }

  const shell = createStudioShell({ registry, contextFactory, host: hostRoot });

  // The studio opens automatically in studio mode (refreshed at start) and follows later mode switches
  // (Ctrl+Shift+D, Settings toggle). Subscribing here keeps ui-mode.ts untouched.
  if (uiMode.getMode() === 'studio') {
    shell.open();
  }
  let shellMode = uiMode.getMode();
  const unsubUiModeShell = store.subscribe(() => {
    const next = uiMode.getMode();
    if (next === shellMode) return;
    shellMode = next;
    if (next === 'studio') shell.open();
    else shell.close();
  });

  // ---- Global listeners (composition root only)
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

  // ---- Presentation mode (H/Esc) — a single global keyboard handler in src/app
  const exitPresentation = el(
    'button',
    {
      className: 'btn-exit-presentation hidden',
      type: 'button',
      ariaLabel: t('presentation.showAria'),
    },
    [icon('eye'), el('span', { className: 'btn-label', text: t('presentation.show') })]
  );
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
    if (isEditableTarget(event.target)) return;
    // A11: Esc belongs to an open dialog (native close) — it must not also flip presentation mode.
    if (document.querySelector('dialog[open]')) return;
    if (event.key === 'Escape' || event.key === 'h' || event.key === 'H') {
      setPresentation(!presentation);
    }
  };
  window.addEventListener('keydown', onKeydown);

  // ---- Render loop
  let lastTimestamp = performance.now();
  let rafId = 0;
  let disposed = false;
  let frameCount = 0;
  let fpsWindowStart = performance.now();
  const adaptiveRes = AdaptiveResolution.create(renderer.maxPixelRatio);
  const animate = (timestamp: number): void => {
    rafId = requestAnimationFrame(animate);
    const deltaMs = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    const dt = Math.min(ANIM_DEFAULTS.frame.dtCapSec, deltaMs / 1000);

    // Face morphs first, so renderer.render (inside sceneController.update) draws this frame's pose.
    animationController.update(dt);
    sceneController.update(dt, timestamp);
    scenePresetController.update(dt);

    // FPS for telemetry — 500 ms window.
    frameCount += 1;
    const elapsed = timestamp - fpsWindowStart;
    if (elapsed >= 500) {
      const fps = Math.round((frameCount * 1000) / elapsed);
      telemetryManager.updateFps(fps, deltaMs);
      if (!document.hidden) {
        const nextRatio = adaptiveRes.update(fps, timestamp);
        if (nextRatio !== null) renderer.setPixelRatio(nextRatio);
      }
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
      loaderUi.show(t('loader.avatar'));
      sceneController.loadDefaultAvatar();
      rafId = requestAnimationFrame(animate);
      embedBridge.notifyReady();
      // eslint-disable-next-line no-console -- trace log, not a diagnostic: kept as console.log on purpose (warn/error are the diagnostic channels)
      console.log('Avatar application initialized successfully.');
    },
    dispose(): void {
      if (disposed) return; // idempotent: a second call must not release anything twice
      disposed = true;
      // End the session first (WSS closed, mic stopped) while the bus still has its listeners.
      conversationController.dispose();
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeydown);
      unsubToast();
      unsubStore();
      unsubMic();
      unsubAvatarLoaded();
      unsubAvatarProgress();
      unsubAvatarError();
      unsubUiModeShortcut();
      unsubUiModeShell();
      unsubLegacyBridge();
      unsubSceneTheme();
      unsubSceneAttr();
      unsubSceneReload();
      embedBridge.dispose();
      // Closes the AudioContext (created by AudioEngine in this function), exactly once.
      audioEngine.dispose();
      vignette.remove();
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
      renderer.dispose();
    },
  };
}

/** Re-export for components (11-06). */
export type { AppEvents, AppServices } from './app-types';
