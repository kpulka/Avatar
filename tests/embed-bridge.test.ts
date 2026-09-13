import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmbedBridge } from '../src/prod/embed-bridge';

class MockWindow extends EventTarget {
  public location = { search: '?agent_id=test-agent&theme=dark&autostart=true', origin: 'https://widget.example' };
  public self = this;
  public top = {}; // self !== top -> isIframe = true
  public parent = {
    postMessage: vi.fn(),
  };
}

class MockMessageEvent extends Event {
  public data: unknown;
  public origin: string | undefined;
  constructor(type: string, init?: { data?: unknown; origin?: string }) {
    super(type);
    this.data = init?.data;
    this.origin = init?.origin;
  }
}

const mockWindow = new MockWindow();
vi.stubGlobal('window', mockWindow);
vi.stubGlobal('MessageEvent', MockMessageEvent);

describe('EmbedBridge (PROD-01)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockWindow.parent.postMessage = vi.fn();
    mockWindow.location.search = '?agent_id=test-agent&theme=dark&autostart=true';
  });

  it('parses URL query parameters correctly', () => {
    const bridge = new EmbedBridge();
    const config = bridge.getConfig();

    expect(config.agentId).toBe('test-agent');
    expect(config.theme).toBe('dark');
    expect(config.autostart).toBe(true);
    expect(config.isIframe).toBe(true);
  });

  it('receives postMessage events from parent frame and invokes callbacks', () => {
    const onConnect = vi.fn();
    const onInterrupt = vi.fn();
    const onSetAgent = vi.fn();
    const onSay = vi.fn();

    new EmbedBridge({
      onConnect,
      onInterrupt,
      onSetAgent,
      onSay,
    });

    // Symulacja zdarzeń postMessage
    mockWindow.dispatchEvent(new MockMessageEvent('message', { data: { type: 'avatar:connect' } }));
    expect(onConnect).toHaveBeenCalledTimes(1);

    mockWindow.dispatchEvent(new MockMessageEvent('message', { data: { type: 'avatar:interrupt' } }));
    expect(onInterrupt).toHaveBeenCalledTimes(1);

    mockWindow.dispatchEvent(
      new MockMessageEvent('message', {
        data: { type: 'avatar:set_agent', agentId: 'new-agent-999' },
      })
    );
    expect(onSetAgent).toHaveBeenCalledWith('new-agent-999');

    mockWindow.dispatchEvent(
      new MockMessageEvent('message', {
        data: { type: 'avatar:say', text: 'Hello from iframe parent' },
      })
    );
    expect(onSay).toHaveBeenCalledWith('Hello from iframe parent');
  });

  it('emits notifications to parent window with proper contract', () => {
    const bridge = new EmbedBridge();
    bridge.notifyReady();

    expect(mockWindow.parent.postMessage).toHaveBeenCalledTimes(1);
    const sent = (mockWindow.parent.postMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sent.source).toBe('avatar_widget');
    expect(sent.action).toBe('avatar:ready');
  });

  it('odrzuca wiadomości z niezaufanego originu, gdy ustawiono allowlistę (review A1 / P2)', () => {
    const onConnect = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    new EmbedBridge({ onConnect }, { allowedOrigins: ['https://host.example'] });

    mockWindow.dispatchEvent(
      new MockMessageEvent('message', { data: { type: 'avatar:connect' }, origin: 'https://evil.example' })
    );
    expect(onConnect).not.toHaveBeenCalled();

    mockWindow.dispatchEvent(
      new MockMessageEvent('message', { data: { type: 'avatar:connect' }, origin: 'https://host.example' })
    );
    expect(onConnect).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });

  it('wysyła zdarzenia do originu z allowlisty, nigdy bez potrzeby do *', () => {
    const bridge = new EmbedBridge({}, { allowedOrigins: ['https://host.example'] });
    bridge.notifyReady();

    const [, targetOrigin] = (mockWindow.parent.postMessage as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(targetOrigin).toBe('https://host.example');
  });

  it('czyta allowlistę z ?parent_origin (lista rozdzielana przecinkami)', () => {
    mockWindow.location.search = '?parent_origin=https://host.example,https://second.example';
    const bridge = new EmbedBridge();

    expect(bridge.isOriginTrusted('https://second.example')).toBe(true);
    expect(bridge.isOriginTrusted('https://evil.example')).toBe(false);

    bridge.notifyReady();
    const [, targetOrigin] = (mockWindow.parent.postMessage as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(targetOrigin).toBe('https://host.example');
  });

  it('bez allowlisty działa w trybie same-origin, a ?allow_any_origin=1 to jawna furtka', () => {
    const bridge = new EmbedBridge();
    expect(bridge.isOriginTrusted('https://widget.example')).toBe(true);
    expect(bridge.isOriginTrusted('https://evil.example')).toBe(false);

    bridge.notifyReady();
    const [, targetOrigin] = (mockWindow.parent.postMessage as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(targetOrigin).toBe('https://widget.example');

    mockWindow.location.search = '?allow_any_origin=1';
    const permissive = new EmbedBridge();
    expect(permissive.isOriginTrusted('https://evil.example')).toBe(true);
    permissive.notifyReady();
    const calls = (mockWindow.parent.postMessage as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[calls.length - 1][1]).toBe('*');
  });
});
