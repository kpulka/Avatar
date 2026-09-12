/**
 * Loader (Faza 11, 11-03): pływający wskaźnik postępu (bez blokowania canvasu).
 */
import { el } from './dom';

export interface LoaderHandle {
  show(text?: string): void;
  hide(): void;
  destroy(): void;
}

export function createLoader(container: HTMLElement): LoaderHandle {
  const text = el('div', { className: 'loader-text', text: 'Ładowanie...' });
  const node = el('div', { className: 'loader-overlay hidden' }, [
    el('div', { className: 'spinner' }),
    text,
  ]);
  container.append(node);

  return {
    show(message = 'Ładowanie modelu 3D...'): void {
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
