import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmbedBridge } from '../src/prod/embed-bridge';

class MockWindow extends EventTarget {
  public location = { search: '?agent_id=test-agent&theme=dark&autostart=true' };
  public self = this;
  public top = {}; // self !== top -> isIframe = true
  public parent = {
    postMessage: vi.fn(),
  };
}

class MockMessageEvent extends Event {
  public data: unknown;
  constructor(type: string, init?: { data?: unknown }) {
    super(type);
    this.data = init?.data;
  }
}

const mockWindow = new MockWindow();
vi.stubGlobal('window', mockWindow);
vi.stubGlobal('MessageEvent', MockMessageEvent);

describe('EmbedBridge (PROD-01)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockWindow.parent.postMessage = vi.fn();
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
});
