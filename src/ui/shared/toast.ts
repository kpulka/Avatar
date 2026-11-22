/**
 * Toast (Phase 11, 11-03; contract C-1 from Phase 15-03).
 *
 * - Up to `MAX_TOASTS` stacked messages, newer ones never overwrite older ones; when the stack is
 *   full the oldest is dropped.
 * - Success/info: `role="status"`, auto-hides. Errors: `role="alert"`, persist until dismissed and
 *   carry a visible close button.
 * - Text always via `textContent`.
 */
import { el } from './dom';
import { t } from '../../app/copy';

export const MAX_TOASTS = 3;

export interface ToastHandle {
  show(message: string, type?: 'error' | 'success'): void;
  hide(): void;
  destroy(): void;
}

export function createToast(container: HTMLElement, autoHideMs = 5000): ToastHandle {
  const stack = el('div', { className: 'toast-stack' });
  container.append(stack);
  const timers = new Map<HTMLElement, number>();

  const remove = (node: HTMLElement): void => {
    const timer = timers.get(node);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.delete(node);
    }
    node.remove();
  };

  const clearAll = (): void => {
    for (const node of [...stack.children] as HTMLElement[]) remove(node);
  };

  return {
    show(message: string, type: 'error' | 'success' = 'error'): void {
      const isError = type === 'error';
      const node = el(
        'div',
        {
          className: `toast ${isError ? '' : 'toast-success'}`.trim(),
          role: isError ? 'alert' : 'status',
          attrs: { 'aria-atomic': 'true' },
        },
        [el('span', { className: 'toast-message', text: message })]
      );
      if (isError) {
        const close = el('button', {
          className: 'toast-close',
          type: 'button',
          text: '×',
          ariaLabel: t('shared.dismiss'),
        });
        close.addEventListener('click', () => remove(node));
        node.append(close);
      } else {
        timers.set(
          node,
          window.setTimeout(() => remove(node), autoHideMs)
        );
      }
      stack.append(node);
      while (stack.children.length > MAX_TOASTS) {
        remove(stack.firstElementChild as HTMLElement);
      }
    },
    hide(): void {
      clearAll();
    },
    destroy(): void {
      clearAll();
      stack.remove();
    },
  };
}
