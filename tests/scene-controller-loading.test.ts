import { describe, expect, it, vi } from 'vitest';
import { TypedEventBus } from '../src/app/events';
import type { AppEvents } from '../src/app/app-types';
import { SceneController, type SceneControllerDeps } from '../src/features/scene-controller';

vi.mock('../src/avatar/test-avatar-generator', () => ({
  createTestAvatar: () => { throw new Error('fallback failed'); },
}));

describe('default avatar loading', () => {
  it('emits progress and an error when both the model and fallback fail', async () => {
    const events = new TypedEventBus<AppEvents>();
    const received: unknown[] = [];
    events.on('avatar:progress', (payload) => received.push(['progress', payload]));
    events.on('avatar:error', (payload) => received.push(['error', payload]));
    const loader = {
      load: vi.fn(async (_source: string, _scene: unknown, onProgress: (fraction: number | null) => void) => {
        onProgress(0.5);
        throw new Error('model failed');
      }),
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const controller = new SceneController({ loader, events } as unknown as SceneControllerDeps);
      controller.loadDefaultAvatar();
      await vi.waitFor(() => expect(received).toHaveLength(2));
      expect(received).toEqual([
        ['progress', { fraction: 0.5 }],
        ['error', { message: 'The 3D avatar could not be loaded. Please reload the page.' }],
      ]);
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });
});
