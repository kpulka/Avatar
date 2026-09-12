import { pcmBytesToFloat32 } from './pcm-resampler';

/**
 * Web Audio Engine dla bezszwowego (gapless) odtwarzania surowego PCM (docs/4)
 */
export class AudioEngine {
  public readonly ctx: AudioContext;
  public readonly masterGain: GainNode;

  private activeNodes: AudioBufferSourceNode[] = [];
  private tailTime = 0;
  private epoch = 0;
  private prebufferSeconds = 0.08; // ~80ms prebuffer na absorpcję jittera sieci

  constructor(existingCtx?: AudioContext) {
    if (existingCtx) {
      this.ctx = existingCtx;
    } else {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
    }

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.0;
    this.masterGain.connect(this.ctx.destination);
  }

  public async unlock(): Promise<void> {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  /**
   * Planuje odtworzenie chunka PCM gapless na osi ctx.currentTime.
   * Zwraca zaplanowany czas rozpoczęcia dźwięku w sekundach (dla synchronizacji lip-syncu).
   */
  public playChunk(pcmBytes: Uint8Array, sampleRate = 44100, chunkEpoch = this.epoch): number {
    // Jeśli przyszedł opóźniony chunk z poprzedniej wypowiedzi (race condition), ignoruj go
    if (chunkEpoch !== this.epoch) {
      return 0;
    }

    const floatData = pcmBytesToFloat32(pcmBytes);
    if (floatData.length === 0) return this.tailTime;

    const buffer = this.ctx.createBuffer(1, floatData.length, sampleRate);
    buffer.copyToChannel(floatData as any, 0);

    const now = this.ctx.currentTime;
    // Gapless: start to max(teraz + prebuffer, koniec dotychczasowej kolejki)
    const startTime = Math.max(now + this.prebufferSeconds, this.tailTime);
    this.tailTime = startTime + buffer.duration;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.masterGain);

    source.start(startTime);
    this.activeNodes.push(source);

    source.onended = () => {
      const idx = this.activeNodes.indexOf(source);
      if (idx !== -1) {
        this.activeNodes.splice(idx, 1);
      }
      try {
        source.disconnect();
      } catch {
        // Ignoruj błąd jeśli już odpięty
      }
    };

    return startTime;
  }

  /**
   * Natychmiastowe zatrzymanie dźwięku (barge-in):
   * inkrementuje epoch, unieważnia zaplanowane węzły i czyści ogon czasowy
   */
  public hardStop(): void {
    this.epoch++;

    for (const node of this.activeNodes) {
      try {
        node.onended = null;
        node.stop();
        node.disconnect();
      } catch {
        // Ignoruj błąd jeśli węzeł już wygasł
      }
    }

    this.activeNodes = [];
    this.tailTime = 0;
    console.log(`[AudioEngine] hardStop() — epoch: ${this.epoch}`);
  }

  public hasPendingAudio(): boolean {
    return this.tailTime > this.ctx.currentTime;
  }

  public getEpoch(): number {
    return this.epoch;
  }

  public getTailTime(): number {
    return this.tailTime;
  }

  public getActiveNodesCount(): number {
    return this.activeNodes.length;
  }

  public setVolume(volume: number): void {
    this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), this.ctx.currentTime);
  }

  public setAdaptivePrebuffer(enabled: boolean, targetSec = 0.08): void {
    this.prebufferSeconds = targetSec;
    if (!enabled) {
      this.prebufferSeconds = 0.08;
    }
  }

  public bumpPrebufferForJitter(): void {
    this.prebufferSeconds = Math.min(0.2, this.prebufferSeconds + 0.04);
    console.log(`[AudioEngine] Adaptacyjny prebuffer podbity do: ${this.prebufferSeconds.toFixed(3)}s`);
  }

  public getPrebufferSeconds(): number {
    return this.prebufferSeconds;
  }
}
