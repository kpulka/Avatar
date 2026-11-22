/**
 * "A2F" panel (Phase 11, 11-04): /predict wrapper URL, /status check, demo frames, statistics.
 */
import { PanelContext, PanelDefinition, PanelHandle } from '../panel-registry';
import { el } from '../../shared/dom';
import { isValidA2fUrl } from '../../../app/store/settings-schema';
import { t } from '../../../app/copy';

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
        placeholder: t('a2f.urlPlaceholder'),
      }) as HTMLInputElement;
      urlInput.value = store.getEffective<string>('a2fUrl');

      const saveButton = el('button', { className: 'btn btn-small btn-primary', type: 'button', text: t('a2f.save') });
      saveButton.addEventListener('click', () => {
        const value = urlInput.value.trim();
        if (!isValidA2fUrl(value)) {
          ui.toast.show(t('a2f.urlInvalid'), 'error');
          return;
        }
        store.setStudio('a2fUrl', value);
        ui.toast.show(t('a2f.urlSaved'), 'success');
      });

      const statusLine = el('p', { className: 'drawer-subtitle', text: t('a2f.statusIdle') });
      const checkButton = el('button', { className: 'btn btn-small', type: 'button', text: t('a2f.checkStatus') });
      checkButton.addEventListener('click', async () => {
        const base = (urlInput.value.trim() || store.getEffective<string>('a2fUrl')).replace(/\/$/, '');
        statusLine.textContent = t('a2f.statusChecking');
        try {
          const response = await fetch(`${base}/status`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = (await response.json()) as { status?: string; gpu?: string; uptime_s?: number };
          statusLine.textContent =
            t('a2f.statusOk', { status: data.status ?? 'ok' }) +
            (data.gpu ? t('a2f.statusGpu', { gpu: data.gpu }) : '') +
            (data.uptime_s !== undefined ? t('a2f.statusUptime', { uptime: Math.round(data.uptime_s) }) : '');
        } catch (error) {
          statusLine.textContent = t('a2f.statusDown', { message: (error as Error).message });
        }
      });

      const demoButton = el('button', { className: 'btn btn-small', type: 'button' });
      demoButton.textContent = t('a2f.demo');
      demoButton.addEventListener('click', () => {
        void services.animation.runA2fDemo();
      });

      const statsLine = el('p', { className: 'drawer-subtitle a2f-stats', text: t('a2f.statsIdle') });
      const unsubStats = events.on('a2f:stats', (stats) => {
        const parts: string[] = [stats.source];
        if (stats.predictMs !== undefined) parts.push(`${stats.predictMs} ms`);
        if (stats.frames !== undefined) parts.push(t('a2f.statsFrames', { frames: stats.frames }));
        if (stats.rtf !== undefined) parts.push(`RTF ${stats.rtf.toFixed(2)}`);
        statsLine.textContent = t('a2f.stats', { details: parts.join(' · ') });
      });

      root.append(
        el('div', { className: 'drawer-section' }, [
          el('span', { className: 'section-title', text: t('a2f.urlTitle') }),
          urlInput,
          el('div', { className: 'panel-actions' }, [saveButton, checkButton]),
          statusLine,
        ]),
        el('div', { className: 'drawer-section' }, [
          el('span', { className: 'section-title', text: t('a2f.demoTitle') }),
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
