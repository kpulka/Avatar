// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { PanelDefinition, PanelRegistry } from '../src/ui/studio/panel-registry';
import { createStudioShell } from '../src/ui/studio/studio-shell';
import { createCaptions } from '../src/ui/user/captions';
import { createStatusPill } from '../src/ui/user/status-pill';
import { createConversationDock } from '../src/ui/user/conversation-dock';
import { createUserSettings } from '../src/ui/user/user-settings';
import { createAlgorithmSwitcher } from '../src/ui/user/algorithm-switcher';
import { createScenePanel } from '../src/ui/studio/panels/scene-panel';
import { createSessionPanel } from '../src/ui/studio/panels/session-panel';
import { createA2fPanel } from '../src/ui/studio/panels/a2f-panel';
import { createAnimationPanel } from '../src/ui/studio/panels/animation-panel';
import { ICON_NAMES, icon } from '../src/ui/shared/icons';
import { createUiFixture } from './helpers/ui-fixtures';
import { defined } from './helpers/defined';

function dummyPanel(id: string): PanelDefinition {
  return {
    id,
    title: `Panel ${id}`,
    icon: 'P',
    visibleIn: 'studio',
    region: 'right',
    mount: ({ container }) => {
      const node = document.createElement('div');
      node.dataset.panelBody = id;
      container.append(node);
      return { destroy: () => node.remove() };
    },
  };
}

function mountShell(): { tabs: HTMLButtonElement[]; panel: HTMLElement } {
  const fixture = createUiFixture();
  const registry = new PanelRegistry();
  for (const id of ['one', 'two', 'three']) registry.register(dummyPanel(id));
  const shell = createStudioShell({
    registry,
    contextFactory: (container) => ({ ...fixture.ctx, container }),
    host: fixture.host,
  });
  shell.open();
  const tabs = [...fixture.host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const panel = fixture.host.querySelector('[role="tabpanel"]') as HTMLElement;
  return { tabs, panel };
}

function key(target: HTMLElement, name: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
}

describe('studio tablist (WAI-ARIA Tabs)', () => {
  it('syncs aria-selected and roving tabindex with the active tab; panel is labelled by it', () => {
    const { tabs, panel } = mountShell();
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
    expect(panel.getAttribute('aria-labelledby')).toBe(defined(tabs[0]).id);

    defined(tabs[2]).click();
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true']);
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([-1, -1, 0]);
    expect(panel.getAttribute('aria-labelledby')).toBe(defined(tabs[2]).id);
  });

  it('every tab aria-controls points at an existing role=tabpanel', () => {
    const { tabs, panel } = mountShell();
    for (const tab of tabs) {
      expect(tab.getAttribute('aria-controls')).toBe(panel.id);
      expect(document.getElementById(tab.getAttribute('aria-controls') as string)?.getAttribute('role')).toBe('tabpanel');
    }
  });

  it('ArrowRight/ArrowLeft move focus and select, wrapping around; Home/End jump', () => {
    const { tabs } = mountShell();
    defined(tabs[0]).focus();
    key(defined(tabs[0]), 'ArrowRight');
    expect(document.activeElement).toBe(tabs[1]);
    expect(defined(tabs[1]).getAttribute('aria-selected')).toBe('true');

    key(defined(tabs[1]), 'End');
    expect(document.activeElement).toBe(tabs[2]);
    key(defined(tabs[2]), 'ArrowRight');
    expect(document.activeElement).toBe(tabs[0]);
    key(defined(tabs[0]), 'ArrowLeft');
    expect(document.activeElement).toBe(tabs[2]);
    key(defined(tabs[2]), 'Home');
    expect(document.activeElement).toBe(tabs[0]);
    expect(defined(tabs[0]).getAttribute('aria-selected')).toBe('true');
  });
});

describe('live regions', () => {
  it('captions are a polite log region with an accessible name', () => {
    const fixture = createUiFixture();
    createCaptions().mount(fixture.ctx);
    const region = fixture.host.querySelector('.cinema-captions') as HTMLElement;
    expect(region.getAttribute('role')).toBe('log');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('aria-label')).toBeTruthy();
  });

  it('status pill label is role=status and the decorative dot is aria-hidden', () => {
    const fixture = createUiFixture();
    createStatusPill().mount(fixture.ctx);
    expect(fixture.host.querySelector('.status-pill')?.getAttribute('role')).toBe('status');
    expect(fixture.host.querySelector('.pulse-dot')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('algorithm status line is a polite status region', () => {
    const fixture = createUiFixture();
    createAlgorithmSwitcher().mount(fixture.ctx);
    const line = fixture.host.querySelector('.algo-status') as HTMLElement;
    expect(line.getAttribute('role')).toBe('status');
    expect(line.getAttribute('aria-live')).toBe('polite');
  });
});

describe('form label association', () => {
  function assertLabelled(root: ParentNode): void {
    const controls = [...root.querySelectorAll<HTMLElement>('select, input[type="range"]')];
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      const labelled =
        control.getAttribute('aria-label') ||
        (control.id && root.querySelector(`label[for="${control.id}"]`)) ||
        control.closest('label');
      expect(labelled, `${control.tagName}#${control.id} has no label`).toBeTruthy();
    }
  }

  it('user settings: every select / slider has a label with matching for', () => {
    const fixture = createUiFixture();
    createUserSettings().mount(fixture.ctx);
    (fixture.host.querySelector('.user-settings-btn') as HTMLButtonElement).click();
    return vi.waitFor(() => expect(fixture.modalCalls).toHaveLength(1)).then(() => {
      const form = defined(fixture.modalCalls[0]).content;
      // Controls live in the form; labels too (ids are stable, same document).
      document.body.append(form);
      assertLabelled(form);
      expect(form.querySelectorAll('label[for]').length).toBe(5);
    });
  });

  it('a2f URL input has a visible label; session agent and volume are labelled; animation sliders too', () => {
    const fixture = createUiFixture();
    createA2fPanel().mount(fixture.ctx);
    const url = fixture.host.querySelector('input.text-input') as HTMLInputElement;
    expect(fixture.host.querySelector(`label[for="${url.id}"]`)?.textContent).toBeTruthy();

    const session = createUiFixture();
    createSessionPanel().mount(session.ctx);
    expect(session.host.querySelector('input.text-input')?.id).toBeTruthy();
    const sessionRoot = session.host.querySelector('.panel-session') as HTMLElement;
    const sessionInputs = [...sessionRoot.querySelectorAll<HTMLInputElement>('input.text-input, input[type="range"]')];
    for (const input of sessionInputs) {
      expect(sessionRoot.querySelector(`label[for="${input.id}"]`), input.id).not.toBeNull();
    }

    const animation = createUiFixture();
    createAnimationPanel().mount(animation.ctx);
    const sliders = [...animation.host.querySelectorAll<HTMLInputElement>('input[type="range"]')];
    expect(sliders.length).toBeGreaterThanOrEqual(9);
    for (const slider of sliders) {
      expect(animation.host.querySelector(`label[for="${slider.id}"]`), slider.id).not.toBeNull();
    }
  });
});

describe('keyboard-reachable file upload', () => {
  it('scene panel: GLB picker is a real button that triggers the hidden input; input is out of the tab order', () => {
    const fixture = createUiFixture();
    createScenePanel().mount(fixture.ctx);
    const fileInput = fixture.host.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput.tabIndex).toBe(-1);
    expect(fileInput.getAttribute('aria-hidden')).toBe('true');
    expect(fixture.host.querySelector('label.btn')).toBeNull();
    const click = vi.spyOn(fileInput, 'click');
    const button = fixture.host.querySelector('button.file-upload-btn') as HTMLButtonElement;
    expect(button.tagName).toBe('BUTTON');
    button.click();
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('session panel: profile import is a button driving the hidden input', () => {
    const fixture = createUiFixture();
    createSessionPanel().mount(fixture.ctx);
    const fileInput = fixture.host.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput.tabIndex).toBe(-1);
    const click = vi.spyOn(fileInput, 'click');
    const buttons = [...fixture.host.querySelectorAll<HTMLButtonElement>('.panel-actions button')];
    defined(buttons[1]).click();
    expect(click).toHaveBeenCalledTimes(1);
  });
});

describe('SVG icons', () => {
  it('every icon is an aria-hidden, currentColor inline svg', () => {
    for (const name of ICON_NAMES) {
      const svg = icon(name);
      expect(svg.tagName.toLowerCase()).toBe('svg');
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('stroke')).toBe('currentColor');
      expect(svg.childElementCount).toBeGreaterThan(0);
    }
  });

  it('dock buttons carry an svg icon plus a visible text label; icons swap with state', () => {
    const fixture = createUiFixture();
    createConversationDock().mount(fixture.ctx);
    const buttons = [...fixture.host.querySelectorAll<HTMLButtonElement>('.dock-btn')];
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      expect(button.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
      expect(button.querySelector('.btn-label')?.textContent).toBeTruthy();
      expect(button.getAttribute('aria-label')).toBeTruthy();
    }
    const before = defined(buttons[1]).querySelector('svg')?.getAttribute('class');
    fixture.events.emit('voice:muted', true);
    expect(defined(buttons[1]).querySelector('svg')?.getAttribute('class')).not.toBe(before);
  });

  it('settings gear is an svg icon button with an accessible name', () => {
    const fixture = createUiFixture();
    createUserSettings().mount(fixture.ctx);
    const gear = fixture.host.querySelector('.user-settings-btn') as HTMLButtonElement;
    expect(gear.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(gear.getAttribute('aria-label')).toBeTruthy();
  });

  it('user layer sources contain no emoji', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const dir = join(process.cwd(), 'src', 'ui', 'user');
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2699}\u{FE0F}]/u;
    const offenders = readdirSync(dir)
      .filter((name) => name.endsWith('.ts'))
      .filter((name) => emoji.test(readFileSync(join(dir, name), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
