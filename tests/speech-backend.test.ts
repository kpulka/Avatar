import { afterEach, describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => ({ callbacks: {} as Record<string, (...args: any[]) => void> }));
vi.mock('../src/audio/raw-wss-client', () => ({
  RawWssClient: class {
    connect = vi.fn(); disconnect = vi.fn(); sendUserAudio = vi.fn();
    setCallbacks = vi.fn((callbacks: typeof captured.callbacks) => { captured.callbacks = callbacks; });
  },
}));
vi.mock('../src/audio/mic-capture', () => ({
  MicCapture: class { start = vi.fn(); stop = vi.fn(); setDeviceId = vi.fn(); },
}));

import { ElevenAgentsSpeechBackend } from '../src/audio/speech-backend';

function makeBackend() {
  const engine = { ctx: {}, getEpoch: vi.fn(() => 0), playChunk: vi.fn(() => 1.25),
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
