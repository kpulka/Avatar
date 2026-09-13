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

export interface EmbedBridgeOptions {
  /**
   * Allowlista originów okna nadrzędnego. Dopełnia wartość z `?parent_origin=<url[,url]>`.
   * Pusta allowlista = tryb same-origin (tylko `window.location.origin`).
   */
  allowedOrigins?: string[];
}

/**
 * Mostek komunikacyjny dla osadzania widgetu awatara w iframe i obsługa postMessage (PROD-01).
 *
 * Bezpieczeństwo (review A1 / P2): wiadomości przychodzące są przyjmowane wyłącznie
 * z zaufanych originów (allowlista), a wychodzące wysyłane do konkretnego originu —
 * nigdy do `'*'`, chyba że host jawnie włączy `?allow_any_origin=1`.
 */
export class EmbedBridge {
  private callbacks: EmbedBridgeCallbacks = {};
  private config: EmbedConfig;
  private readonly allowedOrigins: Set<string>;
  private readonly allowAnyOrigin: boolean;
  private readonly sameOrigin: string;

  constructor(callbacks: EmbedBridgeCallbacks = {}, options: EmbedBridgeOptions = {}) {
    this.callbacks = callbacks;
    this.config = this.parseConfigFromUrl();

    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    this.allowAnyOrigin =
      params?.get('allow_any_origin') === '1' || params?.get('allow_any_origin') === 'true';
    this.sameOrigin = typeof window !== 'undefined' ? window.location.origin : '';

    const fromReferrer =
      typeof document !== 'undefined' && document.referrer
        ? EmbedBridge.normalizeOrigin(document.referrer)
        : '';

    this.allowedOrigins = new Set(
      [
        ...(options.allowedOrigins ?? []).map((entry) => EmbedBridge.normalizeOrigin(entry)),
        ...EmbedBridge.parseOriginList(params?.get('parent_origin') ?? null),
        fromReferrer,
      ].filter((entry): entry is string => Boolean(entry))
    );

    this.setupMessageListener();
  }

  /** Normalizuje URL/parametr do samego originu; zwraca '' gdy nieparsowalny. */
  private static normalizeOrigin(value: string): string {
    try {
      const origin = new URL(value).origin;
      return origin === 'null' ? '' : origin;
    } catch {
      return '';
    }
  }

  private static parseOriginList(value: string | null): string[] {
    if (!value) return [];
    return value
      .split(',')
      .map((entry) => EmbedBridge.normalizeOrigin(entry.trim()))
      .filter((entry) => entry.length > 0);
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

  /** Czy wiadomość z tego originu może sterować widgetem. */
  public isOriginTrusted(origin: string | undefined): boolean {
    if (this.allowAnyOrigin) return true;
    if (this.allowedOrigins.size > 0) return typeof origin === 'string' && this.allowedOrigins.has(origin);
    // Brak allowlisty → tryb same-origin (kompatybilny z osadzeniem 1:1 na własnej domenie).
    return !origin || origin === this.sameOrigin;
  }

  /** Origin, do którego wolno wysyłać zdarzenia (nigdy `'*'` bez jawnej zgody hosta). */
  private targetOrigin(): string {
    if (this.allowAnyOrigin) return '*';
    const first = this.allowedOrigins.values().next();
    return first.done ? this.sameOrigin : first.value;
  }

  private setupMessageListener(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('message', (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (!this.isOriginTrusted(event.origin)) {
        console.warn(
          `[EmbedBridge] Odrzucono wiadomość z niezaufanego originu '${event.origin ?? '(brak)'}'. ` +
            'Dodaj go przez ?parent_origin=<url> (lista rozdzielana przecinkami).'
        );
        return;
      }

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
        this.targetOrigin()
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
