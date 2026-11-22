/**
 * Loader (Phase 11, 11-03): floating progress indicator (does not block the canvas).
 */
import { el } from './dom';
import { t } from '../../app/copy';

export interface LoaderHandle {
  show(text?: string): void;
  hide(): void;
  destroy(): void;
}

export function createLoader(container: HTMLElement): LoaderHandle {
  const text = el('div', { className: 'loader-text', text: t('loader.default') });
  const node = el('div', { className: 'loader-overlay hidden' }, [
    el('div', { className: 'spinner' }),
    text,
  ]);
  container.append(node);

  return {
    show(message = t('loader.model')): void {
      text.textContent = message;
      node.classList.remove('hidden');
    },
    hide(): void {
      node.classList.add('hidden');
    },
    destroy(): void {
      node.remove();
    },
  };
}
