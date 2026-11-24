/**
 * StudioShell (Phase 11, 11-03): right drawer with tabs from the panel registry + left drawers
 * for panels with `region: 'left'` (Visemes, Inspector). Lazy mount of active panels,
 * per-panel error boundary via PanelRegistry.
 */
import { PanelContext, PanelRegistry } from './panel-registry';
import { el, uid } from '../shared/dom';
import { icon } from '../shared/icons';
import { t } from '../../app/copy';

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

  // ---- right drawer with tabs
  const closeButton = el('button', {
    className: 'btn-drawer-close',
    type: 'button',
    ariaLabel: t('studio.closeAria'),
  }, [icon('close')]);
  const drawer = el('aside', { className: 'side-drawer right-drawer hidden' });
  const tablist = el('div', { className: 'studio-tabs', attrs: { role: 'tablist', 'aria-label': t('studio.tabsAria') } });
  // One shared tabpanel: WAI-ARIA Tabs allow a single panel element whose labelling follows the active tab.
  const body = el('div', { id: uid('studio-tabpanel'), className: 'drawer-body studio-tab-body', role: 'tabpanel' });
  const header = el('div', { className: 'drawer-header' }, [
    el('div', { className: 'drawer-title-group' }, [
      el('span', { className: 'drawer-header-icon', text: '🛠️' }),
      el('div', {}, [
        el('h3', { text: t('studio.title') }),
        el('p', { className: 'drawer-subtitle', text: t('studio.subtitle') }),
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
      // Roving tabindex: only the active tab sits in the Tab order.
      button.tabIndex = key === id ? 0 : -1;
    }
    const activeButton = tabButtons.get(id);
    if (activeButton) body.setAttribute('aria-labelledby', activeButton.id);
  };

  for (const panel of rightPanels) {
    const button = el('button', {
      id: uid(`tab-${panel.id}`),
      className: 'studio-tab',
      type: 'button',
      attrs: { role: 'tab', 'aria-selected': 'false', 'aria-controls': body.id, 'data-panel': panel.id, tabindex: '-1' },
    }, [
      el('span', { className: 'btn-icon', text: panel.icon }),
      el('span', { className: 'btn-label', text: panel.title }),
    ]);
    button.addEventListener('click', () => openTab(panel.id));
    tabButtons.set(panel.id, button);
    tablist.append(button);
  }
  // Before the first selection the first tab must be reachable by keyboard.
  const firstPanel = rightPanels[0];
  const firstTab = firstPanel ? tabButtons.get(firstPanel.id) : undefined;
  if (firstTab) firstTab.tabIndex = 0;

  // WAI-ARIA Tabs keyboard model: arrows move + select (selection follows focus), Home/End jump.
  tablist.addEventListener('keydown', (event) => {
    const ids = rightPanels.map((panel) => panel.id);
    const currentIndex = ids.findIndex((panelId) => tabButtons.get(panelId) === document.activeElement);
    if (currentIndex === -1) return;
    let nextIndex: number;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % ids.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + ids.length) % ids.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = ids.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const nextId = ids[nextIndex];
    if (nextId === undefined) return;
    openTab(nextId);
    tabButtons.get(nextId)?.focus();
  });

  // ---- left drawers (Visemes, Inspector)
  const root = el('div', { className: 'studio-shell hidden' });
  const leftColumn = el('div', { className: 'studio-left-toggles' });
  const leftDrawers = new Map<string, { drawer: HTMLElement; mounted: boolean }>();

  for (const panel of leftPanels) {
    const drawerEl = el('aside', { className: 'side-drawer left-drawer hidden' });
    const panelBody = el('div', { className: 'drawer-body' });
    const panelClose = el('button', {
      className: 'btn-drawer-close',
      type: 'button',
      ariaLabel: t('studio.leftCloseAria', { panel: panel.title }),
    }, [icon('close')]);
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
      ariaLabel: t('studio.leftOpenAria', { panel: panel.title }),
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
      const firstPanel = rightPanels[0];
      if (!activeId && firstPanel) {
        openTab(firstPanel.id);
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
