import { pcmBytesToFloat32 } from './pcm-resampler';

/** ~80 ms prebuffer to absorb network jitter before the first scheduled chunk. */
const PREBUFFER_SEC = 0.08;

/**
 * Web Audio Engine for seamless (gapless) playback of raw PCM (docs/4)
 */
export class AudioEngine {
  public readonly ctx: AudioContext;
  public readonly masterGain: GainNode;

  private activeNodes: AudioBufferSourceNode[] = [];
  private tailTime = 0;
  private epoch = 0;

  constructor(existingCtx?: AudioContext) {
    if (existingCtx) {
      this.ctx = existingCtx;
    } else {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
   * Schedules gapless playback of a PCM chunk on the ctx.currentTime axis.
   * Returns the scheduled sound start time in seconds (for lip-sync synchronization).
   */
  public playChunk(pcmBytes: Uint8Array, sampleRate = 44100, chunkEpoch = this.epoch): number {
    // If a delayed chunk from the previous utterance arrived (race condition), ignore it
    if (chunkEpoch !== this.epoch) {
      return 0;
    }

    const floatData = pcmBytesToFloat32(pcmBytes);
    if (floatData.length === 0) return this.tailTime;

    const buffer = this.ctx.createBuffer(1, floatData.length, sampleRate);
    buffer.copyToChannel(floatData, 0);

    const now = this.ctx.currentTime;
    // Gapless: start at max(now + prebuffer, end of the existing queue)
    const startTime = Math.max(now + PREBUFFER_SEC, this.tailTime);
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
        // Ignore the error if already disconnected
      }
    };

    return startTime;
  }

  /**
   * Immediate sound stop (barge-in):
   * increments the epoch, invalidates scheduled nodes and clears the time tail
   */
  public hardStop(): void {
    this.epoch++;

    for (const node of this.activeNodes) {
      try {
        node.onended = null;
        node.stop();
        node.disconnect();
      } catch {
        // Ignore the error if the node has already expired
      }
    }

    this.activeNodes = [];
    this.tailTime = 0;
    // eslint-disable-next-line no-console -- trace log, not a diagnostic: kept as console.log on purpose (warn/error are the diagnostic channels)
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
}
