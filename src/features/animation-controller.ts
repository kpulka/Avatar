/**
 * AnimationController (Phase 11, 11-02) — extracted from `main.ts`.
 *
 * Responsible for: the FaceController lifecycle (the sole owner of the morphs), animation source
 * routing per turn, the demo speech and A2F demo (real /predict + fallback), calibration,
 * viseme overrides, phoneme/phrase tests and face rendering.
 */
import { AudioEngine } from '../audio/audio-engine';
import { predictFrames } from '../audio/a2f-backend';
import { FaceController } from '../lipsync/face-controller';
import { resolveAnimationSource } from '../lipsync/animation-router';
import { buildDemoFrames, synthesizeDemoAudio } from '../lipsync/demo-frames';
import {
  CalibrationPresetName,
  CalibrationProfile,
  CALIBRATION_PRESETS,
  DEFAULT_CALIBRATION_PROFILE,
} from '../lipsync/calibration';
import { VisemeOverrideMap } from '../lipsync/viseme-overrides';
import type { LipSyncEngine } from '../lipsync/lipsync-engine';
import { TypedEventBus, Unsub } from '../app/events';
import { AnimationService, AppEvents } from '../app/app-types';
import { t } from '../app/copy';
import { AnimationMode, FaceDriver, FramesClip, GazeProvider } from '../types/avatar';
import { SettingsStore } from '../app/store/settings-store';

const DEMO_PHRASE = 'This is an A2F frames demo';
const DEMO_VOICE_URL = '/demo/demo-speech.wav';

export interface AnimationControllerDeps {
  audioEngine: AudioEngine;
  events: TypedEventBus<AppEvents>;
  store: SettingsStore;
  /** Demo speech port (speechBackend.triggerDemoSpeech) — no dependency on WSS in the controller. */
  speak: (text: string) => void;
}

function normalizeMode(value: unknown): AnimationMode {
  return value === 'frames' ? 'frames' : 'viseme';
}

export class AnimationController implements AnimationService {
  private readonly audioEngine: AudioEngine;
  private readonly events: TypedEventBus<AppEvents>;
  private readonly store: SettingsStore;
  private readonly speak: (text: string) => void;

  private faceController: FaceController | null = null;
  private gazeProvider: GazeProvider | null = null;
  private animMode: AnimationMode;
  private calibration: CalibrationProfile;
  private readonly subscriptions: Unsub[] = [];

  constructor(deps: AnimationControllerDeps) {
    this.audioEngine = deps.audioEngine;
    this.events = deps.events;
    this.store = deps.store;
    this.speak = deps.speak;
    this.animMode = normalizeMode(this.store.getEffective<string>('animationSource'));
    this.calibration = { ...this.store.getEffective<CalibrationProfile>('calibration') };

    this.subscriptions.push(
      this.events.on('avatar:loaded', (payload) => this.attachFaceController(payload.faceDriver)),
      this.events.on('audio:chunk', (chunk) => this.handleAudioChunk(chunk)),
      this.events.on('speech:interruption', () => this.faceController?.onInterruption()),
      this.events.on('transcript:agent', (text) => this.faceController?.analyzeAndApplyEmotion(text))
    );
  }

  private attachFaceController(driver: FaceDriver): void {
    const fc = new FaceController(driver, this.audioEngine);
    fc.setCalibrationProfile(this.calibration);
    fc.setLipSyncEngine(this.store.getEffective<LipSyncEngine>('lipSyncEngine'));
    fc.setAnimationMode(this.animMode);
    fc.setGazeProvider(this.gazeProvider);
    this.faceController = fc;
  }

  /** Procedural gaze source (eyeLook* weights); survives avatar reloads. */
  public setGazeProvider(provider: GazeProvider | null): void {
    this.gazeProvider = provider;
    this.faceController?.setGazeProvider(provider);
  }

  private handleAudioChunk(chunk: { alignment: Parameters<FaceController['onAudioChunk']>[0]; startTime: number; epoch: number }): void {
    const fc = this.faceController;
    if (!fc) return;
    // A LIVE turn from WSS is always visemes — A2F batch breaks TTFB (router 08-03).
    // By design a pending deferred switch (e.g. to A2F requested mid-turn) is dropped here, so
    // `animMode` (the user's choice) may diverge from the FaceController mode until the next
    // non-live turn; the switch itself is a smooth turn-boundary switch, never a face snap.
    const source = resolveAnimationSource({ mode: this.animMode, liveTurn: true });
    if (fc.getAnimationMode() !== source) {
      fc.setAnimationMode(source);
    }
    fc.onAudioChunk(chunk.alignment, chunk.startTime, chunk.epoch);
  }

  public update(dt: number): void {
    this.faceController?.render(dt);
  }

  public getFaceController(): FaceController | null {
    return this.faceController;
  }

  public getSource(): AnimationMode {
    return this.animMode;
  }

  public setSource(mode: AnimationMode): void {
    this.animMode = mode;
    this.store.setUser('animationSource', mode);
    this.events.emit('animation:source', mode);
    if (this.faceController) {
      this.faceController.setAnimationMode(mode, {
        deferToTurnEnd: this.faceController.getState() === 'SPEAKING',
      });
    }
    this.events.emit('toast', {
      message: t('toast.animationSource', {
        source: mode === 'frames' ? t('animation.sourceFrames') : t('animation.sourceViseme'),
      }),
      type: 'success',
    });
  }

  public demoSpeech(): void {
    this.events.emit('transcript:user', 'Hello avatar, tell me about yourself.');
    const demoReply = 'Hello! It is a wonderful pleasure to talk with you. How can I help you today?';
    this.events.emit('transcript:agent', demoReply);
    this.speak('Hello, it is a wonderful pleasure to talk with you.');
    this.events.emit('toast', {
      message: t('toast.demoSpeech'),
      type: 'success',
    });
  }

  public testPhrase(lang: 'pl' | 'en'): void {
    const phrase =
      lang === 'pl'
        ? 'Dzień dobry! Cieszę się, że mogę z Tobą dzisiaj porozmawiać.'
        : 'Hello! I am delighted to speak with you and assist you today.';
    this.events.emit('transcript:user', t('animation.calibrationLabelPrefix', { lang: lang.toUpperCase() }));
    this.events.emit('transcript:agent', phrase);
    this.faceController?.clearManualOverrideMap();
    this.speak(phrase);
  }

  public testPhoneme(phoneme: string): void {
    this.faceController?.testPhoneme(
      phoneme as 'A' | 'E' | 'O' | 'U' | 'M' | 'SZ' | 'F' | 'neutral'
    );
  }

  public setManualOverride(shape: string, value: number): void {
    this.faceController?.setManualOverride(shape, value);
  }

  public resetMorphs(): void {
    this.faceController?.resetFaceToNeutral();
  }

  public setCalibration(delta: Partial<CalibrationProfile>): void {
    this.calibration = { ...this.calibration, ...delta };
    this.store.setStudio('calibration', this.calibration);
    this.faceController?.setCalibrationProfile(this.calibration);
  }

  public applyPreset(preset: CalibrationPresetName): void {
    this.calibration = { ...CALIBRATION_PRESETS[preset] };
    this.store.setStudio('calibration', this.calibration);
    this.faceController?.setCalibrationProfile(this.calibration);
  }

  public updateCalibrationSliders(): CalibrationProfile {
    return { ...this.calibration };
  }

  public saveCalibration(): void {
    this.store.setStudio('calibration', this.calibration);
  }

  public resetCalibration(): CalibrationProfile {
    this.calibration = { ...DEFAULT_CALIBRATION_PROFILE };
    this.store.setStudio('calibration', this.calibration);
    this.faceController?.setCalibrationProfile(this.calibration);
    return { ...this.calibration };
  }

  public setLipSyncEngine(engine: LipSyncEngine): void {
    this.store.setStudio('lipSyncEngine', engine);
    this.faceController?.setLipSyncEngine(engine);
  }

  public previewViseme(key: string | null): void {
    this.faceController?.previewViseme(key);
  }

  public applyVisemeOverrides(record: VisemeOverrideMap): void {
    this.store.setStudio('visemeOverrides', record);
    this.faceController?.applyVisemeOverridesRecord(record);
  }

  public analyzeAndApplyEmotion(text: string): void {
    this.faceController?.analyzeAndApplyEmotion(text);
  }

  // ---------------------------------------------------------------------------
  // A2F demo (09-03) — moved 1:1 from main.ts
  // ---------------------------------------------------------------------------

  private async fetchDemoVoiceBytes(): Promise<ArrayBuffer | null> {
    try {
      const response = await fetch(DEMO_VOICE_URL);
      if (!response.ok) return null;
      return await response.arrayBuffer();
    } catch {
      return null;
    }
  }

  private scheduleDecodedAudio(buffer: AudioBuffer): number {
    const length = buffer.length;
    const mono = new Float32Array(length);
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i += 1) mono[i] = (mono[i] ?? 0) + (data[i] ?? 0); // i < length
    }
    const norm = buffer.numberOfChannels || 1;
    const int16 = new Int16Array(length);
    for (let i = 0; i < length; i += 1) {
      const value = Math.max(-1, Math.min(1, (mono[i] ?? 0) / norm));
      int16[i] = Math.floor(value * 0x7fff);
    }
    const sampleRate = buffer.sampleRate || 44100;
    return this.audioEngine.playChunk(new Uint8Array(int16.buffer), sampleRate);
  }

  private scheduleSyntheticSpeech(sampleRate: number, durationSec: number, phrase: string): number {
    const samples = synthesizeDemoAudio(sampleRate, durationSec, phrase);
    const int16 = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i += 1) {
      const value = Math.max(-1, Math.min(1, samples[i] ?? 0));
      int16[i] = Math.floor(value * 0x7fff);
    }
    return this.audioEngine.playChunk(new Uint8Array(int16.buffer), sampleRate);
  }

  private async tryScheduleDemoVoice(): Promise<{
    baseSec: number;
    durationSec: number;
    phrase: string;
    source: 'voice';
  } | null> {
    const bytes = await this.fetchDemoVoiceBytes();
    if (!bytes) return null;
    try {
      const audio = await this.audioEngine.ctx.decodeAudioData(bytes.slice(0));
      if (audio.length === 0) return null;
      const baseSec = this.scheduleDecodedAudio(audio);
      return { baseSec, durationSec: audio.duration, phrase: DEMO_PHRASE, source: 'voice' };
    } catch (error) {
      console.warn('[Demo A2F] Invalid demo-speech.wav recording — synthetic fallback:', error);
      return null;
    }
  }

  private async tryRealA2fDemo(baseUrl: string): Promise<{
    clip: FramesClip;
    baseSec: number;
    durationSec: number;
    predictMs: number;
  } | null> {
    const cleanUrl = (baseUrl || '').trim();
    if (!cleanUrl) return null;
    try {
      const bytes = await this.fetchDemoVoiceBytes();
      if (!bytes) return null;
      const audio = await this.audioEngine.ctx.decodeAudioData(bytes.slice(0));
      if (audio.length === 0) return null;
      const wav = new Blob([bytes], { type: 'audio/wav' });
      const { parsed, predictMs } = await predictFrames(cleanUrl, wav, { timeoutMs: 20_000 });
      if (!parsed.clip.frames.length) return null;
      const baseSec = this.scheduleDecodedAudio(audio);
      return { clip: parsed.clip, baseSec, durationSec: audio.duration, predictMs };
    } catch (error) {
      console.warn('[Local A2F] predict unavailable — falling back to demo/synthetic visemes:', error);
      return null;
    }
  }

  private async scheduleDemoAudio(sampleRate: number): Promise<{
    baseSec: number;
    durationSec: number;
    phrase: string;
    source: 'voice' | 'synthetic';
  }> {
    const voice = await this.tryScheduleDemoVoice();
    if (voice) return voice;
    const durationSec = Math.min(6, Math.max(2, DEMO_PHRASE.length * 0.11));
    const baseSec = this.scheduleSyntheticSpeech(sampleRate, durationSec, DEMO_PHRASE);
    return { baseSec, durationSec, phrase: DEMO_PHRASE, source: 'synthetic' };
  }

  public async runA2fDemo(): Promise<void> {
    const faceController = this.faceController;
    if (!faceController) {
      this.events.emit('toast', { message: t('toast.loadAvatarFirst'), type: 'error' });
      return;
    }

    // Force frames mode (dev-switch) — regardless of the race with the deferred mode change.
    if (faceController.getAnimationMode() !== 'frames') {
      this.animMode = 'frames';
      this.store.setUser('animationSource', 'frames');
      faceController.setAnimationMode('frames');
      this.events.emit('animation:source', 'frames');
    }

    const sampleRate = 44100;
    // Fresh turn (epoch++): cancels any current speech/demo.
    this.audioEngine.hardStop();
    faceController.onInterruption();

    // 1) REAL A2F (09-03): local /predict wrapper (if available) → neural frames.
    const real = await this.tryRealA2fDemo(this.store.getEffective<string>('a2fUrl'));
    if (real) {
      faceController.feedFrames(real.clip, real.baseSec, this.audioEngine.getEpoch());
      const rtf = real.durationSec > 0 ? real.predictMs / (real.durationSec * 1000) : 0;
      this.events.emit('a2f:stats', {
        source: 'local',
        predictMs: real.predictMs,
        frames: real.clip.frames.length,
        fps: real.clip.fps,
        rtf,
      });
      this.events.emit('toast', {
        message: t('toast.a2fLocalResult', {
          frames: real.clip.frames.length,
          fps: real.clip.fps,
          ms: real.predictMs,
          rtf: rtf.toFixed(2),
        }),
        type: 'success',
      });
      return;
    }

    // 2) Fallback: the demo-speech.wav recording with demo frames OR synthetic (no wrapper).
    const { baseSec, durationSec, phrase, source } = await this.scheduleDemoAudio(sampleRate);
    const clip = buildDemoFrames(sampleRate, durationSec, phrase);
    faceController.feedFrames(clip, baseSec, this.audioEngine.getEpoch());
    this.events.emit('a2f:stats', { source, frames: clip.frames.length, fps: clip.fps });
    this.events.emit('toast', {
      message:
        t('toast.a2fDemoResult', { frames: clip.frames.length, fps: clip.fps, base: baseSec.toFixed(3) }) +
        (source === 'voice' ? t('toast.a2fDemoVoice') : t('toast.a2fDemoSynthetic')),
      type: 'success',
    });
  }

  public dispose(): void {
    for (const unsub of this.subscriptions.splice(0)) {
      unsub();
    }
    this.faceController = null;
  }
}
