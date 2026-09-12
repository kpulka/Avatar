/**
 * Captions (Faza 11, 11-06): napisy TY/AGENT w warstwie user.
 * Długi tekst zawija się do 3 linii (CSS), pełna treść pozostaje w studiu (Sesja).
 */
import { PanelContext, PanelDefinition, PanelHandle } from '../studio/panel-registry';
import { el } from '../shared/dom';

export function createCaptions(): PanelDefinition {
  return {
    id: 'captions',
    title: 'Napisy',
    icon: '💬',
    visibleIn: 'user',
    mount(ctx: PanelContext): PanelHandle {
      const { events, container } = ctx;
      const userText = el('span', { className: 'transcript-text', text: '—' });
      const agentText = el('span', { className: 'transcript-text', text: '—' });
      const root = el('div', { className: 'cinema-captions user-captions' }, [
        el('div', { className: 'transcript-box' }, [
          el('div', { className: 'transcript-line user-line' }, [
            el('span', { className: 'speaker-tag', text: 'TY:' }),
            userText,
          ]),
          el('div', { className: 'transcript-line agent-line' }, [
            el('span', { className: 'speaker-tag', text: 'AGENT:' }),
            agentText,
          ]),
        ]),
      ]);
      container.append(root);

      const unsubUser = events.on('transcript:user', (text) => {
        userText.textContent = text;
      });
      const unsubAgent = events.on('transcript:agent', (text) => {
        agentText.textContent = text;
      });

      return {
        destroy(): void {
          unsubUser();
          unsubAgent();
          root.remove();
        },
      };
    },
  };
}
