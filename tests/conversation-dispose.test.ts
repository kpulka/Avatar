import { describe, expect, it, vi } from 'vitest';
import { ConversationController } from '../src/features/conversation-controller';
import { TypedEventBus } from '../src/app/events';
import { AppEvents } from '../src/app/app-types';
import { EmbedBridgeCallbacks } from '../src/prod/embed-bridge';

function makeController() {
  const events = new TypedEventBus<AppEvents>();
  const backend = {
    onError: (_err: Error) => undefined,
    onStateChange: (_state: string) => undefined,
    onUserTranscript: (_text: string) => undefined,
    onAgentResponse: (_text: string) => undefined,
    onAgentCorrection: (_text: string) => undefined,
    onAudioChunk: (..._args: unknown[]) => undefined,
    onInterruption: (_reason: string) => undefined,
    getIsRunning: () => false,
    getIsMuted: () => false,
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
  };
  let bridgeCallbacks: EmbedBridgeCallbacks = {};
  const embed = {
    setCallbacks: vi.fn((callbacks: EmbedBridgeCallbacks) => {
      bridgeCallbacks = { ...bridgeCallbacks, ...callbacks };
    }),
    notifyStateChange: vi.fn(),
    notifyTranscript: vi.fn(),
  };
  const controller = new ConversationController({
    speechBackend: backend as never,
    audioEngine: { hardStop: vi.fn(), getTailTime: () => 0 } as never,
    embedBridge: embed as never,
    events,
  });
  return { controller, backend, events, getBridgeCallbacks: () => bridgeCallbacks };
}

describe('ConversationController.dispose (14-03)', () => {
  it('stops the session once', () => {
    const { controller, backend } = makeController();
    controller.dispose();
    expect(backend.stop).toHaveBeenCalledTimes(1);
  });

  it('detaches the backend callbacks: a late backend event no longer reaches the bus', () => {
    const { controller, backend, events } = makeController();
    const seen = vi.fn();
    events.on('voice:state', seen);
    events.on('transcript:agent', seen);
    events.on('voice:error', seen);

    backend.onStateChange('listening');
    expect(seen).toHaveBeenCalledTimes(1); // wired before dispose

    controller.dispose();
    seen.mockClear();
    backend.onStateChange('speaking');
    backend.onAgentResponse('late text');
    backend.onError(new Error('late'));
    expect(seen).not.toHaveBeenCalled();
  });

  it('detaches the embed bridge commands: a late connect no longer starts a session', () => {
    const { controller, backend, getBridgeCallbacks } = makeController();
    expect(getBridgeCallbacks().onConnect).toBeTypeOf('function');
    controller.dispose();
    expect(getBridgeCallbacks().onConnect).toBeUndefined();
    getBridgeCallbacks().onConnect?.();
    expect(backend.start).not.toHaveBeenCalled();
  });
});
