/**
 * ConversationDock (Faza 11, 11-06): dock rozmowy warstwy user.
 * Copy 1:1 z Copywriting Contract (UI-SPEC).
 */
import { PanelContext, PanelDefinition, PanelHandle } from '../studio/panel-registry';
import { el } from '../shared/dom';

export function createConversationDock(): PanelDefinition {
  return {
    id: 'conversation-dock',
    title: 'Dock rozmowy',
    icon: '🎙️',
    visibleIn: 'user',
    mount(ctx: PanelContext): PanelHandle {
      const { events, services, container } = ctx;
      const root = el('div', { className: 'user-dock' });

      const primary = el('button', { className: 'dock-btn btn-call', type: 'button', ariaLabel: 'Rozpocznij rozmowę' }, [
        el('span', { className: 'btn-icon', text: '🎙️' }),
        el('span', { className: 'btn-label', text: 'Rozpocznij rozmowę' }),
      ]);
      primary.addEventListener('click', () => {
        void services.conversation.toggle();
      });

      const mute = el('button', { className: 'dock-btn btn-subtle', type: 'button', ariaLabel: 'Wycisz mikrofon' }, [
        el('span', { className: 'btn-icon', text: '🎤' }),
        el('span', { className: 'btn-label', text: 'Wycisz' }),
      ]);
      mute.addEventListener('click', () => services.conversation.toggleMute());

      const interrupt = el('button', {
        className: 'dock-btn btn-danger-subtle',
        type: 'button',
        ariaLabel: 'Przerwij wypowiedź agenta',
      }, [
        el('span', { className: 'btn-icon', text: '🛑' }),
        el('span', { className: 'btn-label', text: 'Przerwij' }),
      ]);
      interrupt.addEventListener('click', () => services.conversation.interrupt());

      root.append(primary, mute, interrupt);
      container.append(root);

      const unsubState = events.on('voice:state', (state) => {
        const running = state !== 'idle';
        primary.className = `dock-btn btn-call${running ? ' active' : ''}`;
        primary.setAttribute('aria-label', running ? 'Zakończ rozmowę' : 'Rozpocznij rozmowę');
        primary.querySelector('.btn-label')!.textContent = running ? 'Zakończ rozmowę' : 'Rozpocznij rozmowę';
      });

      const unsubMuted = events.on('voice:muted', (muted) => {
        mute.setAttribute('aria-label', muted ? 'Włącz mikrofon' : 'Wycisz mikrofon');
        mute.querySelector('.btn-label')!.textContent = muted ? 'Włącz' : 'Wycisz';
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
