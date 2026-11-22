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
  /** true → procedural blink, gaze morphs and eyeball bones are OFF (A2F carries the eyes). */
  carriesEyes: boolean;
}

/**
 * Procedural eye-look morph weights [0..1] (ARKit eyeLook*) — data only. The gaze controller
 * computes them; FaceController is the single module that writes them to the driver.
 */
export interface EyeLookWeights {
  eyeLookInLeft: number;
  eyeLookOutLeft: number;
  eyeLookUpLeft: number;
  eyeLookDownLeft: number;
  eyeLookInRight: number;
  eyeLookOutRight: number;
  eyeLookUpRight: number;
  eyeLookDownRight: number;
}

/** Source of procedural gaze weights (mirrors the blink provider); null = nothing to apply yet. */
export type GazeProvider = () => Readonly<EyeLookWeights> | null;

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
