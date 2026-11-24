/**
 * ConversationController (Phase 11, 11-02) — extracted from `main.ts`.
 *
 * Responsible for: conversation start/stop, mute, barge-in, demo speech, the PoC stress test and
 * the embed bridge (postMessage). Emits only STATE events on the bus; does not touch the DOM.
 */
import { ElevenAgentsSpeechBackend, MicAccessError } from '../audio/speech-backend';
import { AudioEngine } from '../audio/audio-engine';
import { EmbedBridge } from '../prod/embed-bridge';
import { TypedEventBus } from '../app/events';
import { AppEvents, ConversationService } from '../app/app-types';
import { t } from '../app/copy';

export interface ConversationControllerDeps {
  speechBackend: ElevenAgentsSpeechBackend;
  audioEngine: AudioEngine;
  embedBridge: EmbedBridge;
  events: TypedEventBus<AppEvents>;
}

export class ConversationController implements ConversationService {
  private readonly speechBackend: ElevenAgentsSpeechBackend;
  private readonly audioEngine: AudioEngine;
  private readonly embedBridge: EmbedBridge;
  private readonly events: TypedEventBus<AppEvents>;
  private startPromise: Promise<void> | null = null;

  constructor(deps: ConversationControllerDeps) {
    this.speechBackend = deps.speechBackend;
    this.audioEngine = deps.audioEngine;
    this.embedBridge = deps.embedBridge;
    this.events = deps.events;
    this.setupBackendCallbacks();
    this.setupEmbedBridge();
  }

  private setupBackendCallbacks(): void {
    this.speechBackend.onError = (err) => {
      this.events.emit('voice:error', err.message);
      this.events.emit('toast', { message: err.message, type: 'error' });
      void this.stop().catch(() => undefined);
    };

    this.speechBackend.onStateChange = (state) => {
      this.events.emit('voice:state', state);
      this.embedBridge.notifyStateChange(state);
    };

    this.speechBackend.onUserTranscript = (text) => {
      this.events.emit('transcript:user', text);
      this.embedBridge.notifyTranscript('user', text);
    };

    this.speechBackend.onAgentResponse = (text) => {
      this.events.emit('transcript:agent', text);
      this.embedBridge.notifyTranscript('agent', text);
    };

    // After a barge-in the server sends the text that was actually spoken: it REPLACES the stale caption.
    this.speechBackend.onAgentCorrection = (text) => {
      this.events.emit('transcript:agent', text);
      this.embedBridge.notifyTranscript('agent', text);
    };

    this.speechBackend.onAudioChunk = (pcm, alignment, epoch, scheduledStartTime, sampleRate) => {
      const startTime = typeof scheduledStartTime === 'number' ? scheduledStartTime : this.audioEngine.getTailTime();
      this.events.emit('audio:chunk', {
        bytes: new Uint8Array(pcm),
        alignment,
        epoch,
        startTime,
        sampleRate,
      });
    };

    this.speechBackend.onInterruption = (reason) => {
      this.events.emit('speech:interruption', reason);
    };
  }

  private setupEmbedBridge(): void {
    this.embedBridge.setCallbacks({
      onConnect: () => {
        if (!this.speechBackend.getIsRunning()) {
          this.start().catch(() => undefined);
        }
      },
      onDisconnect: () => {
        this.stop().catch(() => undefined);
      },
      onInterrupt: () => this.interrupt(),
      onSay: (text) => this.say(text),
    });
  }

  /**
   * Teardown for the composition root: ends a running session (WSS closed, microphone tracks
   * stopped, audio hard-stopped via `speechBackend.stop()`), then detaches every callback this
   * controller installed on the backend and the embed bridge so nothing can emit on, or start a
   * session for, a disposed app.
   */
  public dispose(): void {
    void this.speechBackend.stop().catch(() => undefined);
    const noop = (): void => undefined;
    this.speechBackend.onError = noop;
    this.speechBackend.onStateChange = noop;
    this.speechBackend.onUserTranscript = noop;
    this.speechBackend.onAgentResponse = noop;
    this.speechBackend.onAgentCorrection = noop;
    this.speechBackend.onAudioChunk = noop;
    this.speechBackend.onInterruption = noop;
    this.embedBridge.setCallbacks({
      onConnect: undefined,
      onDisconnect: undefined,
      onInterrupt: undefined,
      onSay: undefined,
    });
  }

  public start(): Promise<void> {
    if (this.speechBackend.getIsRunning()) return Promise.resolve();
    if (this.startPromise) return this.startPromise;
    const pending = this.startSession();
    this.startPromise = pending;
    void pending
      .finally(() => {
        if (this.startPromise === pending) this.startPromise = null;
      })
      .catch(() => undefined);
    return pending;
  }

  private async startSession(): Promise<void> {
    try {
      await this.speechBackend.start();
    } catch (error) {
      const message = error instanceof MicAccessError ? error.message : t('toast.connectionError', { message: (error as Error).message });
      this.events.emit('voice:error', message);
      this.events.emit('toast', { message, type: 'error' });
      throw error;
    }
  }

  public async stop(): Promise<void> {
    await this.speechBackend.stop();
  }

  public async toggle(): Promise<void> {
    if (this.speechBackend.getIsRunning() || this.startPromise) {
      // 15-05 de-spam: session lifecycle is shown by the dock button + status pill, not by a toast.
      await this.stop();
      return;
    }
    await this.start().catch(() => undefined);
  }

  public toggleMute(): void {
    const muted = !this.speechBackend.getIsMuted();
    this.speechBackend.setMuted(muted);
    // 15-05 de-spam: the mute state is shown by the dock button (label, icon, aria-pressed).
    this.events.emit('voice:muted', muted);
  }

  public isMuted(): boolean {
    return this.speechBackend.getIsMuted();
  }

  public isRunning(): boolean {
    return this.speechBackend.getIsRunning();
  }

  public interrupt(): void {
    this.audioEngine.hardStop();
    this.events.emit('speech:interruption', 'client_interrupted');
    // 15-05 de-spam: barge-in feedback is the caption flash + the face relaxing, not a popup.
    this.events.emit('voice:state', 'listening');
  }

  public say(text: string): void {
    this.speechBackend.triggerDemoSpeech(text);
  }

  public setInputDevice(deviceId: string | null): void {
    this.speechBackend.setInputDevice(deviceId);
  }

  public async listInputDevices(): Promise<Array<{ id: string; label: string }>> {
    return this.speechBackend.listInputDevices();
  }

  public async runPocStress(): Promise<void> {
    this.events.emit('toast', {
      message: t('poc.start'),
      type: 'success',
    });
    this.events.emit('transcript:user', t('poc.transcriptUser'));

    this.events.emit('transcript:agent', t('poc.phase1'));
    this.speechBackend.triggerDemoSpeech('First phrase will be abruptly interrupted midway.');
    await new Promise((resolve) => setTimeout(resolve, 600));

    this.audioEngine.hardStop();
    this.events.emit('speech:interruption', 'poc-stress');
    this.events.emit('toast', { message: t('poc.interrupt1'), type: 'success' });
    await new Promise((resolve) => setTimeout(resolve, 300));

    this.events.emit('transcript:agent', t('poc.phase2'));
    this.speechBackend.triggerDemoSpeech('Second phrase tested for bilabial stop.');
    await new Promise((resolve) => setTimeout(resolve, 400));

    this.audioEngine.hardStop();
    this.events.emit('speech:interruption', 'poc-stress');
    this.events.emit('toast', { message: t('poc.interrupt2'), type: 'success' });
    await new Promise((resolve) => setTimeout(resolve, 300));

    this.events.emit('transcript:agent', t('poc.phase3'));
    this.speechBackend.triggerDemoSpeech('Final smooth sentence demonstrating natural relaxation.');
    this.events.emit('toast', { message: t('poc.done'), type: 'success' });
  }
}
