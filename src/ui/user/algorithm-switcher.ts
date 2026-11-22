/**
 * AlgorithmSwitcher (Phase 11, 11-06): LIVE|A2F segment from the source registry + "Compare A/B"
 * + blind mode. Empty state: no utterance to compare (UI-SPEC Copywriting Contract).
 */
import { PanelContext, PanelDefinition, PanelHandle } from '../studio/panel-registry';
import { el } from '../shared/dom';
import { CompareResultEvent } from '../../app/app-types';
import { t } from '../../app/copy';

export function createAlgorithmSwitcher(): PanelDefinition {
  return {
    id: 'algorithm-switcher',
    title: t('panel.title.algorithm'),
    icon: '🔀',
    visibleIn: 'user',
    mount(ctx: PanelContext): PanelHandle {
      const { events, services, container, ui } = ctx;
      const root = el('div', { className: 'user-algo' });

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
        const short = current === 'frames' ? 'A2F' : 'LIVE';
        for (const [id, button] of segmentButtons) {
          const spec = services.animationSources.get(id);
          button.classList.toggle('active', spec?.short === short);
        }
      };
      refreshSegment();

      // --- Compare A/B
      const compareButton = el('button', { className: 'btn btn-small', type: 'button', text: t('algo.compare') });
      compareButton.addEventListener('click', () => {
        void services.compare.run({ blind: blindToggle.checked });
      });

      const blindLabel = el('span', { text: t('algo.blind') });
      const blindToggle = el('input', { type: 'checkbox' }) as HTMLInputElement;
      const blindRow = el('label', { className: 'engine-toggle' }, [blindToggle, blindLabel]);

      const statusLine = el('p', { className: 'drawer-subtitle algo-status' });

      const refreshCompare = (): void => {
        const can = services.compare.canCompare();
        (compareButton as HTMLButtonElement).disabled = !can;
        if (!can && services.compare.getState() === 'idle') {
          statusLine.textContent = t('algo.empty');
        }
      };

      const unsubSource = events.on('animation:source', () => refreshSegment());
      const unsubState = events.on('compare:state', (state) => {
        if (state === 'predicting') {
          statusLine.textContent = t('algo.predicting');
        } else if (state === 'playing-a' || state === 'playing-b') {
          statusLine.textContent = state === 'playing-a' ? t('algo.playingA') : t('algo.playingB');
        } else {
          refreshCompare();
        }
      });
      const unsubResult = events.on('compare:result', (result: CompareResultEvent) => {
        const parts: string[] = [];
        parts.push(t('algo.resultOrder', { order: result.order[0] === 'live' ? t('algo.orderLiveFirst') : t('algo.orderA2fFirst') }));
        if (result.a2f.predictMs !== undefined) parts.push(t('algo.resultPredictMs', { ms: result.a2f.predictMs }));
        if (result.a2f.frames !== undefined) parts.push(t('algo.resultFrames', { frames: result.a2f.frames }));
        statusLine.textContent = t('algo.result', { details: parts.join(' · ') });
        if (result.partial) {
          ui.toast.show(t('algo.partialWarning'), 'error');
        }
        refreshCompare();
      });
      const unsubCancelled = events.on('compare:cancelled', () => {
        statusLine.textContent = t('algo.cancelled');
        refreshCompare();
      });
      const unsubVoice = events.on('voice:state', () => {
        if (services.compare.getState() === 'idle') refreshCompare();
      });

      root.append(segment, compareButton, blindRow, statusLine);
      container.append(root);
      refreshCompare();

      return {
        destroy(): void {
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
