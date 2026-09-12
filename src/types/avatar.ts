import * as THREE from 'three';

/**
 * Struktura danych alignmentu z ElevenLabs (Tryb A: audio_event.alignment)
 */
export interface CharAlignment {
  chars: string[];
  char_start_times_ms: number[];
  char_durations_ms: number[];
  /** Źródło danych: prawdziwy alignment ElevenLabs vs fallback akustyczny */
  source?: 'elevenlabs' | 'energy-fallback';
  /** Energia RMS 0..1 per znak — wypełniane TYLKO przez fallback akustyczny */
  energies?: number[];
}

/**
 * Źródło mowy — implementacje: ElevenAgentsWs, (Faza 2) ElevenTtsWs + własny STT/LLM
 */
export interface SpeechBackend {
  start(): Promise<void>;
  stop(): Promise<void>;
  onAudioChunk: (pcm: ArrayBuffer, alignment: CharAlignment, epoch: number, scheduledStartTime?: number) => void;
  onInterruption: (reason: string) => void;
  onUserTranscript: (text: string) => void;
  onStateChange: (state: 'listening' | 'speaking' | 'thinking' | 'idle') => void;
}

/**
 * Sterownik mimiki — implementacje: ArKitBlendshapeDriver (Three.js), (alt) BabylonDriver
 */
export interface FaceDriver {
  /** Aplikuje wagi słownika do wszystkich powiązanych sub-meshy */
  applyTargets(weights: Record<string, number>): void;

  /** Aplikuje wagę dla pojedynczego kształtu do wszystkich sub-meshy */
  applyWeight(shape: string, weight: number): void;

  /** Zwraca listę dostępnych blendshape'ów w załadowanym modelu */
  listAvailableShapes(): string[];

  /** Płynny powrót do pozycji neutralnej (wszystkie wagi 0) */
  relaxToNeutral(durationMs?: number): void;

  /** Zwraca listę siatek aparatu mowy */
  getSpeechMeshes(): THREE.Mesh[];

  /** Zwraca słownik indeksów morph targetów */
  getMorphTargetDictionary(): Record<string, number>;
}

/**
 * Kontrakt ramek absolutnych (08-CONTEXT v2) — jeden z dwóch torów animacji FaceControllera.
 */
export interface PoseFrame {
  /** CZAS WZGLĘDNY startu audio tury (s). Baza (baseSec) dodawana JEDNORAZOWO
   *  w FaceController.feedFrames(clip, baseSec, epoch) — NIE absolutny. */
  timeSec: number;
  /** znormalizowane wagi: klucz = nasz camelCase (jawOpen, mouthSmileLeft…) */
  weights: Record<string, number>;
}

export interface FramesClip {
  /** Ramki posortowane rosnąco po timeSec (porządkuje parser/demo). */
  frames: PoseFrame[];
  /** Informacyjne (nie zakładamy stałego kroku — v3.0 diffusion = 30 fps). */
  fps: number;
  /** Kształty, którymi strumień WŁADA — brak klucza w ramce → 0 dla tych kształtów. */
  shapes: string[];
  /** true → blink proceduralny OFF + GazeSaccades nie pisze eyeLook* (A2F niesie oczy). */
  carriesEyes: boolean;
  /** true → EmotionLayer addytywna OFF w trakcie tury (A2E prowadzi ekspresję). */
  carriesEmotion: boolean;
  /** Wyjście A2E (opcjonalne) — może zasilić EmotionLayer po zakończeniu tury. */
  emotions?: Array<{ timeSec: number; weights: Record<string, number> }>;
}

export type AnimationMode = 'viseme' | 'frames';

/**
 * Wynik załadowania awatara
 */
export interface LoadedAvatar {
  root: THREE.Object3D;
  faceDriver: FaceDriver;
  speechMeshes: THREE.Mesh[];
  morphTargetDictionary: Record<string, number>;
}

/**
 * Dostawca modelu — implementacje: MetaPersonLoader, (alt) CustomGlbLoader
 */
export interface AvatarLoader {
  load(urlOrFile: string | File, scene?: THREE.Scene): Promise<LoadedAvatar>;
}
