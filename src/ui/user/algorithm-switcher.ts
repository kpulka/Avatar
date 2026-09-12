/**
 * AlgorithmSwitcher (Faza 11, 11-06): segment LIVE|A2F z rejestru źródeł + „Porównaj A/B"
 * + tryb blind. Empty state: brak wypowiedzi do porównania (UI-SPEC Copywriting Contract).
 */
import { PanelContext, PanelDefinition, PanelHandle } from '../studio/panel-registry';
import { el } from '../shared/dom';
import { CompareResultEvent } from '../../app/app-types';

export function createAlgorithmSwitcher(): PanelDefinition {
  return {
    id: 'algorithm-switcher',
    title: 'Algorytm',
    icon: '🔀',
    visibleIn: 'user',
    mount(ctx: PanelContext): PanelHandle {
      const { events, services, container, ui } = ctx;
      const root = el('div', { className: 'user-algo' });

      // --- Segment źródeł (z rejestru — F10 doda a2f-cloud bez zmian tutaj)
      const segment = el('div', { className: 'algo-segment', attrs: { role: 'group', 'aria-label': 'Źródło animacji' } });
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

      // --- Porównaj A/B
      const compareButton = el('button', { className: 'btn btn-small', type: 'button', text: 'Porównaj A/B' });
      compareButton.addEventListener('click', () => {
        void services.compare.run({ blind: blindToggle.checked });
      });

      const blindLabel = el('span', { text: 'Tryb blind' });
      const blindToggle = el('input', { type: 'checkbox' }) as HTMLInputElement;
      const blindRow = el('label', { className: 'engine-toggle' }, [blindToggle, blindLabel]);

      const statusLine = el('p', { className: 'drawer-subtitle algo-status' });

      const refreshCompare = (): void => {
        const can = services.compare.canCompare();
        (compareButton as HTMLButtonElement).disabled = !can;
        if (!can && services.compare.getState() === 'idle') {
          statusLine.textContent = 'Brak wypowiedzi do porównania — odbądź jedną turę rozmowy albo odtwórz demo, a potem wróć tutaj.';
        }
      };

      const unsubSource = events.on('animation:source', () => refreshSegment());
      const unsubState = events.on('compare:state', (state) => {
        if (state === 'predicting') {
          statusLine.textContent = 'A2F: przetwarzanie…';
        } else if (state === 'playing-a' || state === 'playing-b') {
          statusLine.textContent = state === 'playing-a' ? 'Odtwarzanie toru A…' : 'Odtwarzanie toru B…';
        } else {
          refreshCompare();
        }
      });
      const unsubResult = events.on('compare:result', (result: CompareResultEvent) => {
        const parts: string[] = [];
        parts.push(`kolejność: ${result.order[0] === 'live' ? 'LIVE → A2F' : 'A2F → LIVE'}`);
        if (result.a2f.predictMs !== undefined) parts.push(`predict ${result.a2f.predictMs} ms`);
        if (result.a2f.frames !== undefined) parts.push(`${result.a2f.frames} ramek`);
        statusLine.textContent = `Wynik — ${parts.join(' · ')}`;
        if (result.partial) {
          ui.toast.show('Uwaga: klip A2F jest krótszy niż wypowiedź (stan partial).', 'error');
        }
        refreshCompare();
      });
      const unsubCancelled = events.on('compare:cancelled', () => {
        statusLine.textContent = 'Porównanie przerwane przez nową turę rozmowy.';
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
