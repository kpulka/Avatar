/**
 * Panel „Scena" (Faza 11, 11-04/11-07): ładowanie modelu (demo / .glb), informacje o modelu,
 * presety sceny (pełne przełączanie w 11-07 — tu zapis wyboru do store).
 */
import { PanelContext, PanelDefinition, PanelHandle } from '../panel-registry';
import { el } from '../../shared/dom';

export function createScenePanel(): PanelDefinition {
  return {
    id: 'scene',
    title: 'Scena',
    icon: '🎨',
    visibleIn: 'studio',
    region: 'right',
    mount(ctx: PanelContext): PanelHandle {
      const { store, events, services, ui, container } = ctx;
      const root = el('div', { className: 'panel panel-scene' });

      // --- Model
      const modelInfo = el('p', { className: 'drawer-subtitle', text: 'Model: brak (ładowanie w toku...)' });
      const renderInfo = (info: { name: string; shapesCount: number; speechMeshes: number }): void => {
        modelInfo.textContent = `Model: ${info.name} · shapes: ${info.shapesCount} · meshe mowy: ${info.speechMeshes}`;
      };
      const existingInfo = services.scene.getAvatarInfo();
      if (existingInfo) renderInfo(existingInfo);
      const loadDemoButton = el('button', { className: 'btn btn-small btn-primary', type: 'button', text: 'Wczytaj demo' });
      loadDemoButton.addEventListener('click', () => {
        ui.loader.show('Generowanie demonstracyjnego awatara...');
        setTimeout(() => {
          try {
            services.scene.loadDemo();
          } catch (error) {
            ui.loader.hide();
            ui.toast.show(`Błąd generowania: ${(error as Error).message}`, 'error');
          }
        }, 50);
      });

      const fileInput = el('input', { type: 'file', attrs: { accept: '.glb,.gltf' } }) as HTMLInputElement;
      fileInput.style.display = 'none';
      const fileButton = el('label', { className: 'btn btn-small btn-secondary file-upload-btn' }, [
        el('span', { text: 'Wybierz .GLB' }),
        fileInput,
      ]);
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) return;
        ui.loader.show(`Wczytywanie pliku ${file.name}...`);
        try {
          await services.scene.loadFile(file);
        } catch (error) {
          ui.loader.hide();
          ui.toast.show(`Błąd ładowania: ${(error as Error).message}`, 'error');
        }
      });

      const unsubLoaded = events.on('avatar:loaded', (payload) => {
        renderInfo(payload);
        ui.loader.hide();
      });

      // --- Presety sceny (F11) — picker ukryty, gdy dostępnych jest < 2
      const presetList = el('div', { className: 'scene-preset-list' });
      const availablePresets = services.scenePresets.list();
      if (availablePresets.length >= 2) {
        for (const preset of availablePresets) {
          const radio = el('input', { type: 'radio', attrs: { name: 'scene-preset' } }) as HTMLInputElement;
          radio.value = preset.id;
          radio.checked = services.scenePresets.getCurrentId() === preset.id;
          radio.addEventListener('change', () => {
            store.setUser('scenePreset', preset.id);
            store.setUser('scenePresetManual', true);
            services.scenePresets.apply(preset.id);
          });
          presetList.append(
            el('label', { className: 'engine-toggle' }, [
              radio,
              el('span', { text: preset.label }),
            ])
          );
        }
      }

      root.append(
        el('div', { className: 'drawer-section' }, [
          el('span', { className: 'section-title', text: 'Model awatara:' }),
          modelInfo,
          el('div', { className: 'panel-actions' }, [loadDemoButton, fileButton]),
        ]),
        el('div', { className: 'drawer-section' }, [
          el('span', { className: 'section-title', text: 'Presety sceny:' }),
          presetList,
          el('p', {
            className: 'drawer-subtitle',
            text: 'Preset zmienia tło, światło, exposure i kadr (crossfade 280 ms; reduced-motion = natychmiast).',
          }),
        ])
      );
      container.append(root);

      return {
        destroy(): void {
          unsubLoaded();
          root.remove();
        },
      };
    },
  };
}
