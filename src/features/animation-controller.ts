/**
 * AnimationController (Faza 11, 11-02) — wydzielony z `main.ts`.
 *
 * Odpowiada za: cykl życia FaceController (jedyny właściciel morphów), routing źródła
 * animacji per tura, demo mowy i demo A2F (realny /predict + fallback), kalibrację,
 * nadpisania wizemów, testy głosek/fraz oraz render twarzy.
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
import { TypedEventBus, Unsub } from '../app/events';
import { AnimationService, AppEvents } from '../app/app-types';
import { AnimationMode, FaceDriver, FramesClip } from '../types/avatar';
import { SettingsStore } from '../app/store/settings-store';

const DEMO_PHRASE = 'This is an A2F frames demo';
const DEMO_VOICE_URL = '/demo/demo-speech.wav';

export interface AnimationControllerDeps {
  audioEngine: AudioEngine;
  events: TypedEventBus<AppEvents>;
  store: SettingsStore;
  /** Port mowy demo (speechBackend.triggerDemoSpeech) — bez zależności od WSS w kontrolerze. */
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
    fc.setLipSyncEngine(this.store.getEffective<'phoneme' | 'char'>('lipSyncEngine'));
    fc.setAnimationMode(this.animMode);
    this.faceController = fc;
  }

  private handleAudioChunk(chunk: { alignment: Parameters<FaceController['onAudioChunk']>[0]; startTime: number; epoch: number }): void {
    const fc = this.faceController;
    if (!fc) return;
    // Tura LIVE z WSS zawsze wizemy — A2F-batch łamie TTFB (router 08-03).
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
      message: `Źródło animacji: ${mode === 'frames' ? 'A2F (frames)' : 'LIVE wizemy'}`,
      type: 'success',
    });
  }

  public demoSpeech(): void {
    this.events.emit('transcript:user', 'Hello avatar, tell me about yourself.');
    const demoReply = 'Hello! It is a wonderful pleasure to talk with you. How can I help you today?';
    this.events.emit('transcript:agent', demoReply);
    this.speak('Hello, it is a wonderful pleasure to talk with you.');
    this.events.emit('toast', {
      message: 'Odtwarzanie demonstracyjnej mowy z analizą sentymentu (Happy)',
      type: 'success',
    });
  }

  public testPhrase(lang: 'pl' | 'en'): void {
    const phrase =
      lang === 'pl'
        ? 'Dzień dobry! Cieszę się, że mogę z Tobą dzisiaj porozmawiać.'
        : 'Hello! I am delighted to speak with you and assist you today.';
    this.events.emit('transcript:user', `[Test kalibracji ${lang.toUpperCase()}]`);
    this.events.emit('transcript:agent', phrase);
    this.faceController?.clearManualOverrides();
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
    this.faceController?.clearManualOverrides();
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

  public setLipSyncEngine(engine: 'phoneme' | 'char'): void {
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
  // Demo A2F (09-03) — przeniesione 1:1 z main.ts
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
      for (let i = 0; i < length; i += 1) mono[i] += data[i];
    }
    const norm = buffer.numberOfChannels || 1;
    const int16 = new Int16Array(length);
    for (let i = 0; i < length; i += 1) {
      const value = Math.max(-1, Math.min(1, mono[i] / norm));
      int16[i] = Math.floor(value * 0x7fff);
    }
    const sampleRate = buffer.sampleRate || 44100;
    return this.audioEngine.playChunk(new Uint8Array(int16.buffer), sampleRate);
  }

  private scheduleSyntheticSpeech(sampleRate: number, durationSec: number, phrase: string): number {
    const samples = synthesizeDemoAudio(sampleRate, durationSec, phrase);
    const int16 = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i += 1) {
      const value = Math.max(-1, Math.min(1, samples[i]));
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
      console.warn('[Demo A2F] Niepoprawne nagranie demo-speech.wav — syntetyka:', error);
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
      console.warn('[A2F lokalny] predict niedostępny — fallback do wizem demo/syntetyki:', error);
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
      this.events.emit('toast', { message: 'Najpierw załaduj awatara (Demo/Load).', type: 'error' });
      return;
    }

    // Wymuś tryb frames (dev-switch) — niezależnie od wyścigu z odroczoną zmianą trybu.
    if (faceController.getAnimationMode() !== 'frames') {
      this.animMode = 'frames';
      this.store.setUser('animationSource', 'frames');
      faceController.setAnimationMode('frames');
      this.events.emit('animation:source', 'frames');
    }

    const sampleRate = 44100;
    // Świeża tura (epoka++): kasuje ewentualną bieżącą mowę/demo.
    this.audioEngine.hardStop();
    faceController.onInterruption();

    // 1) REALNY A2F (09-03): lokalny wrapper /predict (jeśli dostępny) → neuronowe ramki.
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
        message:
          `A2F lokalny: ${real.clip.frames.length} ramek @ ${real.clip.fps}fps, ` +
          `predict ${real.predictMs} ms (RTF ${rtf.toFixed(2)})`,
        type: 'success',
      });
      return;
    }

    // 2) Fallback: nagranie demo-speech.wav z ramkami demo LUB syntetyka (bez wrappera).
    const { baseSec, durationSec, phrase, source } = await this.scheduleDemoAudio(sampleRate);
    const clip = buildDemoFrames(sampleRate, durationSec, phrase);
    faceController.feedFrames(clip, baseSec, this.audioEngine.getEpoch());
    this.events.emit('a2f:stats', { source, frames: clip.frames.length, fps: clip.fps });
    this.events.emit('toast', {
      message:
        `Demo A2F (frames): ${clip.frames.length} ramek @ ${clip.fps}fps, base=${baseSec.toFixed(3)}s` +
        (source === 'voice'
          ? ' — nagranie demo-speech.wav'
          : ' — syntetyka (dodaj public/demo/demo-speech.wav)'),
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
