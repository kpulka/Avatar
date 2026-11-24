/**
 * Captions (Phase 11, 11-06): YOU/AGENT captions in the user layer.
 * Long text wraps to 3 lines (CSS); the full content stays in the studio (Session).
 */
import { PanelContext, PanelDefinition, PanelHandle } from '../studio/panel-registry';
import { el } from '../shared/dom';
import { t } from '../../app/copy';

export function createCaptions(): PanelDefinition {
  return {
    id: 'captions',
    title: t('panel.title.captions'),
    icon: '',
    visibleIn: 'user',
    mount(ctx: PanelContext): PanelHandle {
      const { events, container } = ctx;
      const userText = el('span', { className: 'transcript-text', text: t('captions.empty') });
      const agentText = el('span', { className: 'transcript-text', text: t('captions.empty') });
      const root = el(
        'div',
        {
          className: 'cinema-captions user-captions',
          role: 'log',
          ariaLabel: t('captions.regionAria'),
          attrs: { 'aria-live': 'polite' },
        },
        [
          el('div', { className: 'transcript-box' }, [
            el('div', { className: 'transcript-line user-line' }, [
              el('span', { className: 'speaker-tag', text: t('captions.you') }),
              userText,
            ]),
            el('div', { className: 'transcript-line agent-line' }, [
              el('span', { className: 'speaker-tag', text: t('captions.agent') }),
              agentText,
            ]),
          ]),
        ]
      );
      container.append(root);

      const unsubUser = events.on('transcript:user', (text) => {
        userText.textContent = text;
      });
      // S4: a barge-in is acknowledged by a short flash on the agent line (CSS, reduced-motion aware).
      const agentLine = root.querySelector('.agent-line') as HTMLElement;
      const unsubInterrupt = events.on('speech:interruption', () => {
        agentLine.classList.remove('caption-flash');
        void agentLine.offsetWidth; // restart the animation on back-to-back interruptions
        agentLine.classList.add('caption-flash');
      });
      const unsubAgent = events.on('transcript:agent', (text) => {
        agentText.textContent = text;
      });

      return {
        destroy(): void {
          unsubUser();
          unsubAgent();
          unsubInterrupt();
          root.remove();
        },
      };
    },
  };
}
