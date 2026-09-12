/**
 * StudioShell (Faza 11, 11-03): prawy drawer z tabami z rejestru paneli + lewe drawery
 * dla paneli z `region: 'left'` (Wizemy, Inspektor). Lazy mount aktywnych paneli,
 * per-panel error boundary przez PanelRegistry.
 */
import { PanelContext, PanelRegistry } from './panel-registry';
import { el } from '../shared/dom';

export interface StudioShellOptions {
  registry: PanelRegistry;
  contextFactory: (container: HTMLElement) => PanelContext;
  host: HTMLElement;
}

export interface StudioShell {
  el: HTMLElement;
  open(): void;
  close(): void;
  isOpen(): boolean;
  openTab(id: string): void;
  toggleLeft(id: string): void;
  destroy(): void;
}

export function createStudioShell(options: StudioShellOptions): StudioShell {
  const { registry, contextFactory, host } = options;
  const rightPanels = registry.list('studio').filter((panel) => (panel.region ?? 'right') === 'right');
  const leftPanels = registry.list('studio').filter((panel) => panel.region === 'left');

  // ---- prawy drawer z tabami
  const closeButton = el('button', {
    className: 'btn-drawer-close',
    text: '✕',
    type: 'button',
    ariaLabel: 'Zamknij studio',
  });
  const drawer = el('aside', { className: 'side-drawer right-drawer hidden' });
  const tablist = el('div', { className: 'studio-tabs', attrs: { role: 'tablist', 'aria-label': 'Panele studia' } });
  const body = el('div', { className: 'drawer-body studio-tab-body' });
  const header = el('div', { className: 'drawer-header' }, [
    el('div', { className: 'drawer-title-group' }, [
      el('span', { className: 'drawer-header-icon', text: '🛠️' }),
      el('div', {}, [
        el('h3', { text: 'Studio' }),
        el('p', { className: 'drawer-subtitle', text: 'Konfiguracja i diagnostyka awatara' }),
      ]),
    ]),
  ]);
  header.append(closeButton);
  drawer.append(header, tablist, body);

  const tabButtons = new Map<string, HTMLButtonElement>();
  let activeId: string | null = null;

  const openTab = (id: string): void => {
    const definition = registry.get(id);
    if (!definition || definition.visibleIn !== 'studio' || definition.region === 'left') return;
    if (activeId && activeId !== id) {
      registry.destroy(activeId);
    }
    activeId = id;
    body.replaceChildren();
    registry.mount(id, contextFactory(body));
    for (const [key, button] of tabButtons) {
      button.classList.toggle('active', key === id);
      button.setAttribute('aria-selected', key === id ? 'true' : 'false');
    }
  };

  for (const panel of rightPanels) {
    const button = el('button', {
      className: 'studio-tab',
      type: 'button',
      attrs: { role: 'tab', 'aria-selected': 'false', 'data-panel': panel.id },
    }, [
      el('span', { className: 'btn-icon', text: panel.icon }),
      el('span', { className: 'btn-label', text: panel.title }),
    ]);
    button.addEventListener('click', () => openTab(panel.id));
    tabButtons.set(panel.id, button);
    tablist.append(button);
  }

  // ---- lewe drawery (Wizemy, Inspektor)
  const root = el('div', { className: 'studio-shell hidden' });
  const leftColumn = el('div', { className: 'studio-left-toggles' });
  const leftDrawers = new Map<string, { drawer: HTMLElement; mounted: boolean }>();

  for (const panel of leftPanels) {
    const drawerEl = el('aside', { className: 'side-drawer left-drawer hidden' });
    const panelBody = el('div', { className: 'drawer-body' });
    const panelClose = el('button', {
      className: 'btn-drawer-close',
      text: '✕',
      type: 'button',
      ariaLabel: `Zamknij ${panel.title}`,
    });
    const panelHeader = el('div', { className: 'drawer-header' }, [
      el('div', { className: 'drawer-title-group' }, [
        el('span', { className: 'drawer-header-icon', text: panel.icon }),
        el('div', {}, [el('h3', { text: panel.title })]),
      ]),
    ]);
    panelHeader.append(panelClose);
    drawerEl.append(panelHeader, panelBody);

    const toggleButton = el('button', {
      className: 'dock-icon-btn studio-left-toggle',
      type: 'button',
      ariaLabel: `Otwórz ${panel.title}`,
    }, [
      el('span', { className: 'btn-icon', text: panel.icon }),
      el('span', { className: 'icon-label', text: panel.title }),
    ]);

    const entry = { drawer: drawerEl, mounted: false };
    leftDrawers.set(panel.id, entry);

    const close = (): void => {
      drawerEl.classList.add('hidden');
      toggleButton.classList.remove('active');
    };

    toggleButton.addEventListener('click', () => {
      const hidden = drawerEl.classList.toggle('hidden');
      toggleButton.classList.toggle('active', !hidden);
      if (!hidden && !entry.mounted) {
        registry.mount(panel.id, contextFactory(panelBody));
        entry.mounted = true;
      }
    });
    panelClose.addEventListener('click', close);

    leftColumn.append(toggleButton);
    root.append(drawerEl);
  }

  root.append(drawer, leftColumn);
  host.append(root);

  const close = (): void => {
    drawer.classList.add('hidden');
    root.classList.add('hidden');
  };
  closeButton.addEventListener('click', close);

  return {
    el: root,
    open(): void {
      root.classList.remove('hidden');
      drawer.classList.remove('hidden');
      if (!activeId && rightPanels.length > 0) {
        openTab(rightPanels[0].id);
      }
    },
    close,
    isOpen(): boolean {
      return !root.classList.contains('hidden');
    },
    openTab,
    toggleLeft(id: string): void {
      const entry = leftDrawers.get(id);
      if (entry) {
        entry.drawer.classList.toggle('hidden');
      }
    },
    destroy(): void {
      registry.destroyAll();
      root.remove();
    },
  };
}
