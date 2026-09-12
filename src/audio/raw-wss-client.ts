import {
  ServerToClientMsg,
  AudioEventPayload,
  PongClientMsg,
  ClientInitMsg,
  UserAudioChunkMsg,
} from '../types/audio';
import { DEFAULT_AGENT_CONFIG } from './agent-config';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface WssClientCallbacks {
  onAudioChunk?: (payload: AudioEventPayload) => void;
  onInterruption?: (reason?: string) => void;
  onUserTranscript?: (text: string) => void;
  onAgentResponse?: (text: string) => void;
  onAgentCorrection?: (correctedText: string) => void;
  onVadScore?: (score: number) => void;
  onStateChange?: (state: ConnectionState) => void;
  onMetadata?: (meta: { outputFormat?: string; inputFormat?: string }) => void;
  onError?: (err: Error) => void;
}

export class RawWssClient {
  private ws: WebSocket | null = null;
  private agentId: string;
  private signedUrl?: string;
  private callbacks: WssClientCallbacks;

  private state: ConnectionState = 'disconnected';
  private intentionalClose = false;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;

  constructor(agentId = DEFAULT_AGENT_CONFIG.agentId, callbacks: WssClientCallbacks = {}) {
    this.agentId = agentId;
    this.callbacks = callbacks;
  }

  public setCallbacks(callbacks: WssClientCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public connect(agentId?: string, signedUrl?: string): void {
    if (agentId) this.agentId = agentId;
    if (signedUrl) this.signedUrl = signedUrl;

    this.intentionalClose = false;
    this.clearReconnectTimer();

    const targetUrl = this.signedUrl
      ? this.signedUrl
      : `${DEFAULT_AGENT_CONFIG.wssBaseUrl}?agent_id=${encodeURIComponent(this.agentId)}`;

    this.setState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    try {
      this.ws = new WebSocket(targetUrl);
      this.bindSocketEvents();
    } catch (err) {
      this.handleSocketFailure(err as Error);
    }
  }

  private bindSocketEvents(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setState('connected');

      // 1. Handshake klienta z inicjalizacją (docs/2)
      const initMsg: ClientInitMsg = {
        type: 'conversation_initiation_client_data',
        contextual_update: { text: 'User initiated conversation session' },
      };
      this.sendJson(initMsg);
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data) as ServerToClientMsg;
        this.handleServerMessage(msg);
      } catch (err) {
        console.warn('[RawWssClient] Błąd parsowania wiadomości:', err);
      }
    };

    this.ws.onerror = (e) => {
      console.warn('[RawWssClient] WebSocket error event:', e);
    };

    this.ws.onclose = (_event: CloseEvent) => {
      this.ws = null;
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      } else {
        this.setState('disconnected');
      }
    };
  }

  private handleServerMessage(msg: ServerToClientMsg): void {
    switch (msg.type) {
      case 'audio': {
        const audioEvent = msg.audio_event;
        if (audioEvent && this.callbacks.onAudioChunk) {
          this.callbacks.onAudioChunk(audioEvent);
        }
        break;
      }

      case 'ping': {
        const pingEvent = msg.ping_event;
        if (pingEvent && typeof pingEvent.event_id === 'number') {
          const delay = pingEvent.ping_ms ?? 0;
          setTimeout(() => {
            const pong: PongClientMsg = {
              type: 'pong',
              event_id: pingEvent.event_id,
            };
            this.sendJson(pong);
          }, delay);
        }
        break;
      }

      case 'interruption': {
        const reason = msg.interruption_event?.reason;
        if (this.callbacks.onInterruption) {
          this.callbacks.onInterruption(reason);
        }
        break;
      }

      case 'user_transcript': {
        const transcript = msg.user_transcription_event?.user_transcript;
        if (transcript && this.callbacks.onUserTranscript) {
          this.callbacks.onUserTranscript(transcript);
        }
        break;
      }

      case 'agent_response': {
        const response = msg.agent_response_event?.agent_response;
        if (response && this.callbacks.onAgentResponse) {
          this.callbacks.onAgentResponse(response);
        }
        break;
      }

      case 'agent_response_correction': {
        const corrected = msg.agent_response_correction_event?.corrected_agent_response;
        if (corrected && this.callbacks.onAgentCorrection) {
          this.callbacks.onAgentCorrection(corrected);
        }
        break;
      }

      case 'vad_score': {
        const score = msg.vad_score_event?.vad_score;
        if (typeof score === 'number' && this.callbacks.onVadScore) {
          this.callbacks.onVadScore(score);
        }
        break;
      }

      case 'conversation_initiation_metadata': {
        const meta = msg.conversation_initiation_metadata_event;
        if (meta && this.callbacks.onMetadata) {
          this.callbacks.onMetadata({
            outputFormat: meta.agent_output_audio_format,
            inputFormat: meta.user_input_audio_format,
          });
        }
        break;
      }

      default:
        // Inne powiadomienia (agent_metadata, tool calls)
        break;
    }
  }

  public sendUserAudio(base64Chunk: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg: UserAudioChunkMsg = {
        user_audio_chunk: base64Chunk,
      };
      this.sendJson(msg);
    }
  }

  public disconnect(): void {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close(1000, 'Intentional client disconnect');
      this.ws = null;
    }
    this.setState('disconnected');
  }

  private scheduleReconnect(): void {
    this.setState('reconnecting');
    this.reconnectAttempts++;

    // Wykładniczy backoff: 1s, 2s, 4s, 8s, max 16s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);
    console.log(`[RawWssClient] Ponawianie połączenia za ${delay}ms (próba ${this.reconnectAttempts})...`);

    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  private handleSocketFailure(err: Error): void {
    console.error('[RawWssClient] Błąd połączenia socketu:', err);
    if (this.callbacks.onError) this.callbacks.onError(err);
    if (!this.intentionalClose) {
      this.scheduleReconnect();
    } else {
      this.setState('disconnected');
    }
  }

  private sendJson(data: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange(state);
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  public getState(): ConnectionState {
    return this.state;
  }
}
