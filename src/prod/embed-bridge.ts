export interface EmbedConfig {
  agentId?: string;
  theme?: 'dark' | 'light';
  autostart?: boolean;
  modelUrl?: string;
  isIframe: boolean;
}

export interface EmbedBridgeCallbacks {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onInterrupt?: () => void;
  onSetAgent?: (agentId: string) => void;
  onSay?: (text: string) => void;
}

/**
 * Mostek komunikacyjny dla osadzania widgetu awatara w iframe i obsługa postMessage (PROD-01)
 */
export class EmbedBridge {
  private callbacks: EmbedBridgeCallbacks = {};
  private config: EmbedConfig;

  constructor(callbacks: EmbedBridgeCallbacks = {}) {
    this.callbacks = callbacks;
    this.config = this.parseConfigFromUrl();
    this.setupMessageListener();
  }

  public parseConfigFromUrl(): EmbedConfig {
    if (typeof window === 'undefined') {
      return { isIframe: false };
    }

    const params = new URLSearchParams(window.location.search);
    const isIframe = window.self !== window.top;

    return {
      agentId: params.get('agent_id') || undefined,
      theme: (params.get('theme') as 'dark' | 'light') || 'dark',
      autostart: params.get('autostart') === 'true' || params.get('autostart') === '1',
      modelUrl: params.get('model_url') || undefined,
      isIframe,
    };
  }

  public getConfig(): EmbedConfig {
    return this.config;
  }

  public setCallbacks(callbacks: EmbedBridgeCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  private setupMessageListener(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('message', (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      switch (data.type) {
        case 'avatar:connect':
          this.callbacks.onConnect?.();
          break;
        case 'avatar:disconnect':
          this.callbacks.onDisconnect?.();
          break;
        case 'avatar:interrupt':
          this.callbacks.onInterrupt?.();
          break;
        case 'avatar:set_agent':
          if (typeof data.agentId === 'string') {
            this.callbacks.onSetAgent?.(data.agentId);
          }
          break;
        case 'avatar:say':
          if (typeof data.text === 'string') {
            this.callbacks.onSay?.(data.text);
          }
          break;
      }
    });
  }

  /**
   * Wysyła zdarzenie do okna nadrzędnego (parent iframe)
   */
  public emit(action: string, payload?: unknown): void {
    if (typeof window !== 'undefined' && window.parent) {
      window.parent.postMessage(
        {
          source: 'avatar_widget',
          action,
          payload,
        },
        '*'
      );
    }
  }

  public notifyReady(): void {
    this.emit('avatar:ready', { config: this.config });
  }

  public notifyStateChange(state: string): void {
    this.emit('avatar:state_change', { state });
  }

  public notifyTranscript(speaker: 'user' | 'agent', text: string): void {
    this.emit('avatar:transcript', { speaker, text });
  }

  public notifyError(error: string): void {
    this.emit('avatar:error', { error });
  }
}
