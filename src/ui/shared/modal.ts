/**
 * Modal (Faza 11, 11-03): prosty dialog oparty o <dialog> (fallback: atrybut open).
 */
import { el } from './dom';

export interface ModalHandle {
  open(title: string, content: HTMLElement): void;
  close(): void;
  isOpen(): boolean;
  destroy(): void;
}

export function createModal(container: HTMLElement): ModalHandle {
  const content = el('div', { className: 'modal-content' });
  const dialog = el('dialog', { className: 'settings-dialog' });
  dialog.append(content);
  container.append(dialog);

  const dialogEl = dialog as HTMLDialogElement;

  return {
    open(title: string, contentEl: HTMLElement): void {
      content.replaceChildren(el('div', { className: 'dialog-header' }, [el('h3', { text: title })]), contentEl);
      if (typeof dialogEl.showModal === 'function') {
        dialogEl.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    },
    close(): void {
      if (typeof dialogEl.close === 'function') {
        dialogEl.close();
      }
      dialog.removeAttribute('open');
    },
    isOpen(): boolean {
      return dialog.hasAttribute('open');
    },
    destroy(): void {
      dialog.remove();
    },
  };
}
