/**
 * Toast (Faza 11, 11-03): jeden komunikat, auto-hide dla sukcesu, błąd zostaje do zamknięcia
 * (UI-SPEC: Toast/Loader — covered).
 */
import { el } from './dom';

export interface ToastHandle {
  show(message: string, type?: 'error' | 'success'): void;
  hide(): void;
  destroy(): void;
}

export function createToast(container: HTMLElement, autoHideMs = 5000): ToastHandle {
  const node = el('div', { className: 'toast hidden' });
  container.append(node);
  let timer: number | null = null;

  const clearTimer = (): void => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };

  return {
    show(message: string, type: 'error' | 'success' = 'error'): void {
      clearTimer();
      node.textContent = message;
      node.className = `toast ${type === 'success' ? 'toast-success' : ''}`;
      node.classList.remove('hidden');
      if (type === 'success') {
        timer = window.setTimeout(() => {
          node.classList.add('hidden');
          timer = null;
        }, autoHideMs);
      }
    },
    hide(): void {
      clearTimer();
      node.classList.add('hidden');
    },
    destroy(): void {
      clearTimer();
      node.remove();
    },
  };
}
