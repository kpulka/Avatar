/**
 * StatusPill (Phase 11, 11-06): brand + conversation status (closed set of states, UI-SPEC).
 */
import { PanelContext, PanelDefinition, PanelHandle } from '../studio/panel-registry';
import { el } from '../shared/dom';
import { t } from '../../app/copy';

const LABELS: Record<string, string> = {
  idle: t('status.idle'),
  listening: t('status.listening'),
  speaking: t('status.speaking'),
  thinking: t('status.thinking'),
};

export function createStatusPill(): PanelDefinition {
  return {
    id: 'status-pill',
    title: t('panel.title.status'),
    icon: '',
    visibleIn: 'user',
    mount(ctx: PanelContext): PanelHandle {
      const { events, container } = ctx;
      // role=status makes the label flips (Listening / Speaking / ...) audible to screen readers.
      const state = el('span', { className: 'status-pill voice-idle', text: LABELS.idle, role: 'status' });
      const root = el('div', { className: 'user-status' }, [
        el('span', { className: 'pulse-dot', attrs: { 'aria-hidden': 'true' } }),
        el('span', { className: 'brand-title', text: t('brand.title') }),
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
