/**
 * Konfiguracja integracji z agentem konwersacyjnym ElevenAgents (docs/2)
 */
export interface AgentConfig {
  /** Identyfikator publicznego lub prywatnego agenta */
  agentId: string;
  /** Podstawowy URL endpointu WebSocket */
  wssBaseUrl: string;
  /** Format audio wejściowego z mikrofonu */
  inputAudioFormat: 'pcm_16000';
  /** Format audio wyjściowego z agenta */
  outputAudioFormat: 'pcm_44100';
  /** Lista subskrybowanych zdarzeń klienta */
  clientEvents: string[];
  /** Nazwa i rola awatara */
  systemRole: string;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  agentId: 'agent_4901m0gnjzpcevev1q5ekvdjhbj3',
  wssBaseUrl: 'wss://api.elevenlabs.io/v1/convai/conversation',
  inputAudioFormat: 'pcm_16000',
  outputAudioFormat: 'pcm_44100',
  clientEvents: [
    'audio',
    'interruption',
    'user_transcript',
    'agent_response',
    'ping',
    'vad_score',
    'agent_response_correction',
    'client_tool_call',
  ],
  systemRole: 'Conversational 3D Avatar Assistant',
};

export type AgentIdSource = 'url' | 'settings' | 'default';

/** Resolve URL, settings, and default agent IDs in order of precedence. */
export function resolveAgentId(
  storeValue: string | undefined,
  search: string = typeof window !== 'undefined' && window.location ? window.location.search : ''
): { id: string; source: AgentIdSource } {
  const fromUrl = new URLSearchParams(search).get('agent_id')?.trim();
  if (fromUrl) return { id: fromUrl, source: 'url' };
  const fromStore = storeValue?.trim();
  if (fromStore) return { id: fromStore, source: 'settings' };
  return { id: DEFAULT_AGENT_CONFIG.agentId, source: 'default' };
}
