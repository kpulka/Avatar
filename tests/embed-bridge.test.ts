import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmbedBridge } from '../src/prod/embed-bridge';
import { createMemoryStorage } from './helpers/memory-storage';

class MockWindow extends EventTarget {
  public location = { search: '?agent_id=test-agent', origin: 'https://widget.example' };
  public self = this;
  public top = {};
  public parent: { postMessage: ReturnType<typeof vi.fn> } = { postMessage: vi.fn() };
}
class MockMessageEvent extends Event {
  public data: unknown;
  public origin: string | undefined;
  public source: unknown;
  constructor(init: { data?: unknown; origin?: string; source?: unknown }) {
    super('message');
    this.data = init.data;
    this.origin = init.origin;
    this.source = init.source ?? null;
  }
}
let mockWindow: MockWindow;
function send(data: unknown, origin: string | undefined, source: unknown = mockWindow.parent) {
  mockWindow.dispatchEvent(new MockMessageEvent({ data, origin, source }));
}
const connect = { type: 'avatar:connect' };

describe('EmbedBridge', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockWindow = new MockWindow();
    vi.stubGlobal('window', mockWindow);
    vi.stubGlobal('document', { referrer: '' });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('parses supported configuration and emits the ready contract', () => {
    const bridge = new EmbedBridge({}, { devMode: false });
    expect(bridge.getConfig()).toEqual({ agentId: 'test-agent', isIframe: true });
    bridge.notifyReady();
    expect(mockWindow.parent.postMessage).toHaveBeenCalledWith(
      { source: 'avatar_widget', action: 'avatar:ready', payload: { config: bridge.getConfig() } },
      'https://widget.example'
    );
  });

  it('accepts same-origin parent messages and dispatches callbacks', () => {
    const onConnect = vi.fn(),
      onDisconnect = vi.fn(),
      onInterrupt = vi.fn(),
      onSay = vi.fn();
    new EmbedBridge({ onConnect, onDisconnect, onInterrupt, onSay }, { devMode: false });
    send(connect, 'https://widget.example');
    send({ type: 'avatar:disconnect' }, 'https://widget.example');
    send({ type: 'avatar:interrupt' }, 'https://widget.example');
    send({ type: 'avatar:say', text: ' hello ' }, 'https://widget.example');
    expect(onConnect).toHaveBeenCalledOnce();
    expect(onDisconnect).toHaveBeenCalledOnce();
    expect(onInterrupt).toHaveBeenCalledOnce();
    expect(onSay).toHaveBeenCalledWith('hello');
  });

  it('ignores messages from a source other than the parent', () => {
    const onConnect = vi.fn();
    new EmbedBridge({ onConnect }, { devMode: false, allowedOrigins: ['https://host.example'] });
    send(connect, 'https://host.example', {});
    expect(onConnect).not.toHaveBeenCalled();
  });

  it('ignores messages when not framed', () => {
    const onConnect = vi.fn();
    mockWindow.parent = mockWindow as unknown as MockWindow['parent'];
    new EmbedBridge({ onConnect }, { devMode: false });
    send(connect, 'https://widget.example');
    expect(onConnect).not.toHaveBeenCalled();
  });

  it('does not trust the document referrer or an empty origin', () => {
    vi.stubGlobal('document', { referrer: 'https://other.example/page' });
    const onConnect = vi.fn();
    new EmbedBridge({ onConnect }, { devMode: false });
    send(connect, 'https://other.example');
    send(connect, undefined);
    send(connect, '');
    expect(onConnect).not.toHaveBeenCalled();
  });

  it('ignores remote agent selection', () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);
    const onConnect = vi.fn();
    new EmbedBridge({ onConnect }, { devMode: false });
    send({ type: 'avatar:set_agent', agentId: 'agent_x' }, 'https://widget.example');
    expect(onConnect).not.toHaveBeenCalled();
    expect(storage.getItem('elevenlabs_agent_id')).toBeNull();
  });

  it.each([false, true])('enables wildcard only when devMode is %s', (devMode) => {
    mockWindow.location.search = '?allow_any_origin=1';
    const onConnect = vi.fn();
    const bridge = new EmbedBridge({ onConnect }, { devMode });
    send(connect, 'https://other.example');
    expect(onConnect).toHaveBeenCalledTimes(devMode ? 1 : 0);
    bridge.emit('x');
    expect(mockWindow.parent.postMessage.mock.calls[0]?.[1]).toBe(devMode ? '*' : 'https://widget.example');
  });

  it('posts to each configured origin before a trusted message and then replies to its origin', () => {
    const bridge = new EmbedBridge({}, { devMode: false, allowedOrigins: ['https://a.example', 'https://b.example'] });
    bridge.emit('ready');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- test double / mock typing: the value comes from an untyped mock or JSON fixture
    expect(mockWindow.parent.postMessage.mock.calls.map((call) => call[1])).toEqual(['https://a.example', 'https://b.example']);
    mockWindow.parent.postMessage.mockClear();
    send(connect, 'https://b.example');
    bridge.emit('ping');
    expect(mockWindow.parent.postMessage).toHaveBeenCalledOnce();
    expect(mockWindow.parent.postMessage.mock.calls[0]?.[1]).toBe('https://b.example');
  });

  it('reads the parent origin list from the URL', () => {
    mockWindow.location.search = '?parent_origin=https://host.example,https://second.example';
    const bridge = new EmbedBridge({}, { devMode: false });
    expect(bridge.isOriginTrusted('https://second.example')).toBe(true);
    expect(bridge.isOriginTrusted('https://other.example')).toBe(false);
  });

  it('truncates speech to 500 characters', () => {
    const onSay = vi.fn();
    new EmbedBridge({ onSay }, { devMode: false });
    send({ type: 'avatar:say', text: 'x'.repeat(600) }, 'https://widget.example');
    expect(onSay).toHaveBeenCalledOnce();
    expect(onSay).toHaveBeenCalledWith('x'.repeat(500));
  });

  it('dispose() removes the window message listener and is idempotent', () => {
    const onConnect = vi.fn();
    const bridge = new EmbedBridge({ onConnect }, { devMode: false });

    send(connect, 'https://widget.example');
    expect(onConnect).toHaveBeenCalledOnce();

    bridge.dispose();
    send(connect, 'https://widget.example');
    expect(onConnect).toHaveBeenCalledOnce();

    expect(() => bridge.dispose()).not.toThrow();
  });
});
