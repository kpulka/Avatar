/**
 * StatusPill (Phase 11, 11-06): brand + conversation status (closed set of states, UI-SPEC).
 */
import { PanelContext, PanelDefinition, PanelHandle } from '../studio/panel-registry';
import { el } from '../shared/dom';
import { t } from '../../app/copy';
import { INITIAL_DEGRADATION, nextDegradationState, DegradationState } from './lipsync-degradation';

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
      // Degradation chip (17-06): visible while the lip-sync runs on the acoustic fallback (no real alignment).
      // Studio keeps its detailed ALIGN badge; this is the subtle user-mode signal.
      const degraded = el('span', {
        className: 'status-pill lipsync-chip',
        text: t('chip.simplifiedLipsync'),
        role: 'status',
        hidden: true,
      });
      const root = el('div', { className: 'user-status' }, [
        el('span', { className: 'pulse-dot', attrs: { 'aria-hidden': 'true' } }),
        el('span', { className: 'brand-title', text: t('brand.title') }),
        state,
        degraded,
      ]);
      container.append(root);

      const unsub = events.on('voice:state', (voiceState) => {
        state.textContent = LABELS[voiceState] ?? voiceState;
        state.className = `status-pill voice-${voiceState}`;
        // A finished session must not leave a stale chip behind.
        if (voiceState === 'idle') {
          degradation = INITIAL_DEGRADATION;
          degraded.hidden = true;
        }
      });

      let degradation: DegradationState = INITIAL_DEGRADATION;
      const unsubChunk = events.on('audio:chunk', (chunk) => {
        degradation = nextDegradationState(degradation, chunk.alignment.source);
        degraded.hidden = !degradation.visible;
      });

      return {
        destroy(): void {
          unsub();
          unsubChunk();
          root.remove();
        },
      };
    },
  };
}
