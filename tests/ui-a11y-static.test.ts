// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCaptions } from '../src/ui/user/captions';
import { createStatusPill } from '../src/ui/user/status-pill';
import { createAlgorithmSwitcher } from '../src/ui/user/algorithm-switcher';
import { createConversationDock } from '../src/ui/user/conversation-dock';
import { createConnectionBanner } from '../src/ui/user/connection-banner';
import { createA2fPanel } from '../src/ui/studio/panels/a2f-panel';
import { createSessionPanel } from '../src/ui/studio/panels/session-panel';
import { createModal } from '../src/ui/shared/modal';
import { createToast } from '../src/ui/shared/toast';
import { createLoader } from '../src/ui/shared/loader';
import { createUiFixture } from './helpers/ui-fixtures';
/** Narrows `T | null` (querySelector results) to `T` with a readable failure. */
function found<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`expected ${what} to exist`);
  return value;
}

/**
 * UIX-04 static gates that are not covered by a11y-dom.test.ts / shared-ui.test.ts:
 * - every live region the UI mounts is explicitly polite (not only via the implicit role semantics);
 * - the modal keeps its focus contract on the native <dialog>.showModal() path as well as on the fallback path.
 * Contrast lives in ui-contrast.test.ts.
 */

describe('live regions (UIX-04)', () => {
  it('every role=status / role=log region the UI mounts declares aria-live=polite', () => {
    const fixture = createUiFixture({ uiMode: 'studio' });
    for (const create of [
      createCaptions,
      createStatusPill,
      createAlgorithmSwitcher,
      createConversationDock,
      createA2fPanel,
      createSessionPanel,
    ]) {
      create().mount(fixture.ctx);
    }
    const shared = document.createElement('div');
    document.body.append(shared);
    createToast(shared).show('saved', 'success');
    createLoader(shared).show('Loading');

    const regions = [...document.body.querySelectorAll<HTMLElement>('[role="status"], [role="log"]')];
    // captions, status label, lip-sync chip, algo status, a2f status line, success toast, loader.
    expect(regions.length).toBeGreaterThanOrEqual(7);
    const missing = regions.filter((region) => region.getAttribute('aria-live') !== 'polite').map((region) => region.className);
    expect(missing).toEqual([]);
  });

  it('the four named regions are present: captions, voice status, algorithm status, compare/lip-sync chip', () => {
    const fixture = createUiFixture();
    createCaptions().mount(fixture.ctx);
    createStatusPill().mount(fixture.ctx);
    createAlgorithmSwitcher().mount(fixture.ctx);
    const live = (selector: string): string | null | undefined => fixture.host.querySelector(selector)?.getAttribute('aria-live');
    expect(live('.cinema-captions')).toBe('polite');
    expect(live('.status-pill.voice-idle')).toBe('polite');
    expect(live('.lipsync-chip')).toBe('polite');
    expect(live('.algo-status')).toBe('polite');
  });

  it('errors are announced assertively through role=alert, never as a polite status', () => {
    const fixture = createUiFixture();
    createConnectionBanner().mount(fixture.ctx);
    expect(fixture.host.querySelector('.conn-error')?.getAttribute('role')).toBe('alert');

    const shared = document.createElement('div');
    document.body.append(shared);
    createToast(shared).show('boom', 'error');
    const toast = found(shared.querySelector('.toast'), '.toast');
    expect(toast.getAttribute('role')).toBe('alert');
    expect(toast.getAttribute('aria-live')).toBeNull();
  });
});

describe('modal focus management on the native <dialog> path (UIX-04)', () => {
  let host: HTMLElement;

  /** jsdom has no top-layer <dialog>: model the browser contract (showModal sets `open`, close() fires `close`). */
  function stubNativeDialog(): void {
    const proto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
    proto.showModal = function (this: HTMLDialogElement): void {
      this.setAttribute('open', '');
    };
    proto.close = function (this: HTMLDialogElement): void {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }

  beforeEach(() => {
    stubNativeDialog();
    document.body.replaceChildren();
    host = document.createElement('div');
    document.body.append(host);
  });

  afterEach(() => {
    const proto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
    delete proto.showModal;
    delete proto.close;
  });

  it('opens with showModal, is labelled by its title, and starts focus order at the close button', () => {
    const modal = createModal(host);
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    modal.open('Settings', document.createElement('div'));
    expect(showModal).toHaveBeenCalledTimes(1);
    const dialog = found(host.querySelector('dialog'), 'dialog');
    const title = found(dialog.querySelector('h3'), 'h3');
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
    // Browsers focus the first focusable element on showModal(); it must be the visible close control.
    const firstFocusable = dialog.querySelector('button, a[href], input, select, textarea, [tabindex]');
    expect(firstFocusable?.classList.contains('dialog-close')).toBe(true);
    expect(modal.isOpen()).toBe(true);
  });

  it('returns focus to the trigger when closed via the close button, close() and a native Escape (close event)', () => {
    const trigger = document.createElement('button');
    host.append(trigger);
    const modal = createModal(host);
    const dialog = (): HTMLDialogElement => found(host.querySelector('dialog'), 'dialog');

    // 1. close button
    trigger.focus();
    modal.open('A', document.createElement('div'));
    (dialog().querySelector('button.dialog-close') as HTMLButtonElement).focus();
    (dialog().querySelector('button.dialog-close') as HTMLButtonElement).click();
    expect(modal.isOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);

    // 2. programmatic close()
    trigger.focus();
    modal.open('B', document.createElement('div'));
    (dialog().querySelector('button.dialog-close') as HTMLButtonElement).focus();
    modal.close();
    expect(document.activeElement).toBe(trigger);

    // 3. native Escape: the browser closes the dialog itself and only fires `close`
    trigger.focus();
    modal.open('C', document.createElement('div'));
    (dialog().querySelector('button.dialog-close') as HTMLButtonElement).focus();
    dialog().close();
    expect(modal.isOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('does not throw or steal focus when the trigger was removed while the dialog was open', () => {
    const trigger = document.createElement('button');
    host.append(trigger);
    trigger.focus();
    const modal = createModal(host);
    modal.open('A', document.createElement('div'));
    trigger.remove();
    expect(() => modal.close()).not.toThrow();
    expect(modal.isOpen()).toBe(false);
  });
});
