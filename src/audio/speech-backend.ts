import { SpeechBackend, CharAlignment } from '../types/avatar';
import { RawWssClient } from './raw-wss-client';
import { MicCapture } from './mic-capture';
import { AudioEngine } from './audio-engine';
import { base64ToPcmBytes, int16ToBase64 } from './pcm-resampler';
import { AudioEventPayload } from '../types/audio';
import { generateEnergyFallbackAlignment } from './energy-fallback';
import { rescaleAlignmentToAudio } from './alignment-rescale';

export class MicAccessError extends Error {
  public readonly reason: 'denied' | 'not-found' | 'other';
  constructor(cause: unknown) {
    const name = (cause as { name?: string } | null)?.name;
    const reason = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied'
      : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'not-found' : 'other';
    super(reason === 'denied' ? 'Microphone access is blocked. Allow it via the icon in the address bar, then press Start again.'
      : reason === 'not-found' ? 'No microphone was found. Connect one and press Start again.'
      : 'The microphone could not be started.');
    this.name = 'MicAccessError';
    this.reason = reason;
  }
}

export class ElevenAgentsSpeechBackend implements SpeechBackend {
  public onAudioChunk: (
    pcm: ArrayBuffer,
    alignment: CharAlignment,
    epoch: number,
    scheduledStartTime: number | undefined,
    sampleRate: number
  ) => void = () => {};
  public onError: (err: Error) => void = () => {};
  public onInterruption: (reason: string) => void = () => {};
  public onUserTranscript: (text: string) => void = () => {};
  public onAgentResponse: (text: string) => void = () => {};
  /** Corrected agent text after a barge-in (what was actually spoken); replaces the stale caption. */
  public onAgentCorrection: (text: string) => void = () => {};
  public onStateChange: (state: 'listening' | 'speaking' | 'thinking' | 'idle') => void = () => {};

  private readonly wssClient: RawWssClient;
  private readonly micCapture: MicCapture;
  private readonly audioEngine: AudioEngine;

  private isRunning = false;
  private startPromise: Promise<void> | null = null;
  private startGeneration = 0;
  private isMuted = false;
  private agentOutputSampleRate = 16000; // default 16000 for ElevenLabs ConvAI, adapted from metadata

  // AV sync diagnostics (docs/3): state per utterance (epoch)
  private diagChunkIndex = 0;
  private diagEpoch = -1;
  private diagPrevChunkEndSec = 0;

  constructor(audioEngine: AudioEngine, private readonly getAgentId: () => string) {
    this.audioEngine = audioEngine;
    this.micCapture = new MicCapture(this.audioEngine.ctx);
    this.wssClient = new RawWssClient(this.getAgentId());

    this.setupWssListeners();
  }

  private setupWssListeners(): void {
    this.wssClient.setCallbacks({
      onError: (err) => this.onError(err),
      onMetadata: (format) => {
        const f = format.outputFormat;
        if (!f) return;
        const match = /^pcm_(\d+)$/.exec(f);
        if (match) {
          this.agentOutputSampleRate = Number(match[1]);
          console.log(`[SpeechBackend] Agent audio format: ${f} -> ${this.agentOutputSampleRate} Hz`);
        } else {
          console.warn(`[SpeechBackend] unsupported agent output format '${f}' - keeping ${this.agentOutputSampleRate} Hz (expected pcm_<rate>).`);
        }
      },

      onAudioChunk: (payload: AudioEventPayload) => {
        const pcmBytes = base64ToPcmBytes(payload.audio_base_64);
        const epoch = this.audioEngine.getEpoch();
        const sampleRate = this.agentOutputSampleRate;

        // Play the audio through the Web Audio API at the proper sample rate
        const scheduledStartTime = this.audioEngine.playChunk(pcmBytes, sampleRate, epoch);

        this.onStateChange('speaking');

        // 1. Check and normalize the alignment metadata (handles payload.alignment, normalized_alignment, characters etc.)
        const rawAlign = (payload.alignment ?? (payload as any).normalized_alignment ?? (payload as any).alignments) as any;
        let alignment: CharAlignment | null = null;

        if (rawAlign) {
          const rawChars = rawAlign.chars ?? rawAlign.characters;
          if (Array.isArray(rawChars) && rawChars.length > 0) {
            let startTimes: number[] = [];
            let durations: number[] = [];

            if (Array.isArray(rawAlign.char_start_times_ms)) {
              startTimes = rawAlign.char_start_times_ms;
            } else if (Array.isArray(rawAlign.character_start_times_seconds)) {
              startTimes = rawAlign.character_start_times_seconds.map((s: number) => s * 1000);
            }

            if (Array.isArray(rawAlign.char_durations_ms)) {
              durations = rawAlign.char_durations_ms;
            } else if (Array.isArray(rawAlign.character_end_times_seconds) && Array.isArray(rawAlign.character_start_times_seconds)) {
              durations = rawAlign.character_end_times_seconds.map((endSec: number, idx: number) => {
                const startSec = rawAlign.character_start_times_seconds[idx] ?? 0;
                return Math.max(25, (endSec - startSec) * 1000);
              });
            }

            if (startTimes.length === rawChars.length) {
              alignment = {
                chars: rawChars,
                char_start_times_ms: startTimes,
                char_durations_ms: durations.length === rawChars.length ? durations : rawChars.map(() => 50),
                source: 'elevenlabs',
              };
            }
          }
        }

        // 1b. RESCALE to the audio axis (v1.1): the text span in the EL alignment chunk often does NOT equal
        // the audio length of the chunk (observed ratio 0.56-2.5x). Text slices are disjoint, so the
        // error accumulates → drift in long sentences. We scale character times so that the end of the
        // last character coincides with the end of the audio chunk (inner proportions preserved).
        if (alignment && alignment.source === 'elevenlabs') {
          const audioDurMs = (pcmBytes.byteLength / 2 / sampleRate) * 1000;
          alignment = rescaleAlignmentToAudio(alignment, audioDurMs);
        }

        // 2. FALLBACK: if the ElevenLabs server did not attach alignment metadata or it is empty,
        // we generate a natural alignment straight from the PCM audio sample energy!
        if (!alignment || alignment.chars.length === 0) {
          alignment = generateEnergyFallbackAlignment(pcmBytes, sampleRate);
        }

        this.diagnoseSync(alignment, pcmBytes, epoch, scheduledStartTime);

        this.onAudioChunk(pcmBytes.buffer as ArrayBuffer, alignment, epoch, scheduledStartTime, sampleRate);
      },

      onInterruption: (reason = 'user_interrupted') => {
        console.log(`[SpeechBackend] Interruption from the server: ${reason}`);
        this.audioEngine.hardStop();
        this.onInterruption(reason);
        this.onStateChange('listening');
      },

      onUserTranscript: (text: string) => {
        this.onUserTranscript(text);
        this.onStateChange('thinking');
      },

      onAgentResponse: (text: string) => {
        console.log(`[SpeechBackend] Agent response: ${text}`);
        this.onAgentResponse(text);
      },

      onAgentCorrection: (text: string) => {
        this.onAgentCorrection(text);
      },

      onVadScore: (score: number) => {
        if (score > 0.5 && !this.audioEngine.hasPendingAudio()) {
          this.onStateChange('listening');
        }
      },

      onStateChange: (netState) => {
        if (netState === 'disconnected') {
          this.onStateChange('idle');
        }
      },
    });
  }

  public start(): Promise<void> {
    if (this.isRunning) return Promise.resolve();
    if (this.startPromise) return this.startPromise;
    const generation = this.startGeneration;
    const pending = this.startSession(generation);
    this.startPromise = pending;
    void pending.finally(() => {
      if (this.startPromise === pending) this.startPromise = null;
    }).catch(() => undefined);
    return pending;
  }

  private async startSession(generation: number): Promise<void> {
    try {
      await this.audioEngine.unlock();
    } catch (err) {
      if (generation !== this.startGeneration) return;
      throw err;
    }
    if (generation !== this.startGeneration) return;

    try {
      await this.micCapture.start((base64Chunk: string) => {
        if (!this.isMuted && this.isRunning) this.wssClient.sendUserAudio(base64Chunk);
      });
    } catch (err) {
      if (generation !== this.startGeneration) return;
      this.onStateChange('idle');
      throw new MicAccessError(err);
    }
    if (generation !== this.startGeneration) {
      this.micCapture.stop();
      return;
    }

    this.wssClient.connect(this.getAgentId());
    this.isRunning = true;
    this.onStateChange('listening');
  }

  public async stop(): Promise<void> {
    this.startGeneration++;
    if (!this.isRunning) return;

    this.isRunning = false;
    this.micCapture.stop();
    this.wssClient.disconnect();
    this.audioEngine.hardStop();
    this.onStateChange('idle');
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    console.log(`[SpeechBackend] Microphone: ${muted ? 'muted' : 'active'}`);
  }

  public triggerInterruption(reason = 'client_interrupted'): void {
    console.log(`[SpeechBackend] Forced interruption: ${reason}`);
    this.audioEngine.hardStop();
    this.onInterruption(reason);
    this.onStateChange('listening');
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  /** Input device selection (F11) — applied on the next capture start. */
  public setInputDevice(deviceId: string | null): void {
    this.micCapture.setDeviceId(deviceId);
  }

  public async listInputDevices(): Promise<Array<{ id: string; label: string }>> {
    return this.micCapture.listDevices();
  }

  public getAudioEngine(): AudioEngine {
    return this.audioEngine;
  }

  /**
   * Actual sampleRate of the agent output for the current session (adapted from WSS metadata).
   * Used by LastTurnBuffer/the A/B comparison (F11) among others — never hardcode 44100.
   */
  public getOutputSampleRate(): number {
    return this.agentOutputSampleRate;
  }

  /**
   * AV sync diagnostics (v1.1): logs per chunk the ratio of the FINAL alignment span
   * (after the rescale to the audio axis) to the audio chunk length, and the gaps between chunks.
   * After the rescale the ratio should be ~1.0; deviations signal pathologies (fallback, empty chunk,
   * network jitter), not intentional drift (that is removed by rescaleAlignmentToAudio).
   */
  private diagnoseSync(
    alignment: CharAlignment,
    pcmBytes: Uint8Array,
    epoch: number,
    scheduledStartTime: number
  ): void {
    if (this.diagEpoch !== epoch) {
      this.diagEpoch = epoch;
      this.diagChunkIndex = 0;
      this.diagPrevChunkEndSec = 0;
    }
    const index = this.diagChunkIndex++;
    const samples = Math.floor(pcmBytes.byteLength / 2);
    const audioDurMs = (samples / this.agentOutputSampleRate) * 1000;

    const isFallback = alignment.source === 'energy-fallback';
    const n = alignment.chars.length;
    const alignEndMs =
      n > 0 && alignment.char_durations_ms.length === n
        ? (alignment.char_start_times_ms[n - 1] ?? 0) + (alignment.char_durations_ms[n - 1] ?? 0)
        : 0;
    const ratio = !isFallback && audioDurMs > 0 && alignEndMs > 0 ? alignEndMs / audioDurMs : -1;

    const gapMs = index > 0 ? (scheduledStartTime - this.diagPrevChunkEndSec) * 1000 : 0;
    if (scheduledStartTime > 0 && index === 0) this.diagPrevChunkEndSec = scheduledStartTime;
    if (scheduledStartTime > 0) {
      this.diagPrevChunkEndSec = Math.max(
        this.diagPrevChunkEndSec,
        scheduledStartTime + audioDurMs / 1000
      );
    }

    const flags: string[] = [];
    if (isFallback) flags.push('FALLBACK (no alignment from EL)');
    else if (alignEndMs <= 0) flags.push('empty alignment');
    // EL boundary chunks (<150 ms) tend to have slightly misaligned text/audio boundaries — skipped.
    else if (audioDurMs >= 150 && (ratio < 0.9 || ratio > 1.1))
      flags.push(`ratio=${ratio.toFixed(2)} outside [0.9,1.1]`);
    // A mid-utterance gap (30..1500 ms) = jitter worth noting; otherwise a normal pause between turns.
    if (gapMs > 30 && gapMs < 1500) flags.push(`GAP ${gapMs.toFixed(0)}ms`);
    if (samples === 0) flags.push('empty chunk');

    // Dump of the first chunk of the utterance — a look at the times (after the rescale).
    if (index === 0) {
      console.log(
        '[AlignDiag] first-chunk',
        JSON.stringify({
          epoch,
          audioDurMs: Math.round(audioDurMs),
          chars: alignment.chars.slice(0, 40).join('|'),
          startTimesMs: alignment.char_start_times_ms.slice(0, 20),
          dursMs: alignment.char_durations_ms.slice(0, 20),
        })
      );
    }

    const log =
      `[AlignDiag] e${epoch}#${index} audio=${audioDurMs.toFixed(0)}ms` +
      (isFallback
        ? ' align=fallback'
        : ` alignEnd=${alignEndMs.toFixed(0)}ms ratio=${ratio.toFixed(2)} n=${n}`) +
      ` start=${scheduledStartTime.toFixed(3)}s` +
      (flags.length ? ` ⚠ ${flags.join(' | ')}` : ' ✓');
    if (flags.length) console.warn(log);
    else if (index < 4) console.log(log);
  }

  /**
   * Simulates an agent utterance (for offline tests and demos without an active API key)
   */
  public triggerDemoSpeech(phrase = 'Hello, I am your interactive 3D avatar.'): void {
    const epoch = this.audioEngine.getEpoch();
    this.onStateChange('speaking');

    // Generate audio samples (modulated speech-like sound)
    const sampleRate = 44100;
    const durationSec = 2.4;
    const totalSamples = Math.floor(sampleRate * durationSec);
    const int16Buffer = new Int16Array(totalSamples);

    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      // Voiced sound with a speech envelope
      const envelope = Math.sin((t / durationSec) * Math.PI);
      const voice =
        0.5 * Math.sin(2 * Math.PI * 140 * t) +
        0.3 * Math.sin(2 * Math.PI * 280 * t) +
        0.2 * Math.sin(2 * Math.PI * 420 * t);
      int16Buffer[i] = Math.floor(voice * envelope * 12000);
    }

    const base64 = int16ToBase64(int16Buffer);
    const pcmBytes = base64ToPcmBytes(base64);

    // Split the phrase into characters with approximate durations
    const chars = phrase.split('');
    const charTimes: number[] = [];
    const charDurs: number[] = [];

    const charDurationMs = (durationSec * 1000) / chars.length;

    for (let i = 0; i < chars.length; i++) {
      charTimes.push(i * charDurationMs);
      charDurs.push(charDurationMs);
    }

    const alignment: CharAlignment = {
      chars,
      char_start_times_ms: charTimes,
      char_durations_ms: charDurs,
    };

    const scheduled = this.audioEngine.playChunk(pcmBytes, sampleRate, epoch);
    this.onAudioChunk(pcmBytes.buffer as ArrayBuffer, alignment, epoch, scheduled, sampleRate);

    setTimeout(() => {
      if (!this.audioEngine.hasPendingAudio()) {
        this.onStateChange('idle');
      }
    }, durationSec * 1000 + 300);
  }
}
