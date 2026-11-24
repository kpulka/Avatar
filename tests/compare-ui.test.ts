// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAlgorithmSwitcher } from '../src/ui/user/algorithm-switcher';
import { CompareResultEvent } from '../src/app/app-types';
import { createUiFixture, UiFixture } from './helpers/ui-fixtures';
import { defined } from './helpers/defined';

function result(overrides: Partial<CompareResultEvent> = {}): CompareResultEvent {
  return {
    order: ['a2f', 'live'],
    blind: false,
    live: {},
    a2f: { predictMs: 120, frames: 300 },
    ...overrides,
  };
}

function mount(options: Parameters<typeof createUiFixture>[0] = {}): UiFixture {
  const fixture = createUiFixture(options);
  createAlgorithmSwitcher().mount(fixture.ctx);
  return fixture;
}

const q = <T extends HTMLElement>(fixture: UiFixture, selector: string): T =>
  fixture.host.querySelector(selector) as T;

describe('compare UI (15-05)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({})));
  });

  it('compare is disabled with the empty-state copy when there is no turn to compare', () => {
    const fixture = mount({ canCompare: false });
    expect(q<HTMLButtonElement>(fixture, '.user-algo .btn-small:not(.compare-cancel):not(.compare-reveal)').disabled).toBe(true);
    expect(q(fixture, '.algo-status').textContent).toContain('Nothing to compare');
  });

  it('clicking Compare runs the service with the blind flag', () => {
    const fixture = mount();
    (q<HTMLInputElement>(fixture, 'input[type="checkbox"]')).checked = true;
    q<HTMLButtonElement>(fixture, '.user-algo .btn-small').click();
    expect(fixture.spies.compareRun).toHaveBeenCalledWith({ blind: true });
  });

  it('playing-a highlights chip A (aria-current) and shows cancel; playing-b moves the highlight', () => {
    const fixture = mount();
    const cancel = q<HTMLButtonElement>(fixture, '.compare-cancel');
    expect(cancel.classList.contains('hidden')).toBe(true);

    fixture.events.emit('compare:state', 'playing-a');
    const chips = [...fixture.host.querySelectorAll<HTMLElement>('.compare-chip')];
    const chipA = defined(chips[0]);
    const chipB = defined(chips[1]);
    expect(chipA.getAttribute('aria-current')).toBe('true');
    expect(chipB.hasAttribute('aria-current')).toBe(false);
    expect(cancel.classList.contains('hidden')).toBe(false);

    fixture.events.emit('compare:state', 'playing-b');
    expect(chipA.hasAttribute('aria-current')).toBe(false);
    expect(chipB.getAttribute('aria-current')).toBe('true');

    cancel.click();
    expect(fixture.spies.compareCancel).toHaveBeenCalledWith('user');
  });

  it('cancel affordance disappears when the run is cancelled or done', () => {
    const fixture = mount();
    const cancel = q<HTMLButtonElement>(fixture, '.compare-cancel');
    fixture.events.emit('compare:state', 'predicting');
    expect(cancel.classList.contains('hidden')).toBe(false);
    fixture.events.emit('compare:cancelled', undefined);
    expect(cancel.classList.contains('hidden')).toBe(true);
    expect(q(fixture, '.algo-status').textContent).toContain('interrupted');
  });

  it('blind result hides the order until the reveal button is pressed', () => {
    const fixture = mount();
    fixture.events.emit('compare:state', 'ready');
    fixture.events.emit('compare:result', result({ blind: true }));
    const status = q(fixture, '.algo-status');
    expect(status.textContent).not.toContain('order');
    expect(status.textContent).not.toContain('LIVE');
    expect([...fixture.host.querySelectorAll('.compare-chip')].map((c) => c.textContent)).toEqual(['A', 'B']);
    const reveal = q<HTMLButtonElement>(fixture, '.compare-reveal');
    expect(reveal.classList.contains('hidden')).toBe(false);

    reveal.click();
    expect(status.textContent).toContain('order: A2F');
    expect([...fixture.host.querySelectorAll('.compare-chip')].map((c) => c.textContent)).toEqual(['A: A2F', 'B: LIVE']);
    expect(reveal.classList.contains('hidden')).toBe(true);
  });

  it('non-blind result shows the order immediately and no reveal button', () => {
    const fixture = mount();
    fixture.events.emit('compare:result', result({ order: ['live', 'a2f'] }));
    expect(q(fixture, '.algo-status').textContent).toContain('order: LIVE');
    expect(q(fixture, '.compare-reveal').classList.contains('hidden')).toBe(true);
  });

  it('a new run clears the previous reveal state', () => {
    const fixture = mount();
    fixture.events.emit('compare:result', result({ blind: true }));
    fixture.events.emit('compare:state', 'ready');
    expect(q(fixture, '.compare-reveal').classList.contains('hidden')).toBe(true);
  });

  it('A2F segment option is disabled with a reason tooltip when the service is unreachable, but stays usable otherwise', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('network');
    }));
    const down = mount();
    await vi.waitFor(() => {
      const a2f = [...down.host.querySelectorAll<HTMLButtonElement>('.segment-btn')].find((b) => b.textContent === 'A2F')!;
      expect(a2f.disabled).toBe(true);
      expect(a2f.title).toContain('not reachable');
    });
    const live = [...down.host.querySelectorAll<HTMLButtonElement>('.segment-btn')].find((b) => b.textContent === 'LIVE')!;
    expect(live.disabled).toBe(false);

    vi.stubGlobal('fetch', vi.fn(async () => ({})));
    const up = mount();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const a2fUp = [...up.host.querySelectorAll<HTMLButtonElement>('.segment-btn')].find((b) => b.textContent === 'A2F')!;
    expect(a2fUp.disabled).toBe(false);
  });
});
