/**
 * AlgorithmSwitcher (Phase 11, 11-06; compare UX rebuilt in Phase 15-05): LIVE|A2F segment from the
 * source registry + "Compare A/B" with track chips, a cancel affordance and a blind-safe reveal.
 * Empty state: no utterance to compare (UI-SPEC Copywriting Contract).
 *
 * Everything rides on the existing `compare:state/result/cancelled` events and `CompareService`.
 */
import { PanelContext, PanelDefinition, PanelHandle } from '../studio/panel-registry';
import { el } from '../shared/dom';
import { CompareResultEvent } from '../../app/app-types';
import { t } from '../../app/copy';

/** Compare states in which a run is in flight (cancel is offered). */
const RUNNING_STATES = new Set(['ready', 'predicting', 'playing-a', 'playing-b']);

const A2F_PROBE_TIMEOUT_MS = 1500;

export function createAlgorithmSwitcher(): PanelDefinition {
  return {
    id: 'algorithm-switcher',
    title: t('panel.title.algorithm'),
    icon: '',
    visibleIn: 'user',
    mount(ctx: PanelContext): PanelHandle {
      const { events, services, container, ui, store } = ctx;
      const root = el('div', { className: 'user-algo' });
      let destroyed = false;

      // --- Source segment (from the registry — F10 adds a2f-cloud without changes here)
      const segment = el('div', { className: 'algo-segment', attrs: { role: 'group', 'aria-label': t('algo.segmentAria') } });
      const segmentButtons = new Map<string, HTMLButtonElement>();
      for (const spec of services.animationSources.list()) {
        const button = el('button', {
          className: 'segment-btn',
          type: 'button',
          text: spec.short,
          title: spec.label,
        });
        button.addEventListener('click', () => {
          spec.apply({ setSource: (mode) => services.animation.setSource(mode) });
        });
        segmentButtons.set(spec.id, button);
        segment.append(button);
      }

      const refreshSegment = (): void => {
        const current = services.animation.getSource();
        const short = current === 'frames' ? t('algo.nameA2f') : t('algo.nameLive');
        for (const [id, button] of segmentButtons) {
          const spec = services.animationSources.get(id);
          button.classList.toggle('active', spec?.short === short);
        }
      };
      refreshSegment();

      // --- A2F availability (S13): advisory probe, never blocks a compare attempt
      const a2fButtons = [...segmentButtons.entries()].filter(
        ([id]) => services.animationSources.get(id)?.short === t('algo.nameA2f')
      );
      const probeA2fAlive = async (): Promise<boolean> => {
        if (typeof fetch !== 'function') return true;
        const base = String(store.getEffective<string>('a2fUrl') ?? '').replace(/\/$/, '');
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), A2F_PROBE_TIMEOUT_MS);
        try {
          // no-cors: any reachable server resolves (opaque response), only network failure rejects.
          await fetch(`${base}/status`, { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
          return true;
        } catch {
          return false;
        } finally {
          window.clearTimeout(timer);
        }
      };
      const refreshA2fAvailability = (): void => {
        void probeA2fAlive().then((alive) => {
          if (destroyed) return;
          for (const [, button] of a2fButtons) {
            const unavailable = !alive && !button.classList.contains('active');
            button.disabled = unavailable;
            button.title = unavailable ? t('algo.a2fUnavailable') : button.title;
            button.classList.toggle('unavailable', unavailable);
          }
        });
      };
      refreshA2fAvailability();

      // --- Compare A/B
      const compareButton = el('button', { className: 'btn btn-small', type: 'button', text: t('algo.compare') });
      compareButton.addEventListener('click', () => {
        void services.compare.run({ blind: blindToggle.checked });
      });

      const blindLabel = el('span', { text: t('algo.blind') });
      const blindToggle = el('input', { type: 'checkbox' }) as HTMLInputElement;
      const blindRow = el('label', { className: 'engine-toggle' }, [blindToggle, blindLabel]);

      // Track chips: rendered per registry source (two today), labelled A / B; read-only indicators
      const chipSlots = [t('compare.trackA'), t('compare.trackB')];
      const chipSlot = (index: number): string => chipSlots[index] ?? '';
      const chips: HTMLElement[] = services.animationSources
        .list()
        .slice(0, 2)
        .map((_, index) => el('span', { className: 'compare-chip', text: chipSlot(index) }));
      const tracks = el('div', { className: 'compare-tracks hidden', attrs: { role: 'group', 'aria-label': t('compare.trackAria') } }, chips);
      const cancelButton = el('button', {
        className: 'btn btn-small btn-secondary compare-cancel hidden',
        type: 'button',
        text: t('compare.cancel'),
      });
      cancelButton.addEventListener('click', () => services.compare.cancel('user'));
      const revealButton = el('button', {
        className: 'btn btn-small btn-secondary compare-reveal hidden',
        type: 'button',
        text: t('compare.reveal'),
      });

      const statusLine = el('p', {
        className: 'drawer-subtitle algo-status',
        role: 'status',
        attrs: { 'aria-live': 'polite' },
      });

      let lastResult: CompareResultEvent | null = null;

      const sourceName = (kind: 'live' | 'a2f'): string => (kind === 'live' ? t('algo.nameLive') : t('algo.nameA2f'));

      const renderResultLine = (result: CompareResultEvent): void => {
        const parts: string[] = [];
        parts.push(t('algo.resultOrder', { order: result.order[0] === 'live' ? t('algo.orderLiveFirst') : t('algo.orderA2fFirst') }));
        if (result.a2f.predictMs !== undefined) parts.push(t('algo.resultPredictMs', { ms: result.a2f.predictMs }));
        if (result.a2f.frames !== undefined) parts.push(t('algo.resultFrames', { frames: result.a2f.frames }));
        statusLine.textContent = t('algo.result', { details: parts.join(' · ') });
      };

      const labelChips = (result: CompareResultEvent): void => {
        result.order.forEach((kind, index) => {
          const chip = chips[index];
          if (chip) chip.textContent = t('compare.chipRevealed', { track: chipSlot(index), source: sourceName(kind) });
        });
      };

      const resetChips = (): void => {
        chips.forEach((chip, index) => {
          chip.textContent = chipSlot(index);
          chip.classList.remove('active');
          chip.removeAttribute('aria-current');
        });
      };

      const highlight = (activeIndex: number | null): void => {
        chips.forEach((chip, index) => {
          const active = index === activeIndex;
          chip.classList.toggle('active', active);
          if (active) chip.setAttribute('aria-current', 'true');
          else chip.removeAttribute('aria-current');
        });
      };

      revealButton.addEventListener('click', () => {
        if (!lastResult) return;
        renderResultLine(lastResult);
        labelChips(lastResult);
        revealButton.classList.add('hidden');
      });

      const refreshCompare = (): void => {
        const can = services.compare.canCompare();
        (compareButton as HTMLButtonElement).disabled = !can;
        if (!can && services.compare.getState() === 'idle') {
          statusLine.textContent = t('algo.empty');
        }
      };

      const unsubSource = events.on('animation:source', () => refreshSegment());
      const unsubState = events.on('compare:state', (state) => {
        const running = RUNNING_STATES.has(state);
        cancelButton.classList.toggle('hidden', !running);
        tracks.classList.toggle('hidden', !running && !lastResult);
        if (state === 'ready') {
          // A new run starts: the previous result / reveal / chip labels no longer apply.
          lastResult = null;
          revealButton.classList.add('hidden');
          resetChips();
        }
        if (state === 'predicting') {
          statusLine.textContent = t('algo.predicting');
          highlight(null);
        } else if (state === 'playing-a' || state === 'playing-b') {
          statusLine.textContent = state === 'playing-a' ? t('algo.playingA') : t('algo.playingB');
          highlight(state === 'playing-a' ? 0 : 1);
        } else {
          highlight(null);
          if (state === 'error') refreshA2fAvailability();
          refreshCompare();
        }
      });
      const unsubResult = events.on('compare:result', (result: CompareResultEvent) => {
        lastResult = result;
        tracks.classList.remove('hidden');
        if (result.blind) {
          // Blind-safe: the order stays hidden until the user asks for it.
          statusLine.textContent = t('compare.blindDone');
          resetChips();
          revealButton.classList.remove('hidden');
        } else {
          renderResultLine(result);
          labelChips(result);
          revealButton.classList.add('hidden');
        }
        if (result.partial) {
          ui.toast.show(t('algo.partialWarning'), 'error');
        }
        refreshCompare();
      });
      const unsubCancelled = events.on('compare:cancelled', () => {
        statusLine.textContent = t('algo.cancelled');
        cancelButton.classList.add('hidden');
        highlight(null);
        refreshCompare();
      });
      const unsubVoice = events.on('voice:state', () => {
        if (services.compare.getState() === 'idle') refreshCompare();
      });

      const compareRow = el('div', { className: 'compare-actions' }, [compareButton, cancelButton, revealButton]);
      root.append(segment, compareRow, tracks, blindRow, statusLine);
      container.append(root);
      refreshCompare();

      return {
        destroy(): void {
          destroyed = true;
          unsubSource();
          unsubState();
          unsubResult();
          unsubCancelled();
          unsubVoice();
          root.remove();
        },
      };
    },
  };
}
