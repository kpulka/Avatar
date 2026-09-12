/**
 * PanelRegistry (Faza 11, 11-03, Pattern 4).
 *
 * Kontrakt: panel deklaruje, w której warstwie żyje (`visibleIn`) i jak się montuje
 * (`mount(ctx) → PanelHandle`). Przeniesienie funkcji między personami = zmiana `visibleIn`.
 * Mount jest idempotentny (poprzedni handle dostaje `destroy()`), a błąd montowania jednego
 * panelu nie wywala całości (per-panel error boundary).
 */
import { SettingsStore } from '../../app/store/settings-store';
import { TypedEventBus } from '../../app/events';
import { AppEvents, AppServices } from '../../app/app-types';
import { el } from '../shared/dom';
import { ToastHandle } from '../shared/toast';
import { LoaderHandle } from '../shared/loader';
import { ModalHandle } from '../shared/modal';

export type PanelLayer = 'user' | 'studio';

/** Porty UI współdzielone przez panele (toast/loader/modal). */
export interface PanelUi {
  toast: ToastHandle;
  loader: LoaderHandle;
  modal: ModalHandle;
}

export interface PanelContext {
  store: SettingsStore;
  events: TypedEventBus<AppEvents>;
  services: AppServices;
  ui: PanelUi;
  container: HTMLElement;
}

export interface PanelHandle {
  destroy(): void;
}

export interface PanelDefinition {
  id: string;
  title: string;
  icon: string;
  visibleIn: PanelLayer;
  /** Region w warstwie studio: prawy drawer z tabami ('right') albo lewy drawer ('left'). */
  region?: 'right' | 'left';
  lazy?: boolean;
  mount(ctx: PanelContext): PanelHandle;
}

export interface PanelRegistryOptions {
  /** Port renderowania błędu panelu (wstrzykiwany w testach). */
  renderError?: (container: HTMLElement, definition: PanelDefinition, retry: () => void) => void;
}

export function renderPanelError(
  container: HTMLElement,
  definition: PanelDefinition,
  retry: () => void
): void {
  const button = el('button', {
    className: 'btn btn-tiny btn-secondary',
    text: 'Spróbuj ponownie',
    type: 'button',
  });
  button.addEventListener('click', () => retry());
  container.replaceChildren(
    el('div', { className: 'panel-error' }, [
      el('p', { text: `Panel „${definition.title}” nie mógł się załadować.` }),
      button,
    ])
  );
}

export class PanelRegistry {
  private readonly definitions = new Map<string, PanelDefinition>();
  private readonly handles = new Map<string, PanelHandle>();
  private readonly renderError: NonNullable<PanelRegistryOptions['renderError']>;

  constructor(options: PanelRegistryOptions = {}) {
    this.renderError = options.renderError ?? renderPanelError;
  }

  public register(definition: PanelDefinition): void {
    if (this.definitions.has(definition.id)) {
      console.warn(`[PanelRegistry] Panel '${definition.id}' już zarejestrowany — nadpisuję definicję.`);
      this.destroy(definition.id);
    }
    this.definitions.set(definition.id, definition);
  }

  public get(id: string): PanelDefinition | undefined {
    return this.definitions.get(id);
  }

  public list(layer: PanelLayer): PanelDefinition[] {
    return [...this.definitions.values()].filter((definition) => definition.visibleIn === layer);
  }

  public isMounted(id: string): boolean {
    return this.handles.has(id);
  }

  public mount(id: string, ctx: PanelContext): PanelHandle | null {
    const definition = this.definitions.get(id);
    if (!definition) {
      console.warn(`[PanelRegistry] Nieznany panel '${id}' — mount pominięty.`);
      return null;
    }
    this.destroy(id);
    try {
      const handle = definition.mount(ctx);
      this.handles.set(id, handle);
      return handle;
    } catch (error) {
      console.warn(`[PanelRegistry] Błąd montowania panelu '${id}':`, error);
      this.renderError(ctx.container, definition, () => {
        this.mount(id, ctx);
      });
      return null;
    }
  }

  public destroy(id: string): void {
    const handle = this.handles.get(id);
    if (!handle) return;
    this.handles.delete(id);
    try {
      handle.destroy();
    } catch (error) {
      console.warn(`[PanelRegistry] Błąd niszczenia panelu '${id}':`, error);
    }
  }

  public destroyAll(): void {
    for (const id of [...this.handles.keys()]) {
      this.destroy(id);
    }
  }
}
