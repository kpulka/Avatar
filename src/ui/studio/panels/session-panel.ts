/**
 * "Session" panel (Phase 11, 11-04): agent, volume, telemetry, settings locks,
 * profile export/import, PoC stress. Microphone device selection lives in user settings (11-06).
 */
import { PanelContext, PanelDefinition, PanelHandle } from '../panel-registry';
import { el, uid } from '../../shared/dom';
import { t } from '../../../app/copy';

const LOCK_KEYS = ['volume', 'theme', 'scenePreset', 'animationSource', 'uiMode'];

export function createSessionPanel(): PanelDefinition {
  return {
    id: 'session',
    title: t('panel.title.session'),
    icon: '📊',
    visibleIn: 'studio',
    region: 'right',
    mount(ctx: PanelContext): PanelHandle {
      const { store, services, ui, container } = ctx;
      const root = el('div', { className: 'panel panel-session' });

      // --- Agent
      const agentInput = el('input', {
        id: uid('agent'),
        className: 'text-input',
        type: 'text',
        placeholder: t('session.agentPlaceholder'),
      });
      agentInput.value = store.getEffective<string>('agentId');
      const agentSave = el('button', { className: 'btn btn-small btn-primary', type: 'button', text: t('session.agentSave') });
      agentSave.addEventListener('click', () => {
        const value = agentInput.value.trim();
        if (!value) {
          ui.toast.show(t('session.agentEmptyError'), 'error');
          return;
        }
        store.setStudio('agentId', value);
        ui.toast.show(t('session.agentSaved'), 'success');
      });

      // --- Volume + microphone
      const volumeValue = el('span', { text: `${Math.round(store.getEffective<number>('volume') * 100)}%` });
      const volumeSlider = el('input', {
        id: uid('session-volume'),
        type: 'range',
        attrs: { min: '0', max: '1', step: '0.05' },
      });
      volumeSlider.value = String(store.getEffective<number>('volume'));
      volumeSlider.addEventListener('input', () => {
        const value = parseFloat(volumeSlider.value);
        volumeValue.textContent = `${Math.round(value * 100)}%`;
        store.setUser('volume', value);
      });

      // --- Telemetry
      const telemetryFields = {
        fps: el('strong', { text: '--' }),
        ttfb: el('strong', { text: t('session.ttfbIdle') }),
        bargeIn: el('strong', { text: '0' }),
        session: el('strong', { text: '00:00' }),
        align: el('strong', { text: t('session.alignIdle') }),
      };
      const telemetryGrid = el('div', { className: 'telemetry-grid' }, [
        el('span', {}, [el('span', { text: t('session.fpsLabel') }), telemetryFields.fps]),
        el('span', {}, [el('span', { text: t('session.ttfbLabel') }), telemetryFields.ttfb]),
        el('span', {}, [el('span', { text: t('session.bargeInLabel') }), telemetryFields.bargeIn]),
        el('span', {}, [el('span', { text: t('session.sessionLabel') }), telemetryFields.session]),
        el('span', {}, [telemetryFields.align]),
      ]);
      const telemetryTimer = window.setInterval(() => {
        const sample = services.telemetry.sample();
        telemetryFields.fps.textContent = String(sample.fps);
        telemetryFields.ttfb.textContent = sample.ttfbMs !== null ? t('session.ttfbValue', { ms: sample.ttfbMs }) : t('session.ttfbIdle');
        telemetryFields.bargeIn.textContent = String(sample.bargeInCount);
        telemetryFields.session.textContent = sample.session;
        telemetryFields.align.textContent =
          sample.align.fallback === 0
            ? t('session.alignEl', { count: sample.align.elevenlabs })
            : t('session.alignFallback', { el: sample.align.elevenlabs, fb: sample.align.fallback });
      }, 1000);

      // --- Settings locks for the user
      const locksSection = el('div', { className: 'locks-list' });
      for (const key of LOCK_KEYS) {
        const checkbox = el('input', { type: 'checkbox' });
        checkbox.checked = store.isLocked(key);
        checkbox.addEventListener('change', () => store.setLock(key, checkbox.checked));
        locksSection.append(
          el('label', { className: 'engine-toggle' }, [
            checkbox,
            el('span', { text: t('session.lockLabel', { key }) }),
          ])
        );
      }

      // --- Profile: export/import
      const exportButton = el('button', { className: 'btn btn-small btn-secondary', type: 'button', text: t('session.exportProfile') });
      exportButton.addEventListener('click', () => {
        const json = store.exportProfile();
        try {
          const blob = new Blob([json], { type: 'application/json' });
          const link = el('a', { attrs: { download: 'avatar-profile.json' } });
          link.href = URL.createObjectURL(blob);
          link.click();
          URL.revokeObjectURL(link.href);
          ui.toast.show(t('session.exported'), 'success');
        } catch (error) {
          ui.toast.show(t('session.exportFailed', { message: (error as Error).message }), 'error');
        }
      });

      const importInput = el('input', { type: 'file', attrs: { accept: '.json,application/json' } });
      // Keyboard users go through the visible button; the native input stays out of the tab order / a11y tree.
      importInput.classList.add('hidden');
      importInput.tabIndex = -1;
      importInput.setAttribute('aria-hidden', 'true');
      // eslint-disable-next-line @typescript-eslint/no-misused-promises -- async DOM event handler: the browser ignores the returned promise
      importInput.addEventListener('change', async () => {
        const file = importInput.files?.[0];
        importInput.value = '';
        if (!file) return;
        try {
          const text = await file.text();
          const result = store.importProfile(text);
          if (result.ok) {
            ui.toast.show(t('session.imported'), 'success');
          } else {
            ui.toast.show(result.error ?? t('session.importRejected'), 'error');
          }
        } catch (error) {
          ui.toast.show(t('session.importFailed', { message: (error as Error).message }), 'error');
        }
      });
      const importButton = el('button', { className: 'btn btn-small btn-secondary', type: 'button', text: t('session.importProfile') });
      importButton.addEventListener('click', () => importInput.click());

      const stressButton = el('button', { className: 'btn btn-small', type: 'button', text: t('session.stress') });
      stressButton.addEventListener('click', () => {
        void services.conversation.runPocStress();
      });

      root.append(
        el('div', { className: 'drawer-section' }, [
          el('label', { className: 'section-title', text: t('session.agentTitle'), attrs: { for: agentInput.id } }),
          agentInput,
          agentSave,
        ]),
        el('div', { className: 'drawer-section' }, [
          el('span', { className: 'section-title', text: t('session.audioTitle') }),
          el('label', { attrs: { for: volumeSlider.id } }, [el('span', { text: t('settings.volumeLabel') }), volumeValue]),
          volumeSlider,
          el('p', { className: 'drawer-subtitle', text: t('session.micInUserSettings') }),
        ]),
        el('div', { className: 'drawer-section' }, [
          el('span', { className: 'section-title', text: t('session.telemetryTitle') }),
          telemetryGrid,
          stressButton,
        ]),
        el('div', { className: 'drawer-section' }, [
          el('span', { className: 'section-title', text: t('session.locksTitle') }),
          locksSection,
        ]),
        el('div', { className: 'drawer-section' }, [
          el('span', { className: 'section-title', text: t('session.profileTitle') }),
          el('div', { className: 'panel-actions' }, [exportButton, importButton]),
          importInput,
        ])
      );
      container.append(root);

      return {
        destroy(): void {
          window.clearInterval(telemetryTimer);
          root.remove();
        },
      };
    },
  };
}
