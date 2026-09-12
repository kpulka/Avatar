import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RawWssClient } from '../src/audio/raw-wss-client';
import { AudioEventPayload } from '../src/types/audio';

// Mock WebSocket
class MockWebSocket {
  public static readonly CONNECTING = 0;
  public static readonly OPEN = 1;
  public static readonly CLOSING = 2;
  public static readonly CLOSED = 3;

  public static instances: MockWebSocket[] = [];
  public url: string;
  public readyState = MockWebSocket.CONNECTING;
  public sentData: string[] = [];

  public onopen: (() => void) | null = null;
  public onmessage: ((e: { data: string }) => void) | null = null;
  public onclose: ((e: { code: number; reason: string }) => void) | null = null;
  public onerror: ((e: unknown) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  public open(): void {
    this.readyState = 1; // OPEN
    if (this.onopen) this.onopen();
  }

  public receiveMessage(data: unknown): void {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }

  public send(data: string): void {
    this.sentData.push(data);
  }

  public close(code = 1000, reason = ''): void {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose({ code, reason });
  }
}

// Global mock
vi.stubGlobal('WebSocket', MockWebSocket);

describe('RawWssClient', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.clearAllTimers();
  });

  it('connects to ElevenAgents endpoint and sends client initiation handshake', () => {
    const client = new RawWssClient('test-agent-123');
    client.connect();

    expect(MockWebSocket.instances).toHaveLength(1);
    const mockWs = MockWebSocket.instances[0];
    expect(mockWs.url).toContain('agent_id=test-agent-123');

    // Otwarcie socketu
    mockWs.open();

    // Powinno wysłać conversation_initiation_client_data
    expect(mockWs.sentData).toHaveLength(1);
    const sent = JSON.parse(mockWs.sentData[0]);
    expect(sent.type).toBe('conversation_initiation_client_data');
    expect(client.getState()).toBe('connected');
  });

  it('handles server audio event and passes payload to callback', () => {
    const onAudioChunk = vi.fn();
    const client = new RawWssClient('test-agent-123', { onAudioChunk });
    client.connect();
    const mockWs = MockWebSocket.instances[0];
    mockWs.open();

    const sampleAudioPayload: AudioEventPayload = {
      audio_base_64: 'UklGR...',
      alignment: {
        chars: ['H', 'e', 'l', 'l', 'o'],
        char_start_times_ms: [0, 50, 90, 130, 170],
        char_durations_ms: [50, 40, 40, 40, 70],
      },
    };

    mockWs.receiveMessage({
      type: 'audio',
      audio_event: sampleAudioPayload,
    });

    expect(onAudioChunk).toHaveBeenCalledTimes(1);
    expect(onAudioChunk).toHaveBeenCalledWith(sampleAudioPayload);
  });

  it('replies with pong when ping event is received', async () => {
    vi.useFakeTimers();
    const client = new RawWssClient('test-agent-123');
    client.connect();
    const mockWs = MockWebSocket.instances[0];
    mockWs.open();

    mockWs.receiveMessage({
      type: 'ping',
      ping_event: { event_id: 42, ping_ms: 50 },
    });

    vi.advanceTimersByTime(50);

    const pongMsg = mockWs.sentData.find((msg) => msg.includes('"type":"pong"'));
    expect(pongMsg).toBeDefined();
    expect(JSON.parse(pongMsg!)).toEqual({ type: 'pong', event_id: 42 });

    vi.useRealTimers();
  });

  it('triggers onInterruption callback when interruption event is received', () => {
    const onInterruption = vi.fn();
    const client = new RawWssClient('test-agent-123', { onInterruption });
    client.connect();
    const mockWs = MockWebSocket.instances[0];
    mockWs.open();

    mockWs.receiveMessage({
      type: 'interruption',
      interruption_event: { reason: 'user_speaking' },
    });

    expect(onInterruption).toHaveBeenCalledTimes(1);
    expect(onInterruption).toHaveBeenCalledWith('user_speaking');
  });

  it('sends user_audio_chunk when sendUserAudio is called', () => {
    const client = new RawWssClient('test-agent-123');
    client.connect();
    const mockWs = MockWebSocket.instances[0];
    mockWs.open();

    client.sendUserAudio('base64pcmdata==');

    const sentAudio = mockWs.sentData.find((msg) => msg.includes('user_audio_chunk'));
    expect(sentAudio).toBeDefined();
    expect(JSON.parse(sentAudio!)).toEqual({ user_audio_chunk: 'base64pcmdata==' });
  });
});
