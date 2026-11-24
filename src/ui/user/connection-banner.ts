/**
 * ConnectionBanner (Phase 15-05, UIX-05): inline recovery surface for `voice:error`.
 *
 * Shown when a conversation cannot start or the connection drops (including the dedicated
 * microphone-denied / microphone-missing guidance, which arrives as the message). Offers
 * "Try again" and hides itself as soon as a session is live again. The error toast stays as a
 * redundant channel (15-05).
 */
import { PanelContext, PanelDefinition, PanelHandle } from '../studio/panel-registry';
import { el } from '../shared/dom';
import { t } from '../../app/copy';

export function createConnectionBanner(): PanelDefinition {
  return {
    id: 'connection-banner',
    title: t('errors.connection.title'),
    icon: '',
    visibleIn: 'user',
    mount(ctx: PanelContext): PanelHandle {
      const { events, services, container } = ctx;
      const message = el('p', { className: 'conn-error-body' });
      const retry = el('button', { className: 'btn btn-small btn-primary', type: 'button', text: t('panel.retry') });
      const root = el('div', { className: 'conn-error hidden', role: 'alert' }, [
        el('div', { className: 'conn-error-text' }, [
          el('strong', { className: 'conn-error-title', text: t('errors.connection.title') }),
          message,
        ]),
        retry,
      ]);
      container.append(root);

      const hide = (): void => root.classList.add('hidden');

      retry.addEventListener('click', () => {
        hide();
        void services.conversation.start().catch(() => undefined);
      });

      const unsubError = events.on('voice:error', (text) => {
        message.textContent = text;
        root.classList.remove('hidden');
      });
      const unsubState = events.on('voice:state', (state) => {
        if (state !== 'idle') hide();
      });

      return {
        destroy(): void {
          unsubError();
          unsubState();
          root.remove();
        },
      };
    },
  };
}
