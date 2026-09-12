/**
 * LastTurnBuffer (Faza 11, 11-05): bufor ostatniej tury agenta — JEDNO źródło PCM dla obu
 * torów porównywarki (fairness konstrukcyjna: tor LIVE odtwarza te same bajty, które tor A2F
 * wysyła do `/predict`).
 *
 * Kontrakt wejścia: `audio:chunk` z `{ bytes, alignment, startTime, epoch, sampleRate }` (11-02).
 */
import { CharAlignment } from '../types/avatar';
import { TypedEventBus, Unsub } from '../app/events';
import { AppEvents } from '../app/app-types';

export interface TurnChunk {
  bytes: Uint8Array;
  alignment: CharAlignment;
  startTime: number;
}

export interface LastTurn {
  chunks: TurnChunk[];
  sampleRate: number;
  text: string;
}

export interface LastTurnBufferDeps {
  events: TypedEventBus<AppEvents>;
  /** Limit długości bufora w sekundach (domyślnie 60). */
  maxSeconds?: number;
}

export class LastTurnBuffer {
  private readonly events: TypedEventBus<AppEvents>;
  private readonly maxSeconds: number;
  private chunks: TurnChunk[] = [];
  private sampleRate = 0;
  private text = '';
  private durationSec = 0;
  private readonly subscriptions: Unsub[] = [];

  constructor(deps: LastTurnBufferDeps) {
    this.events = deps.events;
    this.maxSeconds = deps.maxSeconds ?? 60;

    this.subscriptions.push(
      this.events.on('audio:chunk', (chunk) => {
        if (!chunk.bytes.length || chunk.sampleRate <= 0) return;
        const chunkSec = chunk.bytes.byteLength / 2 / chunk.sampleRate;
        if (this.durationSec + chunkSec > this.maxSeconds) {
          console.warn('[LastTurnBuffer] Limit długości tury — czyszczę bufor.');
          this.clear();
        }
        this.chunks.push({
          bytes: new Uint8Array(chunk.bytes),
          alignment: chunk.alignment,
          startTime: chunk.startTime,
        });
        this.sampleRate = chunk.sampleRate;
        this.durationSec += chunkSec;
      }),
      this.events.on('transcript:agent', (text) => {
        this.text = text;
      }),
      this.events.on('transcript:user', () => this.clear()),
      this.events.on('voice:state', (state) => {
        if (state === 'listening') this.clear();
      })
    );
  }

  public hasTurn(): boolean {
    return this.getLastTurn() !== null;
  }

  public getLastTurn(): LastTurn | null {
    if (this.chunks.length === 0 || this.sampleRate <= 0) return null;
    return {
      chunks: this.chunks.map((chunk) => ({ ...chunk })),
      sampleRate: this.sampleRate,
      text: this.text,
    };
  }

  public getSampleRate(): number {
    return this.sampleRate;
  }

  public getDurationSec(): number {
    return this.durationSec;
  }

  public concatPcm(): Uint8Array | null {
    if (this.chunks.length === 0) return null;
    const total = this.chunks.reduce((sum, chunk) => sum + chunk.bytes.byteLength, 0);
    if (total === 0) return null;
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of this.chunks) {
      merged.set(chunk.bytes, offset);
      offset += chunk.bytes.byteLength;
    }
    return merged;
  }

  public clear(): void {
    this.chunks = [];
    this.durationSec = 0;
  }

  public dispose(): void {
    for (const unsub of this.subscriptions.splice(0)) {
      unsub();
    }
    this.clear();
  }
}
