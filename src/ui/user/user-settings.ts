/**
 * UserSettings (Phase 11, 11-06): gear in the user layer — volume, microphone (deviceId),
 * theme, scene preset. Locked keys (studio.locks) are disabled with a tooltip (UI-05).
 */
import { PanelContext, PanelDefinition, PanelHandle } from '../studio/panel-registry';
import { el } from '../shared/dom';
import { t } from '../../app/copy';

export function createUserSettings(): PanelDefinition {
  return {
    id: 'user-settings',
    title: t('panel.title.settings'),
    icon: '⚙️',
    visibleIn: 'user',
    mount(ctx: PanelContext): PanelHandle {
      const { store, services, container, ui } = ctx;

      const gear = el('button', {
        className: 'dock-icon-btn user-settings-btn',
        type: 'button',
        text: '⚙️',
        ariaLabel: t('settings.title'),
        title: t('settings.title'),
      });
      container.append(gear);

      const volumeValue = el('span', { text: `${Math.round(store.getEffective<number>('volume') * 100)}%` });
      const volumeSlider = el('input', { type: 'range', attrs: { min: '0', max: '1', step: '0.05' } }) as HTMLInputElement;
      volumeSlider.value = String(store.getEffective<number>('volume'));
      volumeSlider.addEventListener('input', () => {
        const value = parseFloat(volumeSlider.value);
        volumeValue.textContent = `${Math.round(value * 100)}%`;
        store.setUser('volume', value);
      });
      applyLock(volumeSlider, 'volume');

      const micSelect = el('select', { className: 'engine-select' }) as HTMLSelectElement;
      micSelect.append(el('option', { value: '', text: t('settings.defaultDevice') }));
      const refreshDevices = async (): Promise<void> => {
        const devices = await services.conversation.listInputDevices();
        const current = store.getEffective<string | null>('micDeviceId') ?? '';
        micSelect.replaceChildren(el('option', { value: '', text: t('settings.defaultDevice') }));
        for (const device of devices) {
          micSelect.append(el('option', { value: device.id, text: device.label }));
        }
        micSelect.value = current;
      };
      micSelect.addEventListener('change', () => {
        store.setUser('micDeviceId', micSelect.value || null);
        services.conversation.setInputDevice(micSelect.value || null);
      });
      void refreshDevices();
      applyLock(micSelect, 'micDeviceId');

      const themeSelect = el('select', { className: 'engine-select' }) as HTMLSelectElement;
      themeSelect.append(
        el('option', { value: 'dark', text: t('settings.themeDark') }),
        el('option', { value: 'light', text: t('settings.themeLight') })
      );
      themeSelect.value = store.getEffective<'dark' | 'light'>('theme');
      themeSelect.addEventListener('change', () => {
        store.setUser('theme', themeSelect.value === 'light' ? 'light' : 'dark');
      });
      applyLock(themeSelect, 'theme');

      const presetSelect = el('select', { className: 'engine-select' }) as HTMLSelectElement;
      const availablePresets = services.scenePresets.list();
      if (availablePresets.length >= 2) {
        for (const preset of availablePresets) {
          presetSelect.append(el('option', { value: preset.id, text: preset.label }));
        }
        presetSelect.value = services.scenePresets.getCurrentId();
        presetSelect.addEventListener('change', () => {
          store.setUser('scenePreset', presetSelect.value);
          store.setUser('scenePresetManual', true);
          services.scenePresets.apply(presetSelect.value);
        });
      } else {
        presetSelect.disabled = true;
      }
      applyLock(presetSelect, 'scenePreset');

      function applyLock(control: HTMLInputElement | HTMLSelectElement, key: string): void {
        if (store.isLocked(key)) {
          control.disabled = true;
          control.title = t('settings.lockTooltip', { key });
        }
      }

      function buildForm(): HTMLElement {
        return el('div', { className: 'user-settings-form' }, [
          el('div', { className: 'form-group' }, [
            el('label', {}, [el('span', { text: t('settings.volumeLabel') }), volumeValue]),
            volumeSlider,
          ]),
          el('div', { className: 'form-group' }, [
            el('label', { text: t('settings.micLabel') }),
            micSelect,
          ]),
          el('div', { className: 'form-group' }, [
            el('label', { text: t('settings.themeLabel') }),
            themeSelect,
          ]),
          el('div', { className: 'form-group' }, [
            el('label', { text: t('settings.presetLabel') }),
            presetSelect,
          ]),
        ]);
      }

      gear.addEventListener('click', () => {
        void refreshDevices().then(() => {
          ui.modal.open(t('settings.title'), buildForm());
        });
      });

      return {
        destroy(): void {
          gear.remove();
        },
      };
    },
  };
}
