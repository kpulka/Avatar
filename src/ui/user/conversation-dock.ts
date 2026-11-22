/**
 * ConversationDock (Phase 11, 11-06): conversation dock of the user layer.
 * Copy 1:1 from the Copywriting Contract (UI-SPEC).
 */
import { PanelContext, PanelDefinition, PanelHandle } from '../studio/panel-registry';
import { el } from '../shared/dom';
import { t } from '../../app/copy';

export function createConversationDock(): PanelDefinition {
  return {
    id: 'conversation-dock',
    title: t('panel.title.dock'),
    icon: '🎙️',
    visibleIn: 'user',
    mount(ctx: PanelContext): PanelHandle {
      const { events, services, container } = ctx;
      const root = el('div', { className: 'user-dock' });

      const primary = el('button', { className: 'dock-btn btn-call', type: 'button', ariaLabel: t('dock.start') }, [
        el('span', { className: 'btn-icon', text: '🎙️' }),
        el('span', { className: 'btn-label', text: t('dock.start') }),
      ]);
      primary.addEventListener('click', () => {
        void services.conversation.toggle();
      });

      const mute = el('button', { className: 'dock-btn btn-subtle', type: 'button', ariaLabel: t('dock.muteAria') }, [
        el('span', { className: 'btn-icon', text: '🎤' }),
        el('span', { className: 'btn-label', text: t('dock.mute') }),
      ]);
      mute.addEventListener('click', () => services.conversation.toggleMute());

      const interrupt = el('button', {
        className: 'dock-btn btn-danger-subtle',
        type: 'button',
        ariaLabel: t('dock.interruptAria'),
      }, [
        el('span', { className: 'btn-icon', text: '🛑' }),
        el('span', { className: 'btn-label', text: t('dock.interrupt') }),
      ]);
      interrupt.addEventListener('click', () => services.conversation.interrupt());

      root.append(primary, mute, interrupt);
      container.append(root);

      const unsubState = events.on('voice:state', (state) => {
        const running = state !== 'idle';
        primary.className = `dock-btn btn-call${running ? ' active' : ''}`;
        primary.setAttribute('aria-label', running ? t('dock.end') : t('dock.start'));
        primary.querySelector('.btn-label')!.textContent = running ? t('dock.end') : t('dock.start');
      });

      const unsubMuted = events.on('voice:muted', (muted) => {
        mute.setAttribute('aria-label', muted ? t('dock.unmuteAria') : t('dock.muteAria'));
        mute.querySelector('.btn-label')!.textContent = muted ? t('dock.unmute') : t('dock.mute');
      });

      return {
        destroy(): void {
          unsubState();
          unsubMuted();
          root.remove();
        },
      };
    },
  };
}
