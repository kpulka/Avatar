import * as THREE from 'three';

/**
 * Alignment data structure from ElevenLabs (Mode A: audio_event.alignment)
 */
export interface CharAlignment {
  chars: string[];
  char_start_times_ms: number[];
  char_durations_ms: number[];
  /** Data source: the real ElevenLabs alignment vs the acoustic fallback */
  source?: 'elevenlabs' | 'energy-fallback';
  /** RMS energy 0..1 per character — filled ONLY by the acoustic fallback */
  energies?: number[];
}

/**
 * Speech source — implementations: ElevenAgentsWs, (Phase 2) ElevenTtsWs + own STT/LLM
 */
export interface SpeechBackend {
  start(): Promise<void>;
  stop(): Promise<void>;
  onAudioChunk: (pcm: ArrayBuffer, alignment: CharAlignment, epoch: number, scheduledStartTime: number | undefined, sampleRate: number) => void;
  onInterruption: (reason: string) => void;
  onUserTranscript: (text: string) => void;
  onStateChange: (state: 'listening' | 'speaking' | 'thinking' | 'idle') => void;
}

/**
 * Facial-expression driver — implementations: ArKitBlendshapeDriver (Three.js), (alt) BabylonDriver
 */
export interface FaceDriver {
  /** Applies the dictionary weights to all linked sub-meshes */
  applyTargets(weights: Record<string, number>): void;

  /** Applies the weight of a single shape to all sub-meshes */
  applyWeight(shape: string, weight: number): void;

  /** Returns the list of blendshapes available in the loaded model */
  listAvailableShapes(): string[];

  /** Smooth return to the neutral pose (all weights 0) */
  relaxToNeutral(durationMs?: number): void;

  /** Returns the list of speech-apparatus meshes */
  getSpeechMeshes(): THREE.Mesh[];

  /** Returns the dictionary of morph target indices */
  getMorphTargetDictionary(): Record<string, number>;
}

/**
 * Absolute-frames contract (08-CONTEXT v2) — one of the two FaceController animation tracks.
 */
export interface PoseFrame {
  /** RELATIVE TIME of the turn's audio start (s). The base (baseSec) is added ONCE
   *  in FaceController.feedFrames(clip, baseSec, epoch) — NOT absolute. */
  timeSec: number;
  /** normalized weights: key = our camelCase (jawOpen, mouthSmileLeft…) */
  weights: Record<string, number>;
}

export interface FramesClip {
  /** Frames sorted ascending by timeSec (ordered by the parser/demo). */
  frames: PoseFrame[];
  /** Informational (we do not assume a fixed step — v3.0 diffusion = 30 fps). */
  fps: number;
  /** Shapes the stream OWNS — a missing key in a frame → 0 for those shapes. */
  shapes: string[];
  /** true → procedural blink OFF + GazeSaccades does not write eyeLook* (A2F carries the eyes). */
  carriesEyes: boolean;
  /** true → the additive EmotionLayer is OFF during the turn (A2E drives the expression). */
  carriesEmotion: boolean;
  /** A2E output (optional) — may feed the EmotionLayer after the turn ends. */
  emotions?: Array<{ timeSec: number; weights: Record<string, number> }>;
}

export type AnimationMode = 'viseme' | 'frames';

/**
 * Result of loading the avatar
 */
export interface LoadedAvatar {
  root: THREE.Object3D;
  faceDriver: FaceDriver;
  speechMeshes: THREE.Mesh[];
  morphTargetDictionary: Record<string, number>;
}

/**
 * Model provider — implementations: MetaPersonLoader, (alt) CustomGlbLoader
 */
export interface AvatarLoader {
  load(urlOrFile: string | File, scene?: THREE.Scene): Promise<LoadedAvatar>;
}
