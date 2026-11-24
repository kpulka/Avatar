/**
 * Modal (Phase 11, 11-03; contract C-2 from Phase 15-03): a dialog based on <dialog>.
 *
 * - Title is associated via `aria-labelledby`; a visible close button sits in the header.
 * - Native path (`showModal`): the browser traps focus and handles Esc.
 * - Fallback path (no `showModal`): `open` attribute + manual focus trap + Esc handling.
 * - Focus returns to the invoker when the dialog closes.
 */
import { el, uid } from './dom';
import { t } from '../../app/copy';

export interface ModalHandle {
  open(title: string, content: HTMLElement): void;
  close(): void;
  isOpen(): boolean;
  destroy(): void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function createModal(container: HTMLElement): ModalHandle {
  const content = el('div', { className: 'modal-content' });
  const dialog = el('dialog', { className: 'settings-dialog' });
  dialog.append(content);
  container.append(dialog);

  const dialogEl = dialog as HTMLDialogElement;
  const native = typeof dialogEl.showModal === 'function';
  let invoker: HTMLElement | null = null;

  const restoreFocus = (): void => {
    if (invoker && invoker.isConnected) invoker.focus();
    invoker = null;
  };

  const close = (): void => {
    if (typeof dialogEl.close === 'function') {
      dialogEl.close();
    }
    const wasOpen = dialog.hasAttribute('open');
    dialog.removeAttribute('open');
    if (wasOpen || invoker) restoreFocus();
  };

  // Native Esc closes the dialog without going through close(): restore focus on the close event.
  dialog.addEventListener('close', restoreFocus);

  if (!native) {
    dialog.addEventListener('keydown', (event) => {
      const key = (event as KeyboardEvent).key;
      if (key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (key !== 'Tab') return;
      const focusables = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return; // no focusable elements
      const active = document.activeElement;
      if ((event as KeyboardEvent).shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!(event as KeyboardEvent).shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  return {
    open(title: string, contentEl: HTMLElement): void {
      invoker = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const titleId = uid('modal-title');
      const closeButton = el('button', {
        className: 'dialog-close',
        type: 'button',
        text: '×',
        ariaLabel: t('shared.close'),
      });
      closeButton.addEventListener('click', close);
      dialog.setAttribute('aria-labelledby', titleId);
      content.replaceChildren(
        el('div', { className: 'dialog-header' }, [el('h3', { id: titleId, text: title }), closeButton]),
        contentEl
      );
      if (native) {
        dialogEl.showModal();
      } else {
        dialog.setAttribute('open', '');
        dialog.querySelector<HTMLElement>(FOCUSABLE)?.focus();
      }
    },
    close,
    isOpen(): boolean {
      return dialog.hasAttribute('open');
    },
    destroy(): void {
      dialog.remove();
    },
  };
}
