import { resampleFloat32, float32ToInt16, int16ToBase64 } from './pcm-resampler';

/** Buduje constraints getUserMedia z opcjonalnym wyborem urządzenia (F11). */
export function buildAudioConstraints(deviceId: string | null): MediaTrackConstraints {
  return {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    ...(deviceId && deviceId.trim() !== '' ? { deviceId: { exact: deviceId } } : {}),
  };
}

export class MicCapture {
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private isRunning = false;
  private deviceId: string | null = null;

  constructor(existingCtx?: AudioContext) {
    if (existingCtx) {
      this.audioCtx = existingCtx;
    }
  }

  /** Ustawia urządzenie wejściowe (stosowane przy następnym starcie). */
  public setDeviceId(deviceId: string | null): void {
    this.deviceId = deviceId && deviceId.trim() !== '' ? deviceId : null;
  }

  public getDeviceId(): string | null {
    return this.deviceId;
  }

  /** Lista dostępnych wejść audio (bez uprawnień etykiety mogą być puste). */
  public async listDevices(): Promise<Array<{ id: string; label: string }>> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((device) => device.kind === 'audioinput')
        .map((device) => ({ id: device.deviceId, label: device.label || 'Mikrofon' }));
    } catch (error) {
      console.warn('[MicCapture] Nie udało się pobrać listy urządzeń:', error);
      return [];
    }
  }

  public async unlockAudioContext(): Promise<AudioContext> {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    return this.audioCtx;
  }

  public async start(onChunk: (base64Chunk: string) => void): Promise<void> {
    if (this.isRunning) return;

    const ctx = await this.unlockAudioContext();

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: buildAudioConstraints(this.deviceId),
    });

    this.sourceNode = ctx.createMediaStreamSource(this.mediaStream);

    // Bufor 4096 próbek (~85ms przy 48kHz, ~92ms przy 44.1kHz)
    // optymalny rozmiar pakietu audio dla detekcji mowy serwerowego VAD
    const bufferSize = 4096;
    this.processorNode = ctx.createScriptProcessor(bufferSize, 1, 1);

    this.processorNode.onaudioprocess = (e: AudioProcessingEvent) => {
      if (!this.isRunning) return;

      const inputChannelData = e.inputBuffer.getChannelData(0);

      // 1. Resampling do 16 kHz
      const resampled = resampleFloat32(inputChannelData, ctx.sampleRate, 16000);

      // 2. Konwersja do 16-bit Int16 PCM
      const int16 = float32ToInt16(resampled);

      // 3. Kodowanie do base64 i wysyłka
      const base64Chunk = int16ToBase64(int16);
      onChunk(base64Chunk);
    };

    this.sourceNode.connect(this.processorNode);
    // Wyciszenie wyjścia procesora, aby uniknąć pętli sprzężenia zwrotnego (audio feedback)
    const silentGain = ctx.createGain();
    silentGain.gain.value = 0;
    this.processorNode.connect(silentGain);
    silentGain.connect(ctx.destination);

    this.isRunning = true;
    console.log(`[MicCapture] Mikrofon aktywny. Częstotliwość źródłowa: ${ctx.sampleRate}Hz -> wyjście: 16000Hz`);
  }

  public stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }

    console.log('[MicCapture] Mikrofon zatrzymany.');
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }
}
