// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/core/renderer', () => ({
  AppRenderer: class {
    instance = { render: vi.fn(), toneMappingExposure: 1 };
    setSize = vi.fn();
    dispose = vi.fn();
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
    },
  };
});
vi.mock('../src/scene/environment', () => ({
  EnvironmentManager: class {
    setupRoomEnvironment = vi.fn();
    dispose = vi.fn();
  },
}));
vi.mock('../src/scene/materials', () => ({ enhanceAvatarMaterials: vi.fn() }));
vi.mock('../src/avatar/meta-person-loader', async () => {
  const THREE = await import('three');
  return {
    MetaPersonLoader: class {
      load = vi.fn(async () => ({
        root: new THREE.Group(),
        faceDriver: { listAvailableShapes: () => [] },
        speechMeshes: [],
        morphTargetDictionary: {},
      }));
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
    ctx = { currentTime: 0, resume: vi.fn() };
    masterGain = { gain: { setValueAtTime: vi.fn() } };
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
    applyToDriver = vi.fn();
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
  });

  it('składa aplikację i rejestruje 6 paneli w shellu', () => {
    const app = createApp(setupDom());

    expect(app.services.conversation).toBeDefined();
    expect(app.services.animation).toBeDefined();
    expect(app.services.telemetry).toBeDefined();
    expect(app.services.scene).toBeDefined();

    expect(document.querySelector('.studio-shell')).not.toBeNull();
    expect(document.querySelectorAll('.studio-tab')).toHaveLength(4);
    expect(document.querySelectorAll('.studio-left-toggle')).toHaveLength(2);
  });

  it('start() nie rzuca; ładowanie awatara kończy się danymi w panelu Scena', async () => {
    const app = createApp(setupDom());
    expect(() => app.start()).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Panel Scena montujemy ręcznie (lazy tab) i sprawdzamy info o modelu.
    app.shell.openTab('scene');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelector('.panel-scene')?.textContent).toContain('MetaPerson Rigged Avatar');
  });

  it('store steruje motywem (subskrypcja w kontenerze)', () => {
    const app = createApp(setupDom());
    app.store.setUser('theme', 'light');
    expect(document.body.classList.contains('theme-light')).toBe(true);
    app.store.setUser('theme', 'dark');
    expect(document.body.classList.contains('theme-light')).toBe(false);
  });

  it('dispose() usuwa shell i nie rzuca', () => {
    const app = createApp(setupDom());
    app.start();
    expect(() => app.dispose()).not.toThrow();
    expect(document.querySelector('.studio-shell')).toBeNull();
  });
});
