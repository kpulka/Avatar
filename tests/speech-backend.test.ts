import { afterEach, describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => ({ callbacks: {} as Record<string, (...args: any[]) => void>, connect: vi.fn(), micStart: vi.fn(), micStop: vi.fn() }));
vi.mock('../src/audio/raw-wss-client', () => ({
  RawWssClient: class {
    connect = captured.connect; disconnect = vi.fn(); sendUserAudio = vi.fn();
    setCallbacks = vi.fn((callbacks: typeof captured.callbacks) => { captured.callbacks = callbacks; });
  },
}));
vi.mock('../src/audio/mic-capture', () => ({
  MicCapture: class { start = captured.micStart; stop = captured.micStop; setDeviceId = vi.fn(); },
}));

import { ElevenAgentsSpeechBackend } from '../src/audio/speech-backend';

function makeBackend() {
  const engine = { ctx: {}, unlock: vi.fn(), getEpoch: vi.fn(() => 0), playChunk: vi.fn(() => 1.25),
    hasPendingAudio: vi.fn(() => false), getTailTime: vi.fn(() => 0), hardStop: vi.fn() };
  const backend = new ElevenAgentsSpeechBackend(engine as never, () => 'agent_test');
  backend.onAudioChunk = vi.fn();
  return { backend, engine };
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('ElevenAgentsSpeechBackend sample rates', () => {
  it('demo speech reports its real 44100 Hz sample rate', () => {
    vi.useFakeTimers();
    const { backend, engine } = makeBackend();
    backend.triggerDemoSpeech('Hi');
    const call = vi.mocked(backend.onAudioChunk).mock.calls[0];
    expect(call[0].byteLength).toBe(Math.floor(44100 * 2.4) * 2);
    expect(call[4]).toBe(44100);
    expect(engine.playChunk).toHaveBeenCalledWith(expect.anything(), 44100, 0);
    vi.runAllTimers();
  });

  it('live chunks report the negotiated agent rate', () => {
    const { backend, engine } = makeBackend();
    captured.callbacks.onMetadata({ outputFormat: 'pcm_24000' });
    captured.callbacks.onAudioChunk({ audio_base_64: btoa('\0'.repeat(960)), alignment: {
      chars: ['a'], char_start_times_ms: [0], char_durations_ms: [20],
    } });
    expect(backend.onAudioChunk).toHaveBeenCalledWith(expect.anything(), expect.anything(), 0, 1.25, 24000);
    expect(engine.playChunk).toHaveBeenCalledWith(expect.anything(), 24000, 0);
  });

  it('recognises pcm_22050 and pcm_8000', () => {
    const { backend } = makeBackend();
    captured.callbacks.onMetadata({ outputFormat: 'pcm_22050' });
    expect(backend.getOutputSampleRate()).toBe(22050);
    captured.callbacks.onMetadata({ outputFormat: 'pcm_8000' });
    expect(backend.getOutputSampleRate()).toBe(8000);
  });

  it('warns on unsupported ulaw formats and keeps the previous rate', () => {
    const { backend } = makeBackend();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    captured.callbacks.onMetadata({ outputFormat: 'ulaw_8000' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unsupported'));
    expect(backend.getOutputSampleRate()).toBe(16000);
  });
});


describe('microphone access', () => {
  it('fails before opening a socket when access is denied', async () => {
    captured.connect.mockClear();
    captured.micStart.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    const { backend } = makeBackend();
    backend.onStateChange = vi.fn();
    await expect(backend.start()).rejects.toMatchObject({ reason: 'denied' });
    expect(captured.connect).not.toHaveBeenCalled();
    expect(backend.onStateChange).toHaveBeenLastCalledWith('idle');
    expect(backend.getIsRunning()).toBe(false);
  });
});


describe('concurrent startup', () => {
  it('coalesces starts and cancels a pending microphone start on stop', async () => {
    captured.connect.mockClear();
    captured.micStop.mockClear();
    let resolveMic!: () => void;
    captured.micStart.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveMic = resolve; }));
    const { backend } = makeBackend();
    const first = backend.start();
    const second = backend.start();
    expect(first).toBe(second);
    await Promise.resolve();
    await backend.stop();
    resolveMic();
    await first;
    expect(captured.connect).not.toHaveBeenCalled();
    expect(captured.micStop).toHaveBeenCalledTimes(1);
    expect(backend.getIsRunning()).toBe(false);
  });
});
