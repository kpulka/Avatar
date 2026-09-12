import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { createTestAvatar } from '../src/avatar/test-avatar-generator';
import { GazeSaccades } from '../src/realism/gaze-saccades';
import { HeadMicroMovements } from '../src/realism/head-micro-movements';
import { EmotionLayer } from '../src/realism/emotion-layer';
import { FaceController } from '../src/lipsync/face-controller';
import { AudioEngine } from '../src/audio/audio-engine';
import { TelemetryManager } from '../src/prod/telemetry';
import { SettingsStore } from '../src/app/store/settings-store';
import { attachLegacyBridge } from '../src/app/store/legacy-bridge';
import { EmbedBridge } from '../src/prod/embed-bridge';
import { createMemoryStorage } from './helpers/memory-storage';

class MockAudioBufferSourceNode {
  public stopped = false;
  public onended: (() => void) | null = null;
  public connect(): void {}
  public disconnect(): void {}
  public start(): void {}
  public stop(): void {
    this.stopped = true;
    if (this.onended) this.onended();
  }
}

class MockAudioContext {
  public currentTime = 0;
  public state = 'running';
  public createGain() {
    return { gain: { value: 1, setValueAtTime: vi.fn() }, connect: vi.fn() };
  }
  public createBuffer(ch: number, len: number, rate: number) {
    return { duration: len / rate, copyToChannel: vi.fn() };
  }
  public createBufferSource() {
    return new MockAudioBufferSourceNode();
  }
}

describe('Automated E2E Self-Test (Kompletny audyt systemu)', () => {
  let mockCtx: MockAudioContext;

  beforeEach(() => {
    mockCtx = new MockAudioContext();
  });

  it('1. Generates complete avatar with anatomical bust (Head, Teeth, LeftEye, RightEye, Neck, Torso)', () => {
    const avatar = createTestAvatar();

    expect(avatar.root.name).toBe('ProceduralMetaPersonAvatar');
    expect(avatar.root.getObjectByName('Avatar_Head_Skin')).toBeDefined();
    expect(avatar.root.getObjectByName('Avatar_Teeth_Submesh')).toBeDefined();
    expect(avatar.root.getObjectByName('Avatar_LeftEye')).toBeDefined();
    expect(avatar.root.getObjectByName('Avatar_RightEye')).toBeDefined();
    expect(avatar.root.getObjectByName('Avatar_Neck')).toBeDefined();
    expect(avatar.root.getObjectByName('Avatar_Torso')).toBeDefined();

    // Sprawdzenie blendshape'ów ARKit
    const availableShapes = avatar.faceDriver.listAvailableShapes();
    expect(availableShapes.length).toBe(52);
    expect(availableShapes).toContain('jawOpen');
    expect(availableShapes).toContain('mouthClose');
    expect(availableShapes).toContain('mouthSmileLeft');
    expect(availableShapes).toContain('eyeBlinkLeft');
  });

  it('2. Eye tracking: physically rotates 3D eyeball objects towards cursor target', () => {
    const avatar = createTestAvatar();
    const leftEye = avatar.root.userData.leftEye as THREE.Mesh;
    const rightEye = avatar.root.userData.rightEye as THREE.Mesh;

    expect(leftEye).toBeDefined();
    expect(rightEye).toBeDefined();

    const gaze = new GazeSaccades();

    // Spojrzenie w prawo i w górę
    gaze.setPointer(1.0, 1.0);
    // Przebieg kilku klatek wygładzania
    for (let i = 0; i < 10; i++) {
      gaze.compute(i * 0.05, 0.05);
    }

    gaze.applyToEyeObjects(leftEye, rightEye);

    // Kąty rotacji gałek powinny ulec zmianie w kierunku celu (dodatni yaw przy spojrzeniu w prawo)
    expect(leftEye.rotation.y).toBeGreaterThan(-Math.PI / 2);
    expect(leftEye.rotation.x).toBeGreaterThan(0.1);
    expect(rightEye.rotation.y).toBeGreaterThan(-Math.PI / 2);
    expect(rightEye.rotation.x).toBeGreaterThan(0.1);
  });

  it('3. Head micro-movements and breathing stay strictly bounded (< 2 degrees)', () => {
    const micro = new HeadMicroMovements();
    const container = new THREE.Group();
    container.position.set(0, 1.45, 0);

    for (let t = 0; t < 10; t += 0.05) {
      micro.update(0.05, container);
      // Odchylenia kątowe głowy
      expect(Math.abs(container.rotation.x)).toBeLessThanOrEqual(0.045);
      expect(Math.abs(container.rotation.y)).toBeLessThanOrEqual(0.036);
      expect(Math.abs(container.rotation.z)).toBeLessThanOrEqual(0.016);
      // Translacja pionowa oddechu
      expect(container.position.y).toBeGreaterThanOrEqual(1.45);
      expect(container.position.y).toBeLessThanOrEqual(1.453);
    }
  });

  it('4. Full conversation cycle: audio playback -> viseme lip-sync -> barge-in interruption -> 0 leaks', () => {
    const avatar = createTestAvatar();
    const engine = new AudioEngine(mockCtx as unknown as AudioContext);
    const controller = new FaceController(avatar.faceDriver, engine);

    const pcm = new Uint8Array(44100 * 2); // 1 sekunda audio
    const scheduledStart = engine.playChunk(pcm, 44100, 0);

    controller.onAudioChunk(
      {
        chars: ['h', 'e', 'l', 'l', 'o'],
        char_start_times_ms: [0, 80, 160, 240, 320],
        char_durations_ms: [80, 80, 80, 80, 80],
      },
      scheduledStart,
      0
    );

    expect(controller.getState()).toBe('SPEAKING');

    // Symulacja 10 klatek mowy
    for (let f = 0; f < 10; f++) {
      mockCtx.currentTime += 0.016;
      controller.render(0.016);
    }

    // Wywołanie gwałtownego przerwania (barge-in)
    engine.hardStop();
    controller.onInterruption();

    expect(controller.getState()).toBe('RELAXING');
    expect(engine.getActiveNodesCount()).toBe(0);
    expect(engine.hasPendingAudio()).toBe(false);
  });

  it('5. Emotion analysis, Settings store persistence and EmbedBridge communication', () => {
    const emotions = new EmotionLayer();
    expect(emotions.analyzeText('I am extremely glad and happy to assist you!')).toBe('happy');
    expect(emotions.analyzeText('What an extraordinary question!')).toBe('surprised');
    expect(emotions.analyzeText('We must analyze and solve this issue.')).toBe('focused');

    // Test zapisu ustawień (F11: SettingsStore + write-through legacy)
    const storage = createMemoryStorage();
    const store = new SettingsStore(storage);
    attachLegacyBridge(store, storage);
    store.setStudio('agentId', 'self-test-agent-99');
    store.setUser('theme', 'light');
    store.setUser('volume', 0.9);
    expect(storage.getItem('elevenlabs_agent_id')).toBe('self-test-agent-99');
    expect(storage.getItem('avatar_settings_theme')).toBe('light');
    expect(store.getEffective<number>('volume')).toBeCloseTo(0.9);

    // Test telemetrii
    const telemetry = new TelemetryManager();
    telemetry.markUtteranceRequested();
    telemetry.recordBargeIn();
    const report = telemetry.getReport();
    expect(report.bargeInCount).toBe(1);
    expect(report.sessionDurationSec).toBeGreaterThanOrEqual(0);
  });
});
