/**
 * Panel „A2F" (Faza 11, 11-04): adres wrappera /predict, test /status, demo frames, statystyki.
 */
import { PanelContext, PanelDefinition, PanelHandle } from '../panel-registry';
import { el } from '../../shared/dom';
import { isValidA2fUrl } from '../../../app/store/settings-schema';

export function createA2fPanel(): PanelDefinition {
  return {
    id: 'a2f',
    title: 'A2F',
    icon: '🤖',
    visibleIn: 'studio',
    region: 'right',
    mount(ctx: PanelContext): PanelHandle {
      const { store, events, services, ui, container } = ctx;
      const root = el('div', { className: 'panel panel-a2f' });

      const urlInput = el('input', {
        className: 'text-input',
        type: 'text',
        placeholder: 'http://127.0.0.1:8000',
      }) as HTMLInputElement;
      urlInput.value = store.getEffective<string>('a2fUrl');

      const saveButton = el('button', { className: 'btn btn-small btn-primary', type: 'button', text: 'Zapisz URL' });
      saveButton.addEventListener('click', () => {
        const value = urlInput.value.trim();
        if (!isValidA2fUrl(value)) {
          ui.toast.show('Nieprawidłowy URL — dozwolone tylko http:// lub https://.', 'error');
          return;
        }
        store.setStudio('a2fUrl', value);
        ui.toast.show('Adres serwisu A2F zapisany.', 'success');
      });

      const statusLine = el('p', { className: 'drawer-subtitle', text: 'Status: —' });
      const checkButton = el('button', { className: 'btn btn-small', type: 'button', text: 'Sprawdź /status' });
      checkButton.addEventListener('click', async () => {
        const base = (urlInput.value.trim() || store.getEffective<string>('a2fUrl')).replace(/\/$/, '');
        statusLine.textContent = 'Status: sprawdzanie...';
        try {
          const response = await fetch(`${base}/status`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = (await response.json()) as { status?: string; gpu?: string; uptime_s?: number };
          statusLine.textContent = `Status: ${data.status ?? 'ok'}${data.gpu ? ` · ${data.gpu}` : ''}${
            data.uptime_s !== undefined ? ` · uptime ${Math.round(data.uptime_s)}s` : ''
          }`;
        } catch (error) {
          statusLine.textContent = `Status: brak połączenia (${(error as Error).message})`;
        }
      });

      const demoButton = el('button', { className: 'btn btn-small', type: 'button' });
      demoButton.textContent = '▶ Demo A2F (frames)';
      demoButton.addEventListener('click', () => {
        void services.animation.runA2fDemo();
      });

      const statsLine = el('p', { className: 'drawer-subtitle a2f-stats', text: 'A2F: —' });
      const unsubStats = events.on('a2f:stats', (stats) => {
        const parts: string[] = [stats.source];
        if (stats.predictMs !== undefined) parts.push(`${stats.predictMs} ms`);
        if (stats.frames !== undefined) parts.push(`${stats.frames} ramek`);
        if (stats.rtf !== undefined) parts.push(`RTF ${stats.rtf.toFixed(2)}`);
        statsLine.textContent = `A2F: ${parts.join(' · ')}`;
      });

      root.append(
        el('div', { className: 'drawer-section' }, [
          el('span', { className: 'section-title', text: 'Serwis A2F (wrapper /predict):' }),
          urlInput,
          el('div', { className: 'panel-actions' }, [saveButton, checkButton]),
          statusLine,
        ]),
        el('div', { className: 'drawer-section' }, [
          el('span', { className: 'section-title', text: 'Demo neuronowe (frames):' }),
          demoButton,
          statsLine,
        ])
      );
      container.append(root);

      return {
        destroy(): void {
          unsubStats();
          root.remove();
        },
      };
    },
  };
}
