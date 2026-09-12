import { CharAlignment } from './avatar';

/**
 * Zdarzenia przesyłane z serwera ElevenAgents do klienta (S2C)
 */
export interface AudioEventPayload {
  audio_base_64: string;
  event_id?: number;
  alignment?: CharAlignment;
}

export interface AudioServerMsg {
  type: 'audio';
  audio_event: AudioEventPayload;
}

export interface PingServerMsg {
  type: 'ping';
  ping_event: {
    event_id: number;
    ping_ms?: number;
  };
}

export interface InterruptionServerMsg {
  type: 'interruption';
  interruption_event?: {
    reason?: string;
  };
}

export interface UserTranscriptServerMsg {
  type: 'user_transcript';
  user_transcription_event: {
    user_transcript: string;
  };
}

export interface AgentResponseServerMsg {
  type: 'agent_response';
  agent_response_event: {
    agent_response: string;
  };
}

export interface AgentCorrectionServerMsg {
  type: 'agent_response_correction';
  agent_response_correction_event: {
    corrected_agent_response: string;
  };
}

export interface VadScoreServerMsg {
  type: 'vad_score';
  vad_score_event?: {
    vad_score: number;
  };
}

export interface MetadataServerMsg {
  type: 'conversation_initiation_metadata';
  conversation_initiation_metadata_event?: {
    conversation_id?: string;
    agent_output_audio_format?: string;
    user_input_audio_format?: string;
  };
}

export type ServerToClientMsg =
  | AudioServerMsg
  | PingServerMsg
  | InterruptionServerMsg
  | UserTranscriptServerMsg
  | AgentResponseServerMsg
  | AgentCorrectionServerMsg
  | VadScoreServerMsg
  | MetadataServerMsg;

/**
 * Zdarzenia przesyłane od klienta do serwera ElevenAgents (C2S)
 */
export interface ClientInitMsg {
  type: 'conversation_initiation_client_data';
  custom_config?: Record<string, unknown>;
  contextual_update?: { text?: string };
}

export interface UserAudioChunkMsg {
  user_audio_chunk: string;
}

export interface PongClientMsg {
  type: 'pong';
  event_id: number;
}

export type ClientToServerMsg = ClientInitMsg | UserAudioChunkMsg | PongClientMsg;
