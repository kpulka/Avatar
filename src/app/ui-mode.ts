/**
 * Tryb UI: `user` (domyślny) i `studio` (narzędzia) — Faza 11.
 *
 * Dostęp do studia: `?studio=1` albo skrót Ctrl+Shift+D; wybór persystuje w `user.uiMode`.
 * Efekt: `body[data-mode]` (widoczność warstw przez CSS). Lock `uiMode` respektowany.
 */
import { SettingsStore } from './store/settings-store';
import { UiMode } from './store/settings-schema';
import { Unsub } from './events';

export type { UiMode };

export interface UiModeEnv {
  /** Query string (np. window.location.search) — wstrzykiwany dla testów. */
  search: string;
  /** Element, na którym ustawiamy data-mode (zwykle document.body). */
  body: { setAttribute(name: string, value: string): void };
}

export interface KeyboardTarget {
  addEventListener(type: 'keydown', handler: (event: KeyboardEventLike) => void): void;
  removeEventListener?(type: 'keydown', handler: (event: KeyboardEventLike) => void): void;
}

export interface KeyboardEventLike {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  target: unknown;
  preventDefault?(): void;
}

export interface UiModeController {
  getMode(): UiMode;
  set(mode: UiMode): void;
  toggle(): void;
  apply(): void;
  attachShortcut(target: KeyboardTarget): Unsub;
}

function isEditableTarget(target: unknown): boolean {
  if (target === null || typeof target !== 'object') return false;
  const element = target as { tagName?: string; isContentEditable?: boolean };
  const tag = (element.tagName ?? '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable === true;
}

export function createUiMode(store: SettingsStore, env: UiModeEnv): UiModeController {
  const fromUrl = new URLSearchParams(env.search).get('studio') === '1';
  let mode: UiMode = fromUrl ? 'studio' : store.getEffective<UiMode>('uiMode');
  if (fromUrl && !store.isLocked('uiMode')) {
    store.setUser('uiMode', 'studio');
  }

  const apply = (): void => {
    env.body.setAttribute('data-mode', mode);
  };

  const set = (next: UiMode): void => {
    if (next === mode) {
      apply();
      return;
    }
    if (store.isLocked('uiMode')) {
      console.warn('[UiMode] Przełączanie trybu zablokowane przez studio — ignoruję.');
      return;
    }
    mode = next;
    store.setUser('uiMode', next);
    apply();
  };

  apply();

  return {
    getMode: () => mode,
    set,
    toggle: () => set(mode === 'user' ? 'studio' : 'user'),
    apply,
    attachShortcut: (target: KeyboardTarget): Unsub => {
      const handler = (event: KeyboardEventLike): void => {
        if (!event.ctrlKey || !event.shiftKey) return;
        if (event.key.toLowerCase() !== 'd') return;
        if (isEditableTarget(event.target)) return;
        event.preventDefault?.();
        set(mode === 'user' ? 'studio' : 'user');
      };
      target.addEventListener('keydown', handler);
      return () => {
        target.removeEventListener?.('keydown', handler);
      };
    },
  };
}
