import { resampleFloat32, float32ToInt16, int16ToBase64 } from './pcm-resampler';

/** Builds getUserMedia constraints with an optional device choice (F11). */
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

  /** Sets the input device (applied on the next start). */
  public setDeviceId(deviceId: string | null): void {
    this.deviceId = deviceId && deviceId.trim() !== '' ? deviceId : null;
  }

  public getDeviceId(): string | null {
    return this.deviceId;
  }

  /** List of available audio inputs (without permissions the labels may be empty). */
  public async listDevices(): Promise<Array<{ id: string; label: string }>> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((device) => device.kind === 'audioinput')
        .map((device) => ({ id: device.deviceId, label: device.label || 'Microphone' }));
    } catch (error) {
      console.warn('[MicCapture] Could not fetch the device list:', error);
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

    // Buffer of 4096 samples (~85ms at 48kHz, ~92ms at 44.1kHz)
    // optimal audio packet size for the server-side VAD speech detection
    const bufferSize = 4096;
    this.processorNode = ctx.createScriptProcessor(bufferSize, 1, 1);

    this.processorNode.onaudioprocess = (e: AudioProcessingEvent) => {
      if (!this.isRunning) return;

      const inputChannelData = e.inputBuffer.getChannelData(0);

      // 1. Resampling do 16 kHz
      const resampled = resampleFloat32(inputChannelData, ctx.sampleRate, 16000);

      // 2. Conversion to 16-bit Int16 PCM
      const int16 = float32ToInt16(resampled);

      // 3. Encode to base64 and send
      const base64Chunk = int16ToBase64(int16);
      onChunk(base64Chunk);
    };

    this.sourceNode.connect(this.processorNode);
    // Mute the processor output to avoid a feedback loop (audio feedback)
    const silentGain = ctx.createGain();
    silentGain.gain.value = 0;
    this.processorNode.connect(silentGain);
    silentGain.connect(ctx.destination);

    this.isRunning = true;
    // eslint-disable-next-line no-console -- trace log, not a diagnostic: kept as console.log on purpose (warn/error are the diagnostic channels)
    console.log(`[MicCapture] Microphone active. Source sample rate: ${ctx.sampleRate}Hz -> output: 16000Hz`);
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

    // eslint-disable-next-line no-console -- trace log, not a diagnostic: kept as console.log on purpose (warn/error are the diagnostic channels)
    console.log('[MicCapture] Microphone stopped.');
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }
}
