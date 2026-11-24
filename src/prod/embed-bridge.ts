export interface EmbedConfig {
  agentId?: string;
  isIframe: boolean;
}

export interface EmbedBridgeCallbacks {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onInterrupt?: () => void;
  onSay?: (text: string) => void;
}

export interface EmbedBridgeOptions {
  /** Parent origins in addition to ?parent_origin; an empty list uses same-origin. */
  allowedOrigins?: string[];
  /** Dev-only escape hatch. Defaults to import.meta.env.DEV. */
  devMode?: boolean;
}

/** Accepts messages only from the direct parent of a framed widget and a trusted origin. */
const MAX_SAY_CHARS = 500;

export class EmbedBridge {
  private callbacks: EmbedBridgeCallbacks = {};
  private config: EmbedConfig;
  private readonly allowedOrigins: Set<string>;
  private readonly allowAnyOrigin: boolean;
  private readonly sameOrigin: string;
  private lastTrustedOrigin: string | null = null;

  constructor(callbacks: EmbedBridgeCallbacks = {}, options: EmbedBridgeOptions = {}) {
    this.callbacks = callbacks;
    this.config = this.parseConfigFromUrl();

    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const devMode = options.devMode ?? import.meta.env.DEV;
    this.allowAnyOrigin = devMode &&
      (params?.get('allow_any_origin') === '1' || params?.get('allow_any_origin') === 'true');
    this.sameOrigin = typeof window !== 'undefined' ? window.location.origin : '';

    this.allowedOrigins = new Set(
      [
        ...(options.allowedOrigins ?? []).map((entry) => EmbedBridge.normalizeOrigin(entry)),
        ...EmbedBridge.parseOriginList(params?.get('parent_origin') ?? null),
      ].filter((entry): entry is string => Boolean(entry))
    );

    this.setupMessageListener();
  }

  /** Normalizes a URL/parameter down to the origin only; returns '' when it cannot be parsed. */
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
      isIframe,
    };
  }

  public getConfig(): EmbedConfig {
    return this.config;
  }

  public setCallbacks(callbacks: EmbedBridgeCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /** Only a direct parent of a framed widget can control it. */
  public isSourceTrusted(source: MessageEventSource | null | undefined): boolean {
    if (typeof window === 'undefined') return false;
    const parent = window.parent;
    if (!parent || parent === window) return false;
    return source === parent;
  }

  public isOriginTrusted(origin: string | undefined): boolean {
    if (!origin) return false;
    if (this.allowAnyOrigin) return true;
    if (this.allowedOrigins.size > 0) return this.allowedOrigins.has(origin);
    return origin === this.sameOrigin;
  }

  private targetOrigins(): string[] {
    if (this.allowAnyOrigin) return ['*'];
    if (this.lastTrustedOrigin) return [this.lastTrustedOrigin];
    if (this.allowedOrigins.size > 0) return [...this.allowedOrigins];
    return [this.sameOrigin];
  }

  private setupMessageListener(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('message', (event: MessageEvent) => {
      if (!this.isSourceTrusted(event.source)) return;
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (!this.isOriginTrusted(event.origin)) {
        console.warn(
          `[EmbedBridge] Rejected message from untrusted origin '${event.origin ?? '(missing)'}'. Add it via ?parent_origin=<url>.`
        );
        return;
      }

      this.lastTrustedOrigin = event.origin;

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
        case 'avatar:say':
          if (typeof data.text === 'string') {
            let text = data.text.trim();
            if (text.length > MAX_SAY_CHARS) {
              console.warn(`[EmbedBridge] avatar:say truncated to ${MAX_SAY_CHARS} chars.`);
              text = text.slice(0, MAX_SAY_CHARS);
            }
            if (text) this.callbacks.onSay?.(text);
          }
          break;
      }
    });
  }

  /**
   * Sends an event to the parent window (parent iframe)
   */
  public emit(action: string, payload?: unknown): void {
    if (typeof window !== 'undefined' && window.parent) {
      const message = { source: 'avatar_widget', action, payload };
      for (const target of this.targetOrigins()) window.parent.postMessage(message, target);
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
