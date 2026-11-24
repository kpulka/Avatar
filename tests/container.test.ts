// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defined } from './helpers/defined';

// Instances the container creates, captured so the lifecycle regression can inspect them (14-03).
const created = vi.hoisted(() => ({
  buses: [] as Array<{ handlerCount(): number }>,
  renderers: [] as Array<{ dispose: ReturnType<typeof vi.fn> }>,
  audioEngines: [] as Array<{ ctx: { close: ReturnType<typeof vi.fn> } }>,
  speechBackends: [] as Array<{ stop: ReturnType<typeof vi.fn> }>,
}));

vi.mock('../src/app/events', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/app/events')>();
  class TrackedBus<E extends Record<string, unknown>> extends actual.TypedEventBus<E> {
    constructor() {
      super();
      created.buses.push(this);
    }
  }
  return { ...actual, TypedEventBus: TrackedBus };
});
vi.mock('../src/core/renderer', () => ({
  AppRenderer: class {
    instance = { render: vi.fn(), toneMappingExposure: 1 };
    maxPixelRatio = 2;
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    dispose = vi.fn();
    constructor() {
      created.renderers.push(this);
    }
  },
}));
vi.mock('../src/core/camera', () => ({
  AppCamera: class {
    instance = { position: { set: vi.fn(), x: 0, y: 0, z: 1.22 }, aspect: 1, updateProjectionMatrix: vi.fn() };
    controls = { target: { set: vi.fn() }, update: vi.fn() };
    update = vi.fn();
    onResize = vi.fn();
    setFraming = vi.fn();
  },
}));
vi.mock('../src/core/scene', () => ({
  AppScene: class {
    instance = { add: vi.fn() };
    avatarContainer = { add: vi.fn() };
    setAvatar = vi.fn();
    setPedestal = vi.fn();
    setBackgroundColor = vi.fn();
    setGradientBackground = vi.fn();
  },
}));
vi.mock('../src/scene/lighting', async () => {
  const THREE = await import('three');
  return {
    StudioLighting: class {
      keyLight = { intensity: 2.2, color: new THREE.Color(0xfff2e0) };
      fillLight = { intensity: 0.7, color: new THREE.Color(0xdbe9ff) };
      rimLight = { intensity: 2.6, color: new THREE.Color(0xffe8d6) };
      ambientLight = { intensity: 0.15 };
      addToScene = vi.fn();
      focusOn = vi.fn();
    },
  };
});
vi.mock('../src/scene/environment', () => ({
  EnvironmentManager: class {
    setupSoftboxEnvironment = vi.fn();
    dispose = vi.fn();
  },
}));
vi.mock('../src/scene/materials', () => ({ enhanceAvatarMaterials: vi.fn() }));
vi.mock('../src/avatar/meta-person-loader', async () => {
  const THREE = await import('three');
  return {
    MetaPersonLoader: class {
      load = vi.fn(async () => {
        if ((globalThis as { __failAvatarLoad?: boolean }).__failAvatarLoad) throw new Error('avatar.glb missing');
        return {
        root: new THREE.Group(),
        faceDriver: { listAvailableShapes: () => [] },
        speechMeshes: [],
        morphTargetDictionary: {},
        };
      });
      dispose = vi.fn();
    },
  };
});
vi.mock('../src/avatar/test-avatar-generator', async () => {
  const THREE = await import('three');
  return {
    createTestAvatar: vi.fn(() => ({
      root: new THREE.Group(),
      faceDriver: { listAvailableShapes: () => [] },
      speechMeshes: [],
      morphTargetDictionary: {},
    })),
  };
});
vi.mock('../src/audio/audio-engine', () => ({
  AudioEngine: class {
    ctx = { currentTime: 0, resume: vi.fn(), close: vi.fn(async () => undefined) };
    masterGain = { gain: { setValueAtTime: vi.fn() } };
    constructor() {
      created.audioEngines.push(this);
    }
    playChunk = vi.fn(() => 0);
    hardStop = vi.fn();
    getEpoch = vi.fn(() => 0);
    getTailTime = vi.fn(() => 0);
    getActiveNodesCount = vi.fn(() => 0);
    unlock = vi.fn(async () => undefined);
  },
}));
vi.mock('../src/audio/speech-backend', () => ({
  ElevenAgentsSpeechBackend: class {
    constructor() {
      created.speechBackends.push(this);
    }
    onAudioChunk = vi.fn();
    onInterruption = vi.fn();
    onUserTranscript = vi.fn();
    onAgentResponse = vi.fn();
    onStateChange = vi.fn();
    start = vi.fn(async () => undefined);
    stop = vi.fn(async () => undefined);
    setMuted = vi.fn();
    getIsMuted = vi.fn(() => false);
    getIsRunning = vi.fn(() => false);
    triggerDemoSpeech = vi.fn();
    triggerInterruption = vi.fn();
    getAudioEngine = vi.fn();
    getOutputSampleRate = vi.fn(() => 16000);
    setInputDevice = vi.fn();
    listInputDevices = vi.fn(async () => []);
  },
}));
vi.mock('../src/prod/embed-bridge', () => ({
  EmbedBridge: class {
    setCallbacks = vi.fn();
    notifyStateChange = vi.fn();
    notifyTranscript = vi.fn();
    notifyReady = vi.fn();
  },
}));
vi.mock('../src/prod/telemetry', () => ({
  TelemetryManager: class {
    markUtteranceRequested = vi.fn();
    markFirstAudioChunk = vi.fn();
    recordAlignmentChunk = vi.fn();
    recordBargeIn = vi.fn();
    recordA2fRequest = vi.fn();
    updateFps = vi.fn();
    getReport = vi.fn(() => ({
      sessionDurationSec: 0,
      fps: 60,
      frameTimeMs: 16,
      ttfbMs: null,
      bargeInCount: 0,
      jitterEvents: 0,
    }));
    getFormattedSessionDuration = vi.fn(() => '00:00');
    getAlignmentStats = vi.fn(() => ({ elevenlabs: 0, fallback: 0 }));
  },
}));
vi.mock('../src/realism/head-micro-movements', () => ({ HeadMicroMovements: class { reset = vi.fn(); update = vi.fn(); } }));
vi.mock('../src/realism/gaze-saccades', () => ({
  GazeSaccades: class {
    setPointer = vi.fn();
    compute = vi.fn(() => null);
    applyToEyeObjects = vi.fn();
  },
}));

import { createApp } from '../src/app/container';
import { createMemoryStorage } from './helpers/memory-storage';

function setupDom(): HTMLCanvasElement {
  document.body.innerHTML = '<div id="app"><div id="ui-root"></div></div>';
  return document.createElement('canvas');
}

describe('createApp (container smoke, jsdom)', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('localStorage', createMemoryStorage());
    created.buses.length = 0;
    created.renderers.length = 0;
    created.audioEngines.length = 0;
    created.speechBackends.length = 0;
  });

  it('assembles the app and registers 6 panels in the shell', () => {
    const app = createApp(setupDom());

    expect(app.services.conversation).toBeDefined();
    expect(app.services.animation).toBeDefined();
    expect(app.services.telemetry).toBeDefined();
    expect(app.services.scene).toBeDefined();

    expect(document.querySelector('.studio-shell')).not.toBeNull();
    expect(document.querySelectorAll('.studio-tab')).toHaveLength(4);
    expect(document.querySelectorAll('.studio-left-toggle')).toHaveLength(2);
  });

  it('start() does not throw; avatar loading ends with data in the Scene panel', async () => {
    const app = createApp(setupDom());
    expect(() => app.start()).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Mount the Scene panel manually (lazy tab) and check the model info.
    app.shell.openTab('scene');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelector('.panel-scene')?.textContent).toContain('MetaPerson Rigged Avatar');
  });

  it('store drives the theme (subscription in the container)', () => {
    const app = createApp(setupDom());
    app.store.setUser('theme', 'light');
    expect(document.body.classList.contains('theme-light')).toBe(true);
    app.store.setUser('theme', 'dark');
    expect(document.body.classList.contains('theme-light')).toBe(false);
  });

  it('Esc with an open dialog does not toggle presentation mode (15-04, A10); h works', () => {
    const app = createApp(setupDom());
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.append(dialog);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.body.classList.contains('presentation-mode')).toBe(false);

    dialog.remove();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.body.classList.contains('presentation-mode')).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
    expect(document.body.classList.contains('presentation-mode')).toBe(false);
    app.dispose();
  });

  it('double avatar load failure: loader shows an error with retry (demo), no dead end (15-05, S1)', async () => {
    const { createTestAvatar } = await import('../src/avatar/test-avatar-generator');
    (globalThis as { __failAvatarLoad?: boolean }).__failAvatarLoad = true;
    vi.mocked(createTestAvatar).mockImplementationOnce(() => {
      throw new Error('demo failed');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const app = createApp(setupDom());
      app.start();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const loader = document.querySelector('.loader-overlay') as HTMLElement;
      expect(loader.classList.contains('hidden')).toBe(false);
      expect(loader.classList.contains('loader-error')).toBe(true);
      const retry = loader.querySelector('button.loader-retry') as HTMLButtonElement;
      expect(retry.classList.contains('hidden')).toBe(false);
      retry.click(); // retry = demo avatar (createTestAvatar works again)
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(loader.classList.contains('hidden')).toBe(true);
      expect(loader.classList.contains('loader-error')).toBe(false);
      app.dispose();
    } finally {
      delete (globalThis as { __failAvatarLoad?: boolean }).__failAvatarLoad;
    }
  });

  it('Ctrl+Shift+D toggles the mode and opens/closes the studio shell (15-06)', () => {
    const app = createApp(setupDom());
    const shellEl = document.querySelector('.studio-shell') as HTMLElement;
    expect(shellEl.classList.contains('hidden')).toBe(true);
    const press = (): void => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', ctrlKey: true, shiftKey: true }));
    };
    press();
    expect(document.body.getAttribute('data-mode')).toBe('studio');
    expect(shellEl.classList.contains('hidden')).toBe(false);
    expect(app.shell.isOpen()).toBe(true);
    press();
    expect(document.body.getAttribute('data-mode')).toBe('user');
    expect(app.shell.isOpen()).toBe(false);
    app.dispose();
  });

  it('dispose() leaves zero bus handlers and releases session, renderer and audio context exactly once (14-03)', async () => {
    const app = createApp(setupDom());
    app.start();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const bus = defined(created.buses[0], 'the container bus');
    const renderer = defined(created.renderers[0], 'the renderer');
    const audio = defined(created.audioEngines[0], 'the audio engine');
    const speech = defined(created.speechBackends[0], 'the speech backend');

    // Precondition: the app really subscribed (the assertion below cannot pass on an empty bus).
    expect(bus.handlerCount()).toBeGreaterThan(0);

    app.dispose();
    expect(bus.handlerCount()).toBe(0);
    expect(speech.stop).toHaveBeenCalledTimes(1);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(audio.ctx.close).toHaveBeenCalledTimes(1);

    // Idempotent: a second dispose neither throws nor releases anything again.
    expect(() => app.dispose()).not.toThrow();
    expect(bus.handlerCount()).toBe(0);
    expect(speech.stop).toHaveBeenCalledTimes(1);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(audio.ctx.close).toHaveBeenCalledTimes(1);
  });

  it('a subscription added without an Unsub would be caught: handlerCount sees it after dispose', () => {
    const app = createApp(setupDom());
    const bus = defined(created.buses[0], 'the container bus') as unknown as {
      on(type: string, handler: () => void): () => void;
      handlerCount(): number;
    };
    bus.on('toast', () => undefined); // the bug this regression guards against: no Unsub collected
    app.dispose();
    expect(bus.handlerCount()).toBe(1);
  });

  it('dispose() removes the shell and does not throw', () => {
    const app = createApp(setupDom());
    app.start();
    expect(() => app.dispose()).not.toThrow();
    expect(document.querySelector('.studio-shell')).toBeNull();
  });
});
