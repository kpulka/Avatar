/**
 * Kontrakty komunikacji aplikacji (Faza 11, 11-02).
 *
 * Podział:
 * - `AppEvents` — zdarzenia STANU na `TypedEventBus` (kontrolery → UI),
 * - `AppServices` — KOMENDY (UI → kontrolery) przez referencje serwisów.
 */
import type * as THREE from 'three';
import { AnimationMode, CharAlignment, FaceDriver, FramesClip } from '../types/avatar';
import { CalibrationPresetName, CalibrationProfile } from '../lipsync/calibration';
import { VisemeOverrideMap } from '../lipsync/viseme-overrides';
import type { AnimationSourceRegistry } from '../lipsync/animation-sources';

export type VoiceState = 'listening' | 'speaking' | 'thinking' | 'idle';

export interface AudioChunkEvent {
  /** Surowy PCM 16-bit LE mono (widok na bufor; konsumenci kopiują jeśli przechowują). */
  bytes: Uint8Array;
  alignment: CharAlignment;
  epoch: number;
  /** Zaplanowany start odtwarzania na osi AudioContext (s). */
  startTime: number;
  /** Rzeczywisty sampleRate wyjścia agenta (per sesja; NIE hardcode). */
  sampleRate: number;
}

export interface A2fStatsEvent {
  source: 'local' | 'cloud' | 'synthetic' | 'voice';
  predictMs?: number;
  frames?: number;
  fps?: number;
  rtf?: number;
}

export interface AvatarLoadedEvent {
  root: THREE.Object3D;
  faceDriver: FaceDriver;
  speechMeshes: number;
  shapesCount: number;
  name: string;
}

export interface CompareResultEvent {
  order: ['live', 'a2f'] | ['a2f', 'live'];
  blind: boolean;
  live: { predictMs?: number; frames?: number };
  a2f: { predictMs?: number; frames?: number; fps?: number; rtf?: number };
  partial?: boolean;
}

export interface AppEvents extends Record<string, unknown> {
  'voice:state': VoiceState;
  'voice:error': string;
  'voice:muted': boolean;
  'transcript:user': string;
  'transcript:agent': string;
  'audio:chunk': AudioChunkEvent;
  'speech:interruption': string;
  'a2f:stats': A2fStatsEvent;
  'toast': { message: string; type: 'error' | 'success' };
  'avatar:loaded': AvatarLoadedEvent;
  'animation:source': AnimationMode;
  'scene:preset': string;
  'compare:state': string;
  'compare:result': CompareResultEvent;
  'compare:cancelled': void;
  'compare:disposed': void;
}

export interface TelemetrySample {
  ttfbMs: number | null;
  bargeInCount: number;
  session: string;
  align: { elevenlabs: number; fallback: number };
  fps: number;
  frameTimeMs: number;
}

export interface ConversationService {
  start(): Promise<void>;
  stop(): Promise<void>;
  toggle(): Promise<void>;
  toggleMute(): void;
  isMuted(): boolean;
  isRunning(): boolean;
  interrupt(): void;
  say(text: string): void;
  setAgent(id: string): void;
  setInputDevice(deviceId: string | null): void;
  listInputDevices(): Promise<Array<{ id: string; label: string }>>;
  runPocStress(): Promise<void>;
}

export interface CompareService {
  run(options?: { blind?: boolean }): Promise<boolean>;
  cancel(reason: string): void;
  canCompare(): boolean;
  getState(): string;
}

export interface LastTurnService {
  hasTurn(): boolean;
}

export interface ScenePresetService {
  apply(id: string): void;
  list(): Array<{ id: string; label: string }>;
  getCurrentId(): string;
}

export interface AnimationService {
  setSource(mode: AnimationMode): void;
  getSource(): AnimationMode;
  demoSpeech(): void;
  runA2fDemo(): Promise<void>;
  testPhrase(lang: 'pl' | 'en'): void;
  testPhoneme(phoneme: string): void;
  setManualOverride(shape: string, value: number): void;
  resetMorphs(): void;
  setCalibration(delta: Partial<CalibrationProfile>): void;
  applyPreset(preset: CalibrationPresetName): void;
  updateCalibrationSliders(): CalibrationProfile;
  saveCalibration(): void;
  resetCalibration(): CalibrationProfile;
  setLipSyncEngine(engine: 'phoneme' | 'char'): void;
  previewViseme(key: string | null): void;
  applyVisemeOverrides(record: VisemeOverrideMap): void;
  analyzeAndApplyEmotion(text: string): void;
}

export interface SceneService {
  loadDemo(): void;
  loadFile(file: File): Promise<void>;
  pointerMove(normX: number, normY: number): void;
  getAvatarInfo(): { name: string; shapesCount: number; speechMeshes: number } | null;
}

export interface AppServices {
  conversation: ConversationService;
  animation: AnimationService;
  telemetry: { sample(): TelemetrySample };
  scene: SceneService;
  animationSources: AnimationSourceRegistry;
  compare: CompareService;
  lastTurn: LastTurnService;
  scenePresets: ScenePresetService;
}

export type { FramesClip };
