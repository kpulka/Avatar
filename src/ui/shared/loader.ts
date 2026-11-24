/**
 * Loader (Phase 11, 11-03; contract C-3 from Phase 15-03): floating progress indicator that never
 * blocks the canvas. `role="status"` (polite); has a busy state and an error state with an optional
 * retry action. `hide()` clears both.
 */
import { el } from './dom';
import { t } from '../../app/copy';

export interface LoaderOptions {
  /** Retry action shown in the error state (omit for a message-only error). */
  onRetry?: () => void;
  /** Label of the retry button (default: the generic "Try again"). */
  retryLabel?: string;
}

export interface LoaderHandle {
  show(text?: string): void;
  /** Swaps the spinner for an error marker (+ retry button when `onRetry` was supplied). */
  error(message: string): void;
  hide(): void;
  destroy(): void;
}

export function createLoader(container: HTMLElement, options: LoaderOptions = {}): LoaderHandle {
  const spinner = el('div', { className: 'spinner', attrs: { 'aria-hidden': 'true' } });
  const errorIcon = el('div', { className: 'loader-error-icon hidden', text: '!', attrs: { 'aria-hidden': 'true' } });
  const text = el('div', { className: 'loader-text', text: t('loader.default') });
  const retry = el('button', {
    className: 'btn btn-small btn-secondary loader-retry hidden',
    type: 'button',
    text: options.retryLabel ?? t('panel.retry'),
  });
  retry.addEventListener('click', () => options.onRetry?.());
  const node = el('div', { className: 'loader-overlay hidden', role: 'status', attrs: { 'aria-live': 'polite' } }, [
    spinner,
    errorIcon,
    text,
    retry,
  ]);
  container.append(node);

  const setBusy = (): void => {
    node.classList.remove('loader-error');
    spinner.classList.remove('hidden');
    errorIcon.classList.add('hidden');
    retry.classList.add('hidden');
  };

  return {
    show(message = t('loader.model')): void {
      setBusy();
      text.textContent = message;
      node.classList.remove('hidden');
    },
    error(message: string): void {
      node.classList.add('loader-error');
      spinner.classList.add('hidden');
      errorIcon.classList.remove('hidden');
      retry.classList.toggle('hidden', !options.onRetry);
      text.textContent = message;
      node.classList.remove('hidden');
    },
    hide(): void {
      setBusy();
      node.classList.add('hidden');
    },
    destroy(): void {
      node.remove();
    },
  };
}
