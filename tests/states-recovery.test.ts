// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { ConversationController } from '../src/features/conversation-controller';
import { MicAccessError } from '../src/audio/speech-backend';
import { TypedEventBus } from '../src/app/events';
import { AppEvents } from '../src/app/app-types';
import { createConnectionBanner } from '../src/ui/user/connection-banner';
import { createConversationDock } from '../src/ui/user/conversation-dock';
import { createCaptions } from '../src/ui/user/captions';
import { createSessionPanel } from '../src/ui/studio/panels/session-panel';
import { createVisemesPanel } from '../src/ui/studio/panels/visemes-panel';
import { createUiFixture } from './helpers/ui-fixtures';

function makeController(overrides: Partial<Record<string, unknown>> = {}) {
  const events = new TypedEventBus<AppEvents>();
  const backend = {
    onError: () => undefined,
    onStateChange: () => undefined,
    onUserTranscript: () => undefined,
    onAgentResponse: () => undefined,
    onAgentCorrection: () => undefined,
    onAudioChunk: () => undefined,
    onInterruption: () => undefined,
    getIsRunning: () => false,
    getIsMuted: () => false,
    setMuted: vi.fn(),
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    triggerDemoSpeech: vi.fn(),
    ...overrides,
  };
  const embed = { setCallbacks: vi.fn(), notifyStateChange: vi.fn(), notifyTranscript: vi.fn() };
  const audio = { hardStop: vi.fn(), getTailTime: () => 0 };
  const controller = new ConversationController({
    speechBackend: backend as never,
    audioEngine: audio as never,
    embedBridge: embed as never,
    events,
  });
  const seen: Array<[string, unknown]> = [];
  for (const name of ['toast', 'voice:error', 'voice:state', 'transcript:agent', 'voice:muted'] as const) {
    events.on(name, (payload: unknown) => seen.push([name, payload]));
  }
  return { controller, backend, events, seen };
}

describe('conversation feedback hygiene and recovery (15-05)', () => {
  it('mic denied: start rethrows, voice:error carries the guidance and never claims listening', async () => {
    const denied = new MicAccessError({ name: 'NotAllowedError' });
    const { controller, seen } = makeController({
      start: vi.fn(async () => {
        throw denied;
      }),
    });
    await expect(controller.start()).rejects.toBe(denied);
    expect(seen.find(([name]) => name === 'voice:error')?.[1]).toContain('Microphone access is blocked');
    expect(seen.some(([name, payload]) => name === 'voice:state' && payload === 'listening')).toBe(false);
  });

  it('agent correction replaces the caption text via transcript:agent', () => {
    const { backend, seen } = makeController();
    backend.onAgentCorrection('what was really said');
    expect(seen).toContainEqual(['transcript:agent', 'what was really said']);
  });

  it('runtime connection errors also reach voice:error (banner) besides the toast', () => {
    const { backend, seen } = makeController();
    backend.onError(new Error('socket closed'));
    expect(seen).toContainEqual(['voice:error', 'socket closed']);
  });

  it('start/stop/mute/interrupt produce no toasts', async () => {
    const { controller, backend, seen } = makeController();
    await controller.toggle(); // start
    backend.getIsRunning = () => true;
    controller.toggleMute();
    controller.interrupt();
    await controller.toggle(); // stop
    expect(seen.filter(([name]) => name === 'toast')).toEqual([]);
    expect(seen).toContainEqual(['voice:muted', true]);
  });

  it('connection banner: voice:error shows it with retry; retry starts again; a live session hides it', async () => {
    const fixture = createUiFixture();
    createConnectionBanner().mount(fixture.ctx);
    const banner = fixture.host.querySelector('.conn-error') as HTMLElement;
    expect(banner.classList.contains('hidden')).toBe(true);
    expect(banner.getAttribute('role')).toBe('alert');

    fixture.events.emit('voice:error', 'Boom');
    expect(banner.classList.contains('hidden')).toBe(false);
    expect(banner.textContent).toContain('Boom');

    (banner.querySelector('button') as HTMLButtonElement).click();
    expect(fixture.spies.conversationStart).toHaveBeenCalledTimes(1);
    expect(banner.classList.contains('hidden')).toBe(true);

    fixture.events.emit('voice:error', 'Boom again');
    expect(banner.classList.contains('hidden')).toBe(false);
    fixture.events.emit('voice:state', 'listening');
    expect(banner.classList.contains('hidden')).toBe(true);
  });

  it('dock: interrupt and mute are disabled at idle, enabled while a session runs; mute exposes aria-pressed', () => {
    const fixture = createUiFixture();
    createConversationDock().mount(fixture.ctx);
    const [, mute, interrupt] = [...fixture.host.querySelectorAll<HTMLButtonElement>('.dock-btn')];
    expect(mute.disabled).toBe(true);
    expect(interrupt.disabled).toBe(true);
    fixture.events.emit('voice:state', 'speaking');
    expect(mute.disabled).toBe(false);
    expect(interrupt.disabled).toBe(false);
    expect(mute.getAttribute('aria-pressed')).toBe('false');
    fixture.events.emit('voice:muted', true);
    expect(mute.getAttribute('aria-pressed')).toBe('true');
    fixture.events.emit('voice:state', 'idle');
    expect(interrupt.disabled).toBe(true);
  });

  it('captions flash on interruption', () => {
    const fixture = createUiFixture();
    createCaptions().mount(fixture.ctx);
    fixture.events.emit('speech:interruption', 'user_interrupted');
    expect(fixture.host.querySelector('.agent-line')?.classList.contains('caption-flash')).toBe(true);
    fixture.events.emit('transcript:agent', 'corrected');
    expect(fixture.host.querySelector('.agent-line .transcript-text')?.textContent).toBe('corrected');
  });

  it('session panel: no dead mic control and no stale copy; points to user settings', () => {
    const fixture = createUiFixture();
    createSessionPanel().mount(fixture.ctx);
    expect(fixture.host.querySelector('select')).toBeNull();
    expect(fixture.host.textContent).not.toContain('11-06');
    expect(fixture.host.textContent).toContain('Settings');
  });

  it('visemes: "Reset all" goes through a confirm dialog; cancel keeps overrides, accept wipes them', () => {
    const fixture = createUiFixture();
    fixture.store.setStudio('visemeOverrides', { AA: { jawOpen: 0.5 } });
    createVisemesPanel().mount(fixture.ctx);
    const resetAll = fixture.host.querySelector('.btn-danger') as HTMLButtonElement;
    resetAll.click();
    expect(fixture.modalCalls).toHaveLength(1);
    expect(fixture.modalCalls[0].title).toContain('Reset all');
    const [accept, cancel] = [...fixture.modalCalls[0].content.querySelectorAll<HTMLButtonElement>('button')];

    cancel.click();
    expect(fixture.spies.modalClose).toHaveBeenCalledTimes(1);
    expect(fixture.host.querySelectorAll('.viseme-chip.modified').length).toBeGreaterThan(0);

    accept.click();
    expect(fixture.host.querySelectorAll('.viseme-chip.modified')).toHaveLength(0);
  });
});
