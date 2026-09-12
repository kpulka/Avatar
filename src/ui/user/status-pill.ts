/**
 * StatusPill (Faza 11, 11-06): brand + status rozmowy (zamknięty zbiór stanów, UI-SPEC).
 */
import { PanelContext, PanelDefinition, PanelHandle } from '../studio/panel-registry';
import { el } from '../shared/dom';

const LABELS: Record<string, string> = {
  idle: 'Gotowy',
  listening: 'Słucham…',
  speaking: 'Mówię…',
  thinking: 'Myślę…',
};

export function createStatusPill(): PanelDefinition {
  return {
    id: 'status-pill',
    title: 'Status',
    icon: '🟢',
    visibleIn: 'user',
    mount(ctx: PanelContext): PanelHandle {
      const { events, container } = ctx;
      const state = el('span', { className: 'status-pill voice-idle', text: LABELS.idle });
      const root = el('div', { className: 'user-status' }, [
        el('span', { className: 'pulse-dot' }),
        el('span', { className: 'brand-title', text: 'AVATAR AI' }),
        state,
      ]);
      container.append(root);

      const unsub = events.on('voice:state', (voiceState) => {
        state.textContent = LABELS[voiceState] ?? voiceState;
        state.className = `status-pill voice-${voiceState}`;
      });

      return {
        destroy(): void {
          unsub();
          root.remove();
        },
      };
    },
  };
}
