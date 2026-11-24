import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RawWssClient } from '../src/audio/raw-wss-client';
import { defined } from './helpers/defined';

class FakeSocket {
  static instances: FakeSocket[] = [];
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  static OPEN = 1;
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  send() {}
  open() { this.onopen?.(); }
  metadata() { this.onmessage?.({ data: JSON.stringify({ type: 'conversation_initiation_metadata', conversation_initiation_metadata_event: {} }) } as MessageEvent); }
  constructor(_url: string) { FakeSocket.instances.push(this); }
  close() {}
  fail(code: number, reason = '') { this.onclose?.({ code, reason } as CloseEvent); }
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('WebSocket', FakeSocket);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('reconnect failures', () => {
  it('reports a socket error once after five reconnect attempts', () => {
    const onError = vi.fn();
    const client = new RawWssClient('agent', { onError });
    client.connect();
    for (let i = 0; i < 6; i++) {
      defined(FakeSocket.instances[i]).onerror?.({} as Event);
      defined(FakeSocket.instances[i]).fail(1006);
      vi.advanceTimersByTime(16000);
    }
    expect(FakeSocket.instances).toHaveLength(6);
    expect(onError).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- test double / mock typing: the value comes from an untyped mock or JSON fixture
    expect(defined(onError.mock.calls[0])[0].message).toContain('5 attempts');
    expect(client.getState()).toBe('disconnected');
  });

  it('exhausts retries when sockets open but close before metadata', () => {
    const onError = vi.fn();
    const client = new RawWssClient('agent', { onError });
    client.connect();
    for (let i = 0; i < 6; i++) {
      defined(FakeSocket.instances[i]).open();
      defined(FakeSocket.instances[i]).fail(1006);
      vi.advanceTimersByTime(16000);
    }
    expect(FakeSocket.instances).toHaveLength(6);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(client.getState()).toBe('disconnected');
  });

  it('restores the retry budget after initiation metadata', () => {
    const onError = vi.fn();
    const client = new RawWssClient('agent', { onError });
    client.connect();
    for (let i = 0; i < 5; i++) {
      defined(FakeSocket.instances[i]).fail(1006);
      vi.advanceTimersByTime(16000);
    }
    defined(FakeSocket.instances[5]).open();
    defined(FakeSocket.instances[5]).metadata();
    defined(FakeSocket.instances[5]).fail(1006);
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.instances).toHaveLength(7);
    expect(onError).not.toHaveBeenCalled();
  });

  it('fails immediately on an agent rejection', () => {
    const onError = vi.fn();
    new RawWssClient('agent', { onError }).connect();
    defined(FakeSocket.instances[0]).fail(4001, 'invalid agent');
    expect(onError).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- test double / mock typing: the value comes from an untyped mock or JSON fixture
    expect(defined(onError.mock.calls[0])[0].message).toContain('invalid agent');
    expect(vi.getTimerCount()).toBe(0);
  });
});
