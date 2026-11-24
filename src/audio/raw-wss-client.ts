import {
  ServerToClientMsg,
  AudioEventPayload,
  PongClientMsg,
  ClientInitMsg,
  UserAudioChunkMsg,
} from '../types/audio';
import { DEFAULT_AGENT_CONFIG } from './agent-config';

const MAX_RECONNECT_ATTEMPTS = 5;

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
  private lastSocketError: string | null = null;

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
      const socket = new WebSocket(targetUrl);
      this.ws = socket;
      this.bindSocketEvents(socket);
    } catch (err) {
      this.handleSocketFailure(err as Error);
    }
  }

  private bindSocketEvents(socket: WebSocket): void {
    socket.onopen = () => {
      if (this.ws !== socket) return;
      this.setState('connected');

      // 1. Client handshake with initialization (docs/2)
      const initMsg: ClientInitMsg = {
        type: 'conversation_initiation_client_data',
        contextual_update: { text: 'User initiated conversation session' },
      };
      this.sendJson(initMsg);
    };

    socket.onmessage = (event: MessageEvent) => {
      if (this.ws !== socket) return;
      try {
        const msg = JSON.parse(event.data) as ServerToClientMsg;
        this.handleServerMessage(msg, socket);
      } catch (err) {
        console.warn('[RawWssClient] Message parsing error:', err);
      }
    };

    socket.onerror = (e) => {
      if (this.ws !== socket) return;
      this.lastSocketError = typeof ErrorEvent !== 'undefined' && e instanceof ErrorEvent && e.message
        ? e.message.slice(0, 200)
        : 'WebSocket connection error';
      console.warn('[RawWssClient] WebSocket error event:', e);
    };

    socket.onclose = (event: CloseEvent) => {
      if (this.ws !== socket) return;
      this.ws = null;
      if (this.intentionalClose) { this.setState('disconnected'); return; }
      const fatal = event.code === 1008 || (event.code >= 4000 && event.code < 5000);
      if (fatal) {
        const context = this.lastSocketError ? ` ${this.lastSocketError}.` : '';
        this.fail(new Error(`The voice agent rejected the connection (${event.reason || `code ${event.code}`}).${context}`));
        return;
      }
      this.scheduleReconnect();
    };
  }

  private handleServerMessage(msg: ServerToClientMsg, socket: WebSocket): void {
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
            if (this.ws !== socket) return;
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
        if (meta) {
          this.reconnectAttempts = 0;
          this.lastSocketError = null;
        }
        if (meta && this.callbacks.onMetadata) {
          this.callbacks.onMetadata({
            outputFormat: meta.agent_output_audio_format,
            inputFormat: meta.user_input_audio_format,
          });
        }
        break;
      }

      default:
        // Other notifications (agent_metadata, tool calls)
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
    this.reconnectAttempts = 0;
    this.lastSocketError = null;
    this.clearReconnectTimer();
    const socket = this.ws;
    this.ws = null;
    socket?.close(1000, 'Intentional client disconnect');
    this.setState('disconnected');
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      const context = this.lastSocketError ? ` (${this.lastSocketError})` : '';
      this.fail(new Error(`Could not reach the voice agent after ${MAX_RECONNECT_ATTEMPTS} attempts${context}. Check your connection and try again.`));
      return;
    }
    this.setState('reconnecting');
    this.reconnectAttempts++;

    // Exponential backoff: 1s, 2s, 4s, 8s, max 16s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);
    console.log(`[RawWssClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`);

    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  private handleSocketFailure(err: Error): void {
    this.lastSocketError = err.message.slice(0, 200);
    console.error('[RawWssClient] Socket connection error:', err);
    if (!this.intentionalClose) {
      this.scheduleReconnect();
    } else {
      this.setState('disconnected');
    }
  }

  private fail(err: Error): void {
    this.clearReconnectTimer();
    this.setState('disconnected');
    this.callbacks.onError?.(err);
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
