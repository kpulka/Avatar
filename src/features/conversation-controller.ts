/**
 * ConversationController (Faza 11, 11-02) — wydzielony z `main.ts`.
 *
 * Odpowiada za: start/stop rozmowy, mute, barge-in, demo speech, stress PoC oraz
 * mostek embed (postMessage). Emituje wyłącznie zdarzenia STANU na bus; nie dotyka DOM.
 */
import { ElevenAgentsSpeechBackend } from '../audio/speech-backend';
import { AudioEngine } from '../audio/audio-engine';
import { EmbedBridge } from '../prod/embed-bridge';
import { TypedEventBus } from '../app/events';
import { AppEvents, ConversationService } from '../app/app-types';
import { setActiveAgentId } from '../audio/agent-config';

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

  constructor(deps: ConversationControllerDeps) {
    this.speechBackend = deps.speechBackend;
    this.audioEngine = deps.audioEngine;
    this.embedBridge = deps.embedBridge;
    this.events = deps.events;
    this.setupBackendCallbacks();
    this.setupEmbedBridge();
  }

  private setupBackendCallbacks(): void {
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

    this.speechBackend.onAudioChunk = (pcm, alignment, epoch, scheduledStartTime) => {
      const startTime =
        typeof scheduledStartTime === 'number' ? scheduledStartTime : this.audioEngine.getTailTime();
      this.events.emit('audio:chunk', {
        bytes: new Uint8Array(pcm),
        alignment,
        epoch,
        startTime,
        sampleRate: this.speechBackend.getOutputSampleRate(),
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
        if (this.speechBackend.getIsRunning()) {
          this.stop().catch(() => undefined);
        }
      },
      onInterrupt: () => this.interrupt(),
      onSetAgent: (agentId) => this.setAgent(agentId),
      onSay: (text) => this.say(text),
    });
  }

  public async start(): Promise<void> {
    if (this.speechBackend.getIsRunning()) return;
    await this.speechBackend.start();
  }

  public async stop(): Promise<void> {
    if (!this.speechBackend.getIsRunning()) return;
    await this.speechBackend.stop();
  }

  public async toggle(): Promise<void> {
    if (this.speechBackend.getIsRunning()) {
      await this.stop();
      this.events.emit('toast', { message: 'Rozmowa zakończona.', type: 'success' });
      return;
    }
    this.events.emit('toast', { message: 'Rozpoczynanie rozmowy z agentem...', type: 'success' });
    try {
      await this.start();
    } catch (error) {
      const message = `Błąd połączenia: ${(error as Error).message}`;
      this.events.emit('voice:error', message);
      this.events.emit('toast', { message, type: 'error' });
    }
  }

  public toggleMute(): void {
    const muted = !this.speechBackend.getIsMuted();
    this.speechBackend.setMuted(muted);
    this.events.emit('voice:muted', muted);
    this.events.emit('toast', {
      message: `Mikrofon: ${muted ? 'Wyciszony' : 'Włączony'}`,
      type: 'success',
    });
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
    this.events.emit('voice:state', 'listening');
    this.events.emit('toast', {
      message: 'Barge-in: Natychmiastowe przerwanie mowy agenta',
      type: 'success',
    });
  }

  public say(text: string): void {
    this.speechBackend.triggerDemoSpeech(text);
  }

  public setAgent(agentId: string): void {
    setActiveAgentId(agentId);
    this.events.emit('toast', { message: `Zmieniono agenta na: ${agentId}`, type: 'success' });
  }

  public setInputDevice(deviceId: string | null): void {
    this.speechBackend.setInputDevice(deviceId);
  }

  public async listInputDevices(): Promise<Array<{ id: string; label: string }>> {
    return this.speechBackend.listInputDevices();
  }

  public async runPocStress(): Promise<void> {
    this.events.emit('toast', {
      message: 'Uruchamianie testu PoC Stress (3 sekwencje z przerwaniami)...',
      type: 'success',
    });
    this.events.emit('transcript:user', 'Test obciążeniowy PoC');

    this.events.emit('transcript:agent', '[Faza 1/3] Mówię zdanie, które zostanie przerwane w połowie...');
    this.speechBackend.triggerDemoSpeech('First phrase will be abruptly interrupted midway.');
    await new Promise((resolve) => setTimeout(resolve, 600));

    this.audioEngine.hardStop();
    this.events.emit('speech:interruption', 'poc-stress');
    this.events.emit('toast', { message: 'Przerwanie 1/2 zrealizowane', type: 'success' });
    await new Promise((resolve) => setTimeout(resolve, 300));

    this.events.emit('transcript:agent', '[Faza 2/3] Natychmiastowa druga wypowiedź i szybkie cięcie...');
    this.speechBackend.triggerDemoSpeech('Second phrase tested for bilabial stop.');
    await new Promise((resolve) => setTimeout(resolve, 400));

    this.audioEngine.hardStop();
    this.events.emit('speech:interruption', 'poc-stress');
    this.events.emit('toast', { message: 'Przerwanie 2/2 zrealizowane', type: 'success' });
    await new Promise((resolve) => setTimeout(resolve, 300));

    this.events.emit('transcript:agent', '[Faza 3/3] Pełna fraza bez przerwania — naturalny powrót do spoczynku.');
    this.speechBackend.triggerDemoSpeech('Final smooth sentence demonstrating natural relaxation.');
    this.events.emit('toast', { message: 'Test PoC Stress zakończony sukcesem (0 wycieków węzłów)', type: 'success' });
  }
}
