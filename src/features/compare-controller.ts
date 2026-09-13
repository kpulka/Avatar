/**
 * CompareController (Faza 11, 11-05, Pattern 5): sekwencyjne porównanie A/B na ostatniej turze.
 *
 * Fairness: oba tory odtwarzają DOKŁADNIE ten sam PCM z LastTurnBuffer; tor A2F wysyła
 * ten sam bufor do `/predict` (encodeWav).
 *
 * Anulowanie: `speech:interruption` i `transcript:user` przerywają replay ZANIM nowe audio
 * zostanie zaplanowane; `audio:chunk` (nowa tura LIVE) jest pasem bezpieczeństwa — wywołuje
 * `hardStop()`, co może obciąć pierwszy chunk nowej tury (udokumentowany koszt, test pokrywa).
 */
import { AudioEngine } from '../audio/audio-engine';
import { FaceController } from '../lipsync/face-controller';
import { FramesClip } from '../types/avatar';
import { predictFrames } from '../audio/a2f-backend';
import { encodeWav } from '../audio/pcm-to-wav';
import { LastTurn, LastTurnBuffer } from './last-turn-buffer';
import { TypedEventBus, Unsub } from '../app/events';
import { AppEvents, CompareResultEvent } from '../app/app-types';

export type CompareState =
  | 'idle'
  | 'ready'
  | 'predicting'
  | 'playing-a'
  | 'playing-b'
  | 'done'
  | 'error';

export interface CompareControllerDeps {
  buffer: LastTurnBuffer;
  audioEngine: AudioEngine;
  getFaceController: () => FaceController | null;
  getA2fUrl: () => string;
  events: TypedEventBus<AppEvents>;
  /** Wstrzykiwane dla testów (domyślnie setTimeout). */
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  predict?: typeof predictFrames;
}

interface A2fPrepared {
  clip: FramesClip;
  predictMs: number;
}

/** Znormalizowana różnica RMS dwóch przebiegów (0 = identyczne). */
export function rmsDiff(a: Float32Array, b: Float32Array): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) return 0;
  let diffSum = 0;
  let baseSum = 0;
  for (let i = 0; i < length; i += 1) {
    const diff = a[i] - b[i];
    diffSum += diff * diff;
    baseSum += a[i] * a[i];
  }
  const diffRms = Math.sqrt(diffSum / length);
  const baseRms = Math.sqrt(baseSum / length);
  return baseRms > 1e-9 ? diffRms / baseRms : diffRms;
}

export class CompareController {
  private state: CompareState = 'idle';
  private runToken = 0;
  private readonly subscriptions: Unsub[] = [];
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly predict: typeof predictFrames;

  constructor(private readonly deps: CompareControllerDeps) {
    this.sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.random = deps.random ?? Math.random;
    this.predict = deps.predict ?? predictFrames;

    this.subscriptions.push(
      deps.events.on('speech:interruption', () => this.cancel('interruption')),
      deps.events.on('transcript:user', () => this.cancel('user-turn')),
      deps.events.on('audio:chunk', () => this.cancel('live-chunk'))
    );
  }

  public getState(): CompareState {
    return this.state;
  }

  public canCompare(): boolean {
    if (this.state !== 'idle' && this.state !== 'done' && this.state !== 'error') return false;
    const faceController = this.deps.getFaceController();
    // Bez awatara porównanie nie ma sensu: replay puściłby audio z nieruchomą twarzą (review A1 / P2).
    if (!faceController || faceController.getState() !== 'IDLE') return false;
    if (this.deps.audioEngine.hasPendingAudio()) return false;
    return this.deps.buffer.getLastTurn() !== null;
  }

  public async run(options: { blind?: boolean } = {}): Promise<boolean> {
    const blind = options.blind === true;
    if (!this.canCompare()) return false;

    const turn = this.deps.buffer.getLastTurn();
    if (!turn) return false;

    const token = ++this.runToken;
    this.setState('ready');

    const liveFirst = !blind || this.random() < 0.5;
    const liveDurationMs = (turn.chunks.reduce((sum, chunk) => sum + chunk.bytes.byteLength, 0) / 2 / turn.sampleRate) * 1000;

    try {
      let a2f: A2fPrepared | null = null;
      if (liveFirst) {
        await this.playLive(turn, token);
        if (!this.isCurrent(token)) return true;
        await this.sleep(liveDurationMs + 150);
        if (!this.isCurrent(token)) return true;
        a2f = await this.ensureA2f(turn, token);
        if (!a2f || !this.isCurrent(token)) return true;
        await this.playA2f(turn, a2f, token);
      } else {
        a2f = await this.ensureA2f(turn, token);
        if (!a2f || !this.isCurrent(token)) return true;
        await this.playA2f(turn, a2f, token);
        if (!this.isCurrent(token)) return true;
        await this.sleep(liveDurationMs + 150);
        if (!this.isCurrent(token)) return true;
        await this.playLive(turn, token);
      }

      if (!this.isCurrent(token)) return true;

      const a2fDurationSec = a2f?.clip.frames.length
        ? a2f.clip.frames[a2f.clip.frames.length - 1].timeSec
        : 0;
      const liveDurationSec = liveDurationMs / 1000;
      const result: CompareResultEvent = {
        order: liveFirst ? ['live', 'a2f'] : ['a2f', 'live'],
        blind,
        live: {},
        a2f: {
          predictMs: a2f?.predictMs,
          frames: a2f?.clip.frames.length,
          fps: a2f?.clip.fps,
          rtf: a2f && liveDurationSec > 0 ? a2f.predictMs / (liveDurationSec * 1000) : undefined,
        },
        partial: a2fDurationSec > 0 && liveDurationSec > 0 ? a2fDurationSec < 0.8 * liveDurationSec : undefined,
      };

      this.setState('done');
      this.deps.events.emit('compare:result', result);
      return true;
    } catch (error) {
      if (this.isCurrent(token)) {
        this.setState('error');
        this.deps.events.emit('toast', {
          message: `Porównanie nie powiodło się: ${(error as Error).message}`,
          type: 'error',
        });
      }
      return false;
    }
  }

  public cancel(reason: string): void {
    if (this.state === 'idle' || this.state === 'done' || this.state === 'error') return;
    this.runToken += 1;
    this.deps.audioEngine.hardStop();
    this.setState('idle');
    console.log(`[CompareController] Anulowano replay (${reason}).`);
    this.deps.events.emit('compare:cancelled', undefined);
  }

  public dispose(): void {
    for (const unsub of this.subscriptions.splice(0)) {
      unsub();
    }
  }

  private isCurrent(token: number): boolean {
    return token === this.runToken;
  }

  private setState(state: CompareState): void {
    this.state = state;
    this.deps.events.emit('compare:state', state);
  }

  private async playLive(turn: LastTurn, token: number): Promise<void> {
    this.setState('playing-a');
    this.deps.audioEngine.hardStop();
    const faceController = this.deps.getFaceController();
    let epoch = this.deps.audioEngine.getEpoch();
    for (const chunk of turn.chunks) {
      if (!this.isCurrent(token)) return;
      const scheduledStart = this.deps.audioEngine.playChunk(chunk.bytes, turn.sampleRate);
      epoch = this.deps.audioEngine.getEpoch();
      faceController?.onAudioChunk(chunk.alignment, scheduledStart || this.deps.audioEngine.getTailTime(), epoch);
    }
  }

  private async ensureA2f(turn: LastTurn, token: number): Promise<A2fPrepared | null> {
    this.setState('predicting');
    const pcm = this.deps.buffer.concatPcm();
    if (!pcm) return null;
    const wav = encodeWav(pcm, turn.sampleRate);
    try {
      const { parsed, predictMs } = await this.predict(this.deps.getA2fUrl(), wav);
      if (!this.isCurrent(token)) return null;
      if (!parsed.clip.frames.length) {
        throw new Error('puste ramki z /predict');
      }
      return { clip: parsed.clip, predictMs };
    } catch (error) {
      if (this.isCurrent(token)) {
        this.setState('error');
        this.deps.events.emit('toast', {
          message: `A2F niedostępny — sprawdź adres serwisu w Studio → A2F. (${(error as Error).message})`,
          type: 'error',
        });
      }
      return null;
    }
  }

  private async playA2f(turn: LastTurn, prepared: A2fPrepared, token: number): Promise<void> {
    this.setState('playing-b');
    this.deps.audioEngine.hardStop();
    const faceController = this.deps.getFaceController();
    let baseSec = 0;
    let first = true;
    for (const chunk of turn.chunks) {
      if (!this.isCurrent(token)) return;
      const scheduledStart = this.deps.audioEngine.playChunk(chunk.bytes, turn.sampleRate);
      if (first) {
        baseSec = scheduledStart || this.deps.audioEngine.getTailTime();
        first = false;
      }
    }
    const epoch = this.deps.audioEngine.getEpoch();
    faceController?.feedFrames(prepared.clip, baseSec, epoch);
  }
}
