import { SpeechBackend, CharAlignment } from '../types/avatar';
import { RawWssClient } from './raw-wss-client';
import { MicCapture } from './mic-capture';
import { AudioEngine } from './audio-engine';
import { base64ToPcmBytes, int16ToBase64 } from './pcm-resampler';
import { AudioEventPayload } from '../types/audio';
import { getActiveAgentId } from './agent-config';
import { generateEnergyFallbackAlignment } from './energy-fallback';
import { rescaleAlignmentToAudio } from './alignment-rescale';

export class ElevenAgentsSpeechBackend implements SpeechBackend {
  public onAudioChunk: (
    pcm: ArrayBuffer,
    alignment: CharAlignment,
    epoch: number,
    scheduledStartTime?: number
  ) => void = () => {};
  public onInterruption: (reason: string) => void = () => {};
  public onUserTranscript: (text: string) => void = () => {};
  public onAgentResponse: (text: string) => void = () => {};
  public onStateChange: (state: 'listening' | 'speaking' | 'thinking' | 'idle') => void = () => {};

  private readonly wssClient: RawWssClient;
  private readonly micCapture: MicCapture;
  private readonly audioEngine: AudioEngine;

  private isRunning = false;
  private isMuted = false;
  private agentOutputSampleRate = 16000; // domyślnie 16000 dla ElevenLabs ConvAI, adaptowane z metadata

  // Diagnostyka synchronizacji AV (docs/3): stan per wypowiedź (epoch)
  private diagChunkIndex = 0;
  private diagEpoch = -1;
  private diagPrevChunkEndSec = 0;

  constructor(audioEngine: AudioEngine) {
    this.audioEngine = audioEngine;
    this.micCapture = new MicCapture(this.audioEngine.ctx);
    this.wssClient = new RawWssClient(getActiveAgentId());

    this.setupWssListeners();
  }

  private setupWssListeners(): void {
    this.wssClient.setCallbacks({
      onMetadata: (format) => {
        if (format.outputFormat) {
          if (format.outputFormat.includes('16000')) this.agentOutputSampleRate = 16000;
          else if (format.outputFormat.includes('24000')) this.agentOutputSampleRate = 24000;
          else if (format.outputFormat.includes('44100')) this.agentOutputSampleRate = 44100;
          else if (format.outputFormat.includes('48000')) this.agentOutputSampleRate = 48000;
          console.log(`[SpeechBackend] Format audio agenta: ${format.outputFormat} -> sampleRate: ${this.agentOutputSampleRate}Hz`);
        }
      },

      onAudioChunk: (payload: AudioEventPayload) => {
        const pcmBytes = base64ToPcmBytes(payload.audio_base_64);
        const epoch = this.audioEngine.getEpoch();

        // Odtwarzamy audio przez Web Audio API z właściwą częstotliwością próbkowania
        const scheduledStartTime = this.audioEngine.playChunk(pcmBytes, this.agentOutputSampleRate, epoch);

        this.onStateChange('speaking');

        // 1. Sprawdzamy i normalizujemy metadane alignmentu (obsługa payload.alignment, normalized_alignment, characters itp.)
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

        // 1b. RESCALE do osi audio (v1.1): rozpiętość tekstu w chuście EL często NIE równa się
        // długości audio chunka (obserwowane ratio 0.56-2.5x). Slices tekstu są rozłączne, więc
        // błąd kumuluje się → dryf w długich zdaniach. Skalujemy czasy znaków tak, by koniec
        // ostatniego znaku pokrywał się z końcem audio chunka (proporcje wewnątrz zachowane).
        if (alignment && alignment.source === 'elevenlabs') {
          const audioDurMs = (pcmBytes.byteLength / 2 / this.agentOutputSampleRate) * 1000;
          alignment = rescaleAlignmentToAudio(alignment, audioDurMs);
        }

        // 2. FALLBACK: Jeśli serwer ElevenLabs nie dołączył metadanych alignmentu lub są puste,
        // generujemy naturalny alignment wprost z energii próbek audio PCM!
        if (!alignment || alignment.chars.length === 0) {
          alignment = generateEnergyFallbackAlignment(pcmBytes, this.agentOutputSampleRate);
        }

        this.diagnoseSync(alignment, pcmBytes, epoch, scheduledStartTime);

        this.onAudioChunk(pcmBytes.buffer as ArrayBuffer, alignment, epoch, scheduledStartTime);
      },

      onInterruption: (reason = 'user_interrupted') => {
        console.log(`[SpeechBackend] Przerwanie z serwera: ${reason}`);
        this.audioEngine.hardStop();
        this.onInterruption(reason);
        this.onStateChange('listening');
      },

      onUserTranscript: (text: string) => {
        this.onUserTranscript(text);
        this.onStateChange('thinking');
      },

      onAgentResponse: (text: string) => {
        console.log(`[SpeechBackend] Odpowiedź agenta: ${text}`);
        this.onAgentResponse(text);
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

  public async start(): Promise<void> {
    if (this.isRunning) return;

    await this.audioEngine.unlock();

    // 1. Połączenie WebSocket
    this.wssClient.connect(getActiveAgentId());

    // 2. Start mikrofonu
    try {
      await this.micCapture.start((base64Chunk: string) => {
        if (!this.isMuted && this.isRunning) {
          this.wssClient.sendUserAudio(base64Chunk);
        }
      });
    } catch (err) {
      console.warn('[SpeechBackend] Nie udało się otworzyć mikrofonu (brak uprawnień/urządzenia):', err);
    }

    this.isRunning = true;
    this.onStateChange('listening');
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.micCapture.stop();
    this.wssClient.disconnect();
    this.audioEngine.hardStop();

    this.onStateChange('idle');
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    console.log(`[SpeechBackend] Mikrofon: ${muted ? 'Wyciszony' : 'Aktywny'}`);
  }

  public triggerInterruption(reason = 'client_interrupted'): void {
    console.log(`[SpeechBackend] Wymuszone przerwanie: ${reason}`);
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

  /** Wybór urządzenia wejściowego (F11) — stosowany przy następnym starcie capture. */
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
   * Rzeczywisty sampleRate wyjścia agenta dla bieżącej sesji (adaptowany z metadata WSS).
   * Używany m.in. przez LastTurnBuffer/porównywarkę A/B (F11) — nigdy nie hardcode 44100.
   */
  public getOutputSampleRate(): number {
    return this.agentOutputSampleRate;
  }

  /**
   * Diagnostyka synchronizacji AV (v1.1): loguje per chunk relację rozpiętości FINALNEGO
   * alignmentu (po rescale do osi audio) do długości audio chunka oraz luki między chunkami.
   * Po rescale ratio powinno być ~1.0; odstępstwa sygnalizują patologie (fallback, pusty chunk,
   * jitter sieci), a nie celowy dryf (ten usuwa rescaleAlignmentToAudio).
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
    if (isFallback) flags.push('FALLBACK (brak alignmentu z EL)');
    else if (alignEndMs <= 0) flags.push('pusty alignment');
    // Chunki graniczne EL (<150 ms) miewaja lekko rozjechane granice tekst/audio — pomijamy.
    else if (audioDurMs >= 150 && (ratio < 0.9 || ratio > 1.1))
      flags.push(`ratio=${ratio.toFixed(2)} poza [0.9,1.1]`);
    // Luka mid-wypowiedzi (30..1500 ms) = jitter wart uwagi; poza tym normalna przerwa miedzy turami.
    if (gapMs > 30 && gapMs < 1500) flags.push(`LUKA ${gapMs.toFixed(0)}ms`);
    if (samples === 0) flags.push('pusty chunk');

    // Dump pierwszego chunka wypowiedzi — podgląd czasów (po rescale).
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
   * Symuluje wypowiedź agenta (do testów offline i demo bez aktywnego klucza API)
   */
  public triggerDemoSpeech(phrase = 'Hello, I am your interactive 3D avatar.'): void {
    const epoch = this.audioEngine.getEpoch();
    this.onStateChange('speaking');

    // Generujemy próbki audio (modulowany dźwięk mowy)
    const sampleRate = 44100;
    const durationSec = 2.4;
    const totalSamples = Math.floor(sampleRate * durationSec);
    const int16Buffer = new Int16Array(totalSamples);

    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      // Dźwięk foniczny z obwiednią mowy
      const envelope = Math.sin((t / durationSec) * Math.PI);
      const voice =
        0.5 * Math.sin(2 * Math.PI * 140 * t) +
        0.3 * Math.sin(2 * Math.PI * 280 * t) +
        0.2 * Math.sin(2 * Math.PI * 420 * t);
      int16Buffer[i] = Math.floor(voice * envelope * 12000);
    }

    const base64 = int16ToBase64(int16Buffer);
    const pcmBytes = base64ToPcmBytes(base64);

    // Dzielimy frazę na znaki z przybliżonym czasem trwania
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
    this.onAudioChunk(pcmBytes.buffer as ArrayBuffer, alignment, epoch, scheduled);

    setTimeout(() => {
      if (!this.audioEngine.hasPendingAudio()) {
        this.onStateChange('idle');
      }
    }, durationSec * 1000 + 300);
  }
}
