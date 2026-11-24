// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createUserSettings } from '../src/ui/user/user-settings';
import { createUiFixture, FixtureOptions } from './helpers/ui-fixtures';
import type { AppServices, UiModeService } from '../src/app/app-types';
import { defined } from './helpers/defined';

async function openSettings(options: FixtureOptions = {}) {
  const fixture = createUiFixture(options);
  createUserSettings().mount(fixture.ctx);
  (fixture.host.querySelector('.user-settings-btn') as HTMLButtonElement).click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(fixture.modalCalls).toHaveLength(1);
  const form = defined(fixture.modalCalls[0]).content;
  document.body.append(form);
  return { fixture, form };
}

describe('studio discoverability (15-06)', () => {
  it('AppServices exposes the uiMode seam (compile-time shape)', () => {
    const probe: Pick<AppServices, 'uiMode'> = {
      uiMode: { getMode: () => 'user', set: () => undefined, toggle: () => undefined } satisfies UiModeService,
    };
    expect(probe.uiMode.getMode()).toBe('user');
  });

  it('settings form ends with a labelled Studio row; checkbox reflects the current mode', async () => {
    const { form } = await openSettings({ uiMode: 'studio' });
    const row = form.querySelector('.settings-studio-row') as HTMLElement;
    expect(row).not.toBeNull();
    expect(form.lastElementChild).toBe(row);
    const checkbox = row.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(row.querySelector(`label[for="${checkbox.id}"]`)?.textContent).toContain('Studio');
    expect(row.textContent).toContain('Ctrl+Shift+D');
  });

  it('toggling routes through services.uiMode.set and closes the dialog when entering studio', async () => {
    const { fixture, form } = await openSettings();
    const checkbox = form.querySelector('.settings-studio-row input') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    expect(fixture.spies.uiModeSet).toHaveBeenCalledWith('studio');
    expect(fixture.spies.modalClose).toHaveBeenCalledTimes(1);

    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    expect(fixture.spies.uiModeSet).toHaveBeenLastCalledWith('user');
    expect(fixture.spies.modalClose).toHaveBeenCalledTimes(1);
  });

  it('a locked uiMode disables the switch and explains why', async () => {
    const { form } = await openSettings({ locks: ['uiMode'] });
    const checkbox = form.querySelector('.settings-studio-row input') as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
    expect(checkbox.title).toContain('uiMode');
  });
});
