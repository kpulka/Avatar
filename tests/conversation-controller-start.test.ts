import { describe, expect, it, vi } from 'vitest';
import { ConversationController } from '../src/features/conversation-controller';

describe('conversation startup', () => {
  it('shares a pending failure and emits one error toast', async () => {
    let rejectStart!: (error: Error) => void;
    const backend = { getIsRunning: () => false, start: vi.fn(() => new Promise<void>((_, reject) => { rejectStart = reject; })), stop: vi.fn() };
    const events = { emit: vi.fn() };
    const bridge = { setCallbacks: vi.fn() };
    const controller = new ConversationController({ speechBackend: backend as never, audioEngine: {} as never, embedBridge: bridge as never, events: events as never });
    const first = controller.start();
    const second = controller.start();
    expect(first).toBe(second);
    rejectStart(new Error('failed'));
    await expect(first).rejects.toThrow('failed');
    expect(backend.start).toHaveBeenCalledTimes(1);
    expect(events.emit.mock.calls.filter(([name]) => name === 'toast')).toHaveLength(1);
  });
});
