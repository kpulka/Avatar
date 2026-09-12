import { describe, expect, it, vi } from 'vitest';
import { createUiMode, KeyboardEventLike } from '../src/app/ui-mode';
import { SettingsStore } from '../src/app/store/settings-store';
import { createMemoryStorage } from './helpers/memory-storage';

function makeEnv(search: string) {
  const attrs: Record<string, string> = {};
  return {
    search,
    body: {
      setAttribute: (name: string, value: string) => {
        attrs[name] = value;
      },
    },
    attrs,
  };
}

function makeKeyTarget() {
  let handler: ((event: KeyboardEventLike) => void) | null = null;
  const remove = vi.fn();
  return {
    remove,
    get handler() {
      return handler;
    },
    target: {
      addEventListener: (_type: 'keydown', h: (event: KeyboardEventLike) => void) => {
        handler = h;
      },
      removeEventListener: remove,
    },
  };
}

describe('UiMode', () => {
  it('?studio=1 ustawia tryb studio, data-mode i persystuje wybór', () => {
    const storage = createMemoryStorage();
    const store = new SettingsStore(storage);
    const env = makeEnv('studio=1');
    const uiMode = createUiMode(store, env);

    expect(uiMode.getMode()).toBe('studio');
    expect(env.attrs['data-mode']).toBe('studio');
    expect(store.getState().user.uiMode).toBe('studio');
  });

  it('bez query startuje z persisted uiMode, a toggle zapisuje wybór', () => {
    const storage = createMemoryStorage();
    const store = new SettingsStore(storage);
    const env = makeEnv('');
    const uiMode = createUiMode(store, env);

    expect(uiMode.getMode()).toBe('user');
    expect(env.attrs['data-mode']).toBe('user');

    uiMode.toggle();
    expect(uiMode.getMode()).toBe('studio');
    expect(env.attrs['data-mode']).toBe('studio');
    expect(store.getState().user.uiMode).toBe('studio');

    // Persystencja: nowy store na tym samym storage startuje w studio.
    const restored = createUiMode(new SettingsStore(storage), makeEnv(''));
    expect(restored.getMode()).toBe('studio');
  });

  it('skrót Ctrl+Shift+D przełącza, ignoruje pola edycyjne', () => {
    const storage = createMemoryStorage();
    const store = new SettingsStore(storage);
    const uiMode = createUiMode(store, makeEnv(''));
    const key = makeKeyTarget();
    const unsub = uiMode.attachShortcut(key.target);

    key.handler?.({
      key: 'D',
      ctrlKey: true,
      shiftKey: true,
      target: { tagName: 'DIV' },
      preventDefault: vi.fn(),
    });
    expect(uiMode.getMode()).toBe('studio');

    key.handler?.({
      key: 'D',
      ctrlKey: true,
      shiftKey: true,
      target: { tagName: 'INPUT' },
      preventDefault: vi.fn(),
    });
    expect(uiMode.getMode()).toBe('studio');

    key.handler?.({
      key: 'D',
      ctrlKey: false,
      shiftKey: true,
      target: { tagName: 'DIV' },
      preventDefault: vi.fn(),
    });
    expect(uiMode.getMode()).toBe('studio');

    unsub();
    expect(key.remove).toHaveBeenCalledTimes(1);
  });

  it('zablokowany uiMode nie przełącza trybu', () => {
    const storage = createMemoryStorage();
    const store = new SettingsStore(storage);
    store.setLock('uiMode', true);
    const uiMode = createUiMode(store, makeEnv(''));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    uiMode.toggle();
    expect(uiMode.getMode()).toBe('user');
    warn.mockRestore();
  });
});
