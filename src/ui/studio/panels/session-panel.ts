/**
 * Panel „Sesja" (Faza 11, 11-04): agent, głośność, telemetria, locki ustawień,
 * export/import profilu, PoC stress. Mikrofon (wybór urządzenia) dochodzi w 11-06.
 */
import { PanelContext, PanelDefinition, PanelHandle } from '../panel-registry';
import { el } from '../../shared/dom';

const LOCK_KEYS = ['volume', 'theme', 'scenePreset', 'animationSource', 'uiMode'];

export function createSessionPanel(): PanelDefinition {
  return {
    id: 'session',
    title: 'Sesja',
    icon: '📊',
    visibleIn: 'studio',
    region: 'right',
    mount(ctx: PanelContext): PanelHandle {
      const { store, services, ui, container } = ctx;
      const root = el('div', { className: 'panel panel-session' });

      // --- Agent
      const agentInput = el('input', { className: 'text-input', type: 'text', placeholder: 'agent_xxx...' }) as HTMLInputElement;
      agentInput.value = store.getEffective<string>('agentId');
      const agentSave = el('button', { className: 'btn btn-small btn-primary', type: 'button', text: 'Zapisz agenta' });
      agentSave.addEventListener('click', () => {
        const value = agentInput.value.trim();
        if (!value) {
          ui.toast.show('Agent ID nie może być pusty.', 'error');
          return;
        }
        store.setStudio('agentId', value);
        services.conversation.setAgent(value);
      });

      // --- Głośność + mikrofon
      const volumeValue = el('span', { text: `${Math.round(store.getEffective<number>('volume') * 100)}%` });
      const volumeSlider = el('input', { type: 'range', attrs: { min: '0', max: '1', step: '0.05' } }) as HTMLInputElement;
      volumeSlider.value = String(store.getEffective<number>('volume'));
      volumeSlider.addEventListener('input', () => {
        const value = parseFloat(volumeSlider.value);
        volumeValue.textContent = `${Math.round(value * 100)}%`;
        store.setUser('volume', value);
      });

      const micSelect = el('select', { className: 'engine-select' }) as HTMLSelectElement;
      micSelect.append(el('option', { value: '', text: 'Domyślne urządzenie' }));
      micSelect.disabled = true;

      // --- Telemetria
      const telemetryFields = {
        fps: el('strong', { text: '--' }),
        ttfb: el('strong', { text: '-- ms' }),
        bargeIn: el('strong', { text: '0' }),
        session: el('strong', { text: '00:00' }),
        align: el('strong', { text: 'ALIGN: —' }),
      };
      const telemetryGrid = el('div', { className: 'telemetry-grid' }, [
        el('span', {}, [el('span', { text: 'FPS: ' }), telemetryFields.fps]),
        el('span', {}, [el('span', { text: 'TTFB: ' }), telemetryFields.ttfb]),
        el('span', {}, [el('span', { text: 'Barge-in: ' }), telemetryFields.bargeIn]),
        el('span', {}, [el('span', { text: 'Sesja: ' }), telemetryFields.session]),
        el('span', {}, [telemetryFields.align]),
      ]);
      const telemetryTimer = window.setInterval(() => {
        const sample = services.telemetry.sample();
        telemetryFields.fps.textContent = String(sample.fps);
        telemetryFields.ttfb.textContent = sample.ttfbMs !== null ? `${sample.ttfbMs} ms` : '-- ms';
        telemetryFields.bargeIn.textContent = String(sample.bargeInCount);
        telemetryFields.session.textContent = sample.session;
        telemetryFields.align.textContent =
          sample.align.fallback === 0
            ? `ALIGN: EL ✓ (${sample.align.elevenlabs})`
            : `ALIGN: FALLBACK ⚠ (${sample.align.elevenlabs}/${sample.align.fallback})`;
      }, 1000);

      // --- Locki ustawień dla usera
      const locksSection = el('div', { className: 'locks-list' });
      for (const key of LOCK_KEYS) {
        const checkbox = el('input', { type: 'checkbox' }) as HTMLInputElement;
        checkbox.checked = store.isLocked(key);
        checkbox.addEventListener('change', () => store.setLock(key, checkbox.checked));
        locksSection.append(
          el('label', { className: 'engine-toggle' }, [
            checkbox,
            el('span', { text: `${key} (blokada dla usera)` }),
          ])
        );
      }

      // --- Profil: export/import
      const exportButton = el('button', { className: 'btn btn-small btn-secondary', type: 'button', text: '⬇ Eksportuj profil' });
      exportButton.addEventListener('click', () => {
        const json = store.exportProfile();
        try {
          const blob = new Blob([json], { type: 'application/json' });
          const link = el('a', { attrs: { download: 'avatar-profile.json' } }) as HTMLAnchorElement;
          link.href = URL.createObjectURL(blob);
          link.click();
          URL.revokeObjectURL(link.href);
          ui.toast.show('Profil wyeksportowany.', 'success');
        } catch (error) {
          ui.toast.show(`Eksport nie powiódł się: ${(error as Error).message}`, 'error');
        }
      });

      const importInput = el('input', { type: 'file', attrs: { accept: '.json,application/json' } }) as HTMLInputElement;
      importInput.style.display = 'none';
      importInput.addEventListener('change', async () => {
        const file = importInput.files?.[0];
        importInput.value = '';
        if (!file) return;
        try {
          const text = await file.text();
          const result = store.importProfile(text);
          if (result.ok) {
            ui.toast.show('Profil zaimportowany.', 'success');
          } else {
            ui.toast.show(result.error ?? 'Import odrzucony.', 'error');
          }
        } catch (error) {
          ui.toast.show(`Import nie powiódł się: ${(error as Error).message}`, 'error');
        }
      });
      const importButton = el('button', { className: 'btn btn-small btn-secondary', type: 'button', text: '⬆ Importuj profil' });
      importButton.addEventListener('click', () => importInput.click());

      const stressButton = el('button', { className: 'btn btn-small', type: 'button', text: '⚡ PoC Stress' });
      stressButton.addEventListener('click', () => {
        void services.conversation.runPocStress();
      });

      root.append(
        el('div', { className: 'drawer-section' }, [
          el('span', { className: 'section-title', text: 'Agent:' }),
          agentInput,
          agentSave,
        ]),
        el('div', { className: 'drawer-section' }, [
          el('span', { className: 'section-title', text: 'Audio:' }),
          el('label', {}, [el('span', { text: 'Głośność wyjściowa: ' }), volumeValue]),
          volumeSlider,
          micSelect,
          el('p', { className: 'drawer-subtitle', text: 'Wybór urządzenia mikrofonu dostępny po 11-06.' }),
        ]),
        el('div', { className: 'drawer-section' }, [
          el('span', { className: 'section-title', text: 'Telemetria:' }),
          telemetryGrid,
          stressButton,
        ]),
        el('div', { className: 'drawer-section' }, [
          el('span', { className: 'section-title', text: 'Blokady ustawień (dla usera):' }),
          locksSection,
        ]),
        el('div', { className: 'drawer-section' }, [
          el('span', { className: 'section-title', text: 'Profil tweakera:' }),
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
