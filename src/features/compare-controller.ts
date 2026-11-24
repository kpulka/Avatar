/**
 * CompareController (Phase 11, 11-05, Pattern 5): sequential A/B comparison on the last turn.
 *
 * Fairness: both tracks play EXACTLY the same PCM from LastTurnBuffer; the A2F track sends
 * the same buffer to `/predict` (encodeWav).
 *
 * Cancellation: `speech:interruption` and `transcript:user` abort the replay BEFORE new audio
 * is scheduled; `audio:chunk` (a new LIVE turn) is a safety belt — it calls
 * `hardStop()`, which may clip the first chunk of the new turn (documented cost, covered by a test).
 */
import { AudioEngine } from '../audio/audio-engine';
import { FaceController } from '../lipsync/face-controller';
import { FramesClip } from '../types/avatar';
import { predictFrames } from '../audio/a2f-backend';
import { encodeWav } from '../audio/pcm-to-wav';
import { LastTurn, LastTurnBuffer } from './last-turn-buffer';
import { TypedEventBus, Unsub } from '../app/events';
import { AppEvents, CompareResultEvent } from '../app/app-types';
import { t } from '../app/copy';

export type CompareState = 'idle' | 'ready' | 'predicting' | 'playing-a' | 'playing-b' | 'done' | 'error';

export interface CompareControllerDeps {
  buffer: LastTurnBuffer;
  audioEngine: AudioEngine;
  getFaceController: () => FaceController | null;
  getA2fUrl: () => string;
  events: TypedEventBus<AppEvents>;
  /** Injected for tests (defaults to setTimeout). */
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  predict?: typeof predictFrames;
}

interface A2fPrepared {
  clip: FramesClip;
  predictMs: number;
}

/** Normalized RMS difference of two waveforms (0 = identical). */
export function rmsDiff(a: Float32Array, b: Float32Array): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) return 0;
  let diffSum = 0;
  let baseSum = 0;
  for (let i = 0; i < length; i += 1) {
    const av = a[i] ?? 0; // i < length = min(a.length, b.length)
    const bv = b[i] ?? 0;
    const diff = av - bv;
    diffSum += diff * diff;
    baseSum += av * av;
  }
  const diffRms = Math.sqrt(diffSum / length);
  const baseRms = Math.sqrt(baseSum / length);
  return baseRms > 1e-9 ? diffRms / baseRms : diffRms;
}

export class CompareController {
  private state: CompareState = 'idle';
  private runToken = 0;
  private modeOwner: { token: number; face: FaceController; originalMode: ReturnType<FaceController['getAnimationMode']> } | null = null;
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
    // Without an avatar a comparison makes no sense: the replay would play audio with a motionless face (review A1 / P2).
    if (!faceController || faceController.getState() !== 'IDLE') return false;
    if (this.deps.audioEngine.hasPendingAudio()) return false;
    return this.deps.buffer.getLastTurn() !== null;
  }

  public async run(options: { blind?: boolean } = {}): Promise<boolean> {
    const blind = options.blind === true;
    if (!this.canCompare()) return false;

    const turn = this.deps.buffer.getLastTurn();
    if (!turn) return false;

    const face = this.deps.getFaceController();
    if (!face) return false;
    const token = ++this.runToken;
    this.modeOwner = { token, face, originalMode: face.getAnimationMode() };
    this.setState('ready');

    const liveFirst = !blind || this.random() < 0.5;
    const liveDurationMs = (turn.chunks.reduce((sum, chunk) => sum + chunk.bytes.byteLength, 0) / 2 / turn.sampleRate) * 1000;

    try {
      if (!this.isCurrent(token)) return true;
      let a2f: A2fPrepared | null = null;
      if (liveFirst) {
        await this.playLive(turn, token, face);
        if (!this.isCurrent(token)) return true;
        await this.sleep(liveDurationMs + 150);
        if (!this.isCurrent(token)) return true;
        a2f = await this.ensureA2f(turn, token);
        if (!this.isCurrent(token)) return true;
        if (!a2f) return false;
        await this.playA2f(turn, a2f, token, face);
      } else {
        a2f = await this.ensureA2f(turn, token);
        if (!this.isCurrent(token)) return true;
        if (!a2f) return false;
        await this.playA2f(turn, a2f, token, face);
        if (!this.isCurrent(token)) return true;
        await this.sleep(liveDurationMs + 150);
        if (!this.isCurrent(token)) return true;
        await this.playLive(turn, token, face);
      }

      if (!this.isCurrent(token)) return true;
      await this.sleep(liveDurationMs + 150);
      if (!this.isCurrent(token)) return true;
      while (this.deps.audioEngine.hasPendingAudio()) {
        const remainingMs = (this.deps.audioEngine.getTailTime() - this.deps.audioEngine.ctx.currentTime) * 1000;
        await this.sleep(Math.max(remainingMs, 16));
        if (!this.isCurrent(token)) return true;
      }

      const a2fDurationSec = a2f?.clip.frames.at(-1)?.timeSec ?? 0;
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

      this.restoreMode(token);
      this.setState('done');
      this.deps.events.emit('compare:result', result);
      return true;
    } catch (error) {
      if (!this.isCurrent(token)) return true;
      if (this.isCurrent(token)) {
        this.restoreMode(token);
        this.setState('error');
        this.deps.events.emit('toast', {
          message: t('compare.failedToast', { message: (error as Error).message }),
          type: 'error',
        });
      }
      return false;
    } finally {
      this.restoreMode(token);
    }
  }

  public cancel(reason: string): void {
    if (this.state === 'idle' || this.state === 'done' || this.state === 'error') return;
    const token = this.runToken;
    this.runToken += 1;
    this.deps.audioEngine.hardStop();
    this.restoreMode(token);
    this.setState('idle');
    // eslint-disable-next-line no-console -- trace log, not a diagnostic: kept as console.log on purpose (warn/error are the diagnostic channels)
    console.log(`[CompareController] Replay cancelled (${reason}).`);
    this.deps.events.emit('compare:cancelled', undefined);
  }

  public dispose(): void {
    for (const unsub of this.subscriptions.splice(0)) {
      unsub();
    }
  }

  private restoreMode(token: number): void {
    const owner = this.modeOwner;
    if (!owner || owner.token !== token) return;
    this.modeOwner = null;
    if (owner.face.getAnimationMode() !== owner.originalMode) {
      owner.face.setAnimationMode(owner.originalMode);
    }
  }

  private isCurrent(token: number): boolean {
    return token === this.runToken;
  }

  private setState(state: CompareState): void {
    this.state = state;
    this.deps.events.emit('compare:state', state);
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- Promise-returning contract; async keeps a throw a rejection
  private async playLive(turn: LastTurn, token: number, faceController: FaceController): Promise<void> {
    this.setState('playing-a');
    if (!this.isCurrent(token)) return;
    this.deps.audioEngine.hardStop();
    if (faceController.getAnimationMode() !== 'viseme') faceController.setAnimationMode('viseme');
    for (const chunk of turn.chunks) {
      if (!this.isCurrent(token)) return;
      const scheduledStart = this.deps.audioEngine.playChunk(chunk.bytes, turn.sampleRate);
      const epoch = this.deps.audioEngine.getEpoch();
      faceController?.onAudioChunk(chunk.alignment, scheduledStart || this.deps.audioEngine.getTailTime(), epoch);
    }
  }

  private async ensureA2f(turn: LastTurn, token: number): Promise<A2fPrepared | null> {
    this.setState('predicting');
    if (!this.isCurrent(token)) return null;
    const pcm = this.deps.buffer.concatPcm();
    if (!pcm) {
      if (this.isCurrent(token)) {
        this.restoreMode(token);
        this.setState('error');
        this.deps.events.emit('toast', { message: t('compare.noAudioToast'), type: 'error' });
      }
      return null;
    }
    const wav = encodeWav(pcm, turn.sampleRate);
    try {
      const { parsed, predictMs } = await this.predict(this.deps.getA2fUrl(), wav);
      if (!this.isCurrent(token)) return null;
      if (!parsed.clip.frames.length) {
        throw new Error('empty frames from /predict');
      }
      return { clip: parsed.clip, predictMs };
    } catch (error) {
      if (this.isCurrent(token)) {
        this.restoreMode(token);
        this.setState('error');
        this.deps.events.emit('toast', {
          message: t('compare.a2fDownToast', { message: (error as Error).message }),
          type: 'error',
        });
      }
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- Promise-returning contract; async keeps a throw a rejection
  private async playA2f(turn: LastTurn, prepared: A2fPrepared, token: number, faceController: FaceController): Promise<void> {
    this.setState('playing-b');
    if (!this.isCurrent(token)) return;
    this.deps.audioEngine.hardStop();
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
    if (faceController && faceController.getAnimationMode() !== 'frames') faceController.setAnimationMode('frames');
    faceController?.feedFrames(prepared.clip, baseSec, epoch);
  }
}
