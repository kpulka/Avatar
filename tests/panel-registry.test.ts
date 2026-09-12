import { describe, expect, it, vi } from 'vitest';
import {
  PanelContext,
  PanelDefinition,
  PanelRegistry,
} from '../src/ui/studio/panel-registry';

function fakeContext(container: unknown): PanelContext {
  const noopHandle = () => ({ show: vi.fn(), hide: vi.fn(), destroy: vi.fn() });
  return {
    store: {} as PanelContext['store'],
    events: { on: () => () => undefined, emit: vi.fn() } as unknown as PanelContext['events'],
    services: {} as PanelContext['services'],
    ui: {
      toast: noopHandle() as unknown as PanelContext['ui']['toast'],
      loader: noopHandle() as unknown as PanelContext['ui']['loader'],
      modal: { open: vi.fn(), close: vi.fn(), isOpen: vi.fn(), destroy: vi.fn() } as unknown as PanelContext['ui']['modal'],
    },
    container: container as HTMLElement,
  };
}

function makeDefinition(
  id: string,
  visibleIn: 'user' | 'studio',
  mountImpl: (ctx: PanelContext) => PanelHandle
): PanelDefinition {
  return {
    id,
    title: `Panel ${id}`,
    icon: '🧩',
    visibleIn,
    mount: mountImpl,
  };
}

describe('PanelRegistry', () => {
  it('list(mode) zwraca wyłącznie panele danej warstwy', () => {
    const registry = new PanelRegistry();
    registry.register(makeDefinition('a', 'user', () => ({ destroy: vi.fn() })));
    registry.register(makeDefinition('b', 'studio', () => ({ destroy: vi.fn() })));
    registry.register(makeDefinition('c', 'studio', () => ({ destroy: vi.fn() })));

    expect(registry.list('user').map((panel) => panel.id)).toEqual(['a']);
    expect(registry.list('studio').map((panel) => panel.id)).toEqual(['b', 'c']);
  });

  it('mount jest idempotentny — poprzedni handle dostaje destroy()', () => {
    const registry = new PanelRegistry();
    const firstDestroy = vi.fn();
    const secondDestroy = vi.fn();
    const mount = vi
      .fn()
      .mockReturnValueOnce({ destroy: firstDestroy })
      .mockReturnValueOnce({ destroy: secondDestroy });
    registry.register(makeDefinition('a', 'studio', mount));

    const ctx = fakeContext({});
    registry.mount('a', ctx);
    expect(registry.isMounted('a')).toBe(true);

    registry.mount('a', ctx);
    expect(firstDestroy).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledTimes(2);
    expect(registry.isMounted('a')).toBe(true);
  });

  it('błąd montowania trafia do error boundary z akcją ponowienia', () => {
    const renderError = vi.fn();
    let attempt = 0;
    const registryWithError = new PanelRegistry({ renderError });
    registryWithError.register(
      makeDefinition('broken', 'studio', () => {
        attempt += 1;
        if (attempt === 1) throw new Error('boom');
        return { destroy: vi.fn() };
      })
    );

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const ctx = fakeContext({});
    const handle = registryWithError.mount('broken', ctx);
    warn.mockRestore();

    expect(handle).toBeNull();
    expect(renderError).toHaveBeenCalledTimes(1);
    const [, definition, retry] = renderError.mock.calls[0] as [HTMLElement, PanelDefinition, () => void];
    expect(definition.id).toBe('broken');
    expect(registryWithError.isMounted('broken')).toBe(false);

    retry();
    expect(registryWithError.isMounted('broken')).toBe(true);
  });

  it('destroyAll niszczy wszystkie zamontowane panele', () => {
    const registry = new PanelRegistry();
    const destroyA = vi.fn();
    const destroyB = vi.fn();
    registry.register(makeDefinition('a', 'studio', () => ({ destroy: destroyA })));
    registry.register(makeDefinition('b', 'studio', () => ({ destroy: destroyB })));

    const ctx = fakeContext({});
    registry.mount('a', ctx);
    registry.mount('b', ctx);
    registry.destroyAll();

    expect(destroyA).toHaveBeenCalledTimes(1);
    expect(destroyB).toHaveBeenCalledTimes(1);
    expect(registry.isMounted('a')).toBe(false);
    expect(registry.isMounted('b')).toBe(false);
  });

  it('nieznany panel jest bezpiecznie pomijany', () => {
    const registry = new PanelRegistry();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(registry.mount('nope', fakeContext({}))).toBeNull();
    warn.mockRestore();
  });
});
