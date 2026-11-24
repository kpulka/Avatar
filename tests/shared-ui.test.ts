// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createToast, MAX_TOASTS } from '../src/ui/shared/toast';
import { createModal } from '../src/ui/shared/modal';
import { createLoader } from '../src/ui/shared/loader';
import { uid } from '../src/ui/shared/dom';
import { handleWebGLFailure } from '../src/ui/webgl-fallback';

let host: HTMLElement;

beforeEach(() => {
  document.body.replaceChildren();
  host = document.createElement('div');
  document.body.append(host);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('dom helpers', () => {
  it('uid() returns unique prefixed ids', () => {
    const a = uid('x');
    const b = uid('x');
    expect(a).not.toBe(b);
    expect(a.startsWith('a15-x-')).toBe(true);
  });
});

describe('toast contract (C-1)', () => {
  it('stacks messages instead of overwriting (3 shows => 3 nodes)', () => {
    const toast = createToast(host);
    toast.show('one', 'success');
    toast.show('two', 'success');
    toast.show('three', 'error');
    expect(host.querySelectorAll('.toast')).toHaveLength(3);
  });

  it('drops the oldest toast beyond the stack limit', () => {
    const toast = createToast(host);
    for (let i = 0; i < MAX_TOASTS + 2; i += 1) toast.show(`m${i}`, 'success');
    const messages = [...host.querySelectorAll('.toast-message')].map((n) => n.textContent);
    expect(messages).toEqual(['m2', 'm3', 'm4']);
  });

  it('error toast is role=alert with a close button; click removes it; it does not auto-hide', () => {
    const toast = createToast(host);
    toast.show('boom', 'error');
    const node = host.querySelector('.toast') as HTMLElement;
    expect(node.getAttribute('role')).toBe('alert');
    const close = node.querySelector('button.toast-close') as HTMLButtonElement;
    expect(close).not.toBeNull();
    expect(close.getAttribute('aria-label')).toBeTruthy();
    vi.advanceTimersByTime(60_000);
    expect(host.querySelector('.toast')).not.toBeNull();
    close.click();
    expect(host.querySelector('.toast')).toBeNull();
  });

  it('success toast is role=status, has no close button and auto-hides', () => {
    const toast = createToast(host, 5000);
    toast.show('ok', 'success');
    const node = host.querySelector('.toast') as HTMLElement;
    expect(node.getAttribute('role')).toBe('status');
    expect(node.querySelector('button')).toBeNull();
    vi.advanceTimersByTime(5001);
    expect(host.querySelector('.toast')).toBeNull();
  });

  it('message goes through textContent (no HTML injection)', () => {
    const toast = createToast(host);
    toast.show('<img src=x onerror=alert(1)>', 'success');
    expect(host.querySelector('.toast img')).toBeNull();
  });

  it('destroy() removes every node and pending timers', () => {
    const toast = createToast(host);
    toast.show('a', 'success');
    toast.show('b', 'error');
    toast.destroy();
    expect(host.querySelector('.toast-stack')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('modal contract (C-2, fallback path: jsdom has no showModal)', () => {
  it('labels the dialog by its title and exposes a close button', () => {
    const modal = createModal(host);
    modal.open('Title', document.createElement('div'));
    const dialog = host.querySelector('dialog') as HTMLDialogElement;
    const heading = dialog.querySelector('h3') as HTMLElement;
    expect(heading.id).toBeTruthy();
    expect(dialog.getAttribute('aria-labelledby')).toBe(heading.id);
    const close = dialog.querySelector('button.dialog-close') as HTMLButtonElement;
    expect(close.getAttribute('aria-label')).toBeTruthy();
    expect(modal.isOpen()).toBe(true);
    close.click();
    expect(modal.isOpen()).toBe(false);
  });

  it('focuses the first focusable on open, traps Tab and closes on Escape, restoring focus to the invoker', () => {
    const invoker = document.createElement('button');
    host.append(invoker);
    invoker.focus();
    const modal = createModal(host);
    const body = document.createElement('div');
    const input = document.createElement('input');
    body.append(input);
    modal.open('T', body);
    const dialog = host.querySelector('dialog') as HTMLDialogElement;
    const closeBtn = dialog.querySelector('button.dialog-close') as HTMLElement;
    // First focusable in DOM order is the header close button.
    expect(document.activeElement).toBe(closeBtn);

    input.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    input.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(closeBtn);

    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(modal.isOpen()).toBe(false);
    expect(document.activeElement).toBe(invoker);
  });
});

describe('loader contract (C-3)', () => {
  it('is a polite status region and starts hidden', () => {
    const loader = createLoader(host);
    const node = host.querySelector('.loader-overlay') as HTMLElement;
    expect(node.getAttribute('role')).toBe('status');
    expect(node.getAttribute('aria-live')).toBe('polite');
    expect(node.classList.contains('hidden')).toBe(true);
    loader.show('Loading');
    expect(node.classList.contains('hidden')).toBe(false);
  });

  it('error() shows the error variant; retry button calls onRetry; hide() clears both states', () => {
    const onRetry = vi.fn();
    const loader = createLoader(host, { onRetry });
    const node = host.querySelector('.loader-overlay') as HTMLElement;
    loader.show('busy');
    loader.error('failed');
    expect(node.classList.contains('loader-error')).toBe(true);
    expect(node.querySelector('.loader-text')?.textContent).toBe('failed');
    expect(node.querySelector('.spinner')?.classList.contains('hidden')).toBe(true);
    const retry = node.querySelector('button.loader-retry') as HTMLButtonElement;
    expect(retry.classList.contains('hidden')).toBe(false);
    retry.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
    loader.hide();
    expect(node.classList.contains('hidden')).toBe(true);
    expect(node.classList.contains('loader-error')).toBe(false);
    expect(node.querySelector('.spinner')?.classList.contains('hidden')).toBe(false);
  });

  it('error() without onRetry hides the retry button', () => {
    const loader = createLoader(host);
    loader.error('failed');
    expect(host.querySelector('button.loader-retry')?.classList.contains('hidden')).toBe(true);
  });
});

describe('webgl fallback', () => {
  it('renders an alert card labelled by its heading and hides the dead canvas', () => {
    document.body.innerHTML = '<canvas id="avatar-canvas"></canvas><div id="webgl-fallback" class="overlay hidden"></div>';
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    handleWebGLFailure();
    const card = document.querySelector('#webgl-fallback .error-card') as HTMLElement;
    expect(card.getAttribute('role')).toBe('alert');
    expect(document.getElementById(card.getAttribute('aria-labelledby') as string)).not.toBeNull();
    expect(document.getElementById('webgl-fallback')?.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('avatar-canvas')?.classList.contains('hidden')).toBe(true);
  });
});
