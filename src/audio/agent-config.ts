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

let memoryAgentId = DEFAULT_AGENT_CONFIG.agentId;

/**
 * Pobiera aktywny agent_id z parametru URL ?agent_id= lub localStorage, z fallbackiem do domyślnego
 */
export function getActiveAgentId(): string {
  if (typeof window !== 'undefined' && window.location) {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('agent_id');
    if (fromUrl && fromUrl.trim() !== '') {
      return fromUrl.trim();
    }
  }

  if (typeof localStorage !== 'undefined') {
    const fromStorage = localStorage.getItem('elevenlabs_agent_id');
    if (fromStorage && fromStorage.trim() !== '') {
      return fromStorage.trim();
    }
  }

  return memoryAgentId;
}

export function setActiveAgentId(agentId: string): void {
  memoryAgentId = agentId;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('elevenlabs_agent_id', agentId);
  }
}
