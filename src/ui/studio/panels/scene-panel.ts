/**
 * "Scene" panel (Phase 11, 11-04/11-07): model loading (demo / .glb), model info,
 * scene presets (full switching in 11-07 — here the choice is written to the store).
 */
import { PanelContext, PanelDefinition, PanelHandle } from '../panel-registry';
import { el } from '../../shared/dom';
import { setSkinSSSEnabled } from '../../../scene/skin-shader';
import { t } from '../../../app/copy';

export function createScenePanel(): PanelDefinition {
  return {
    id: 'scene',
    title: t('panel.title.scene'),
    icon: '🎨',
    visibleIn: 'studio',
    region: 'right',
    mount(ctx: PanelContext): PanelHandle {
      const { store, events, services, ui, container } = ctx;
      const root = el('div', { className: 'panel panel-scene' });

      // --- Model
      const modelInfo = el('p', { className: 'drawer-subtitle', text: t('scene.modelNone') });
      const renderInfo = (info: { name: string; shapesCount: number; speechMeshes: number }): void => {
        modelInfo.textContent = t('scene.modelInfo', { name: info.name, shapes: info.shapesCount, meshes: info.speechMeshes });
      };
      const existingInfo = services.scene.getAvatarInfo();
      if (existingInfo) renderInfo(existingInfo);
      const loadDemoButton = el('button', { className: 'btn btn-small btn-primary', type: 'button', text: t('scene.loadDemo') });
      loadDemoButton.addEventListener('click', () => {
        ui.loader.show(t('scene.generatingDemo'));
        setTimeout(() => {
          try {
            services.scene.loadDemo();
          } catch (error) {
            ui.loader.hide();
            ui.toast.show(t('scene.demoError', { message: (error as Error).message }), 'error');
          }
        }, 50);
      });

      const fileInput = el('input', { type: 'file', attrs: { accept: '.glb,.gltf' } }) as HTMLInputElement;
      fileInput.style.display = 'none';
      const fileButton = el('label', { className: 'btn btn-small btn-secondary file-upload-btn' }, [
        el('span', { text: t('scene.chooseGlb') }),
        fileInput,
      ]);
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) return;
        ui.loader.show(t('scene.loadingFile', { name: file.name }));
        try {
          await services.scene.loadFile(file);
        } catch (error) {
          ui.loader.hide();
          ui.toast.show(t('scene.fileError', { message: (error as Error).message }), 'error');
        }
      });

      const unsubLoaded = events.on('avatar:loaded', (payload) => {
        renderInfo(payload);
        ui.loader.hide();
      });

      // --- Scene presets (F11) — picker hidden when fewer than 2 are available
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

      // --- Skin subsurface scattering toggle (uniform flip, no shader recompile)
      const sssToggle = el('input', { type: 'checkbox' }) as HTMLInputElement;
      sssToggle.checked = true;
      sssToggle.addEventListener('change', () => setSkinSSSEnabled(sssToggle.checked));

      root.append(
        el('div', { className: 'drawer-section' }, [
          el('span', { className: 'section-title', text: t('scene.modelTitle') }),
          modelInfo,
          el('div', { className: 'panel-actions' }, [loadDemoButton, fileButton]),
        ]),
        el('div', { className: 'drawer-section' }, [
          el('span', { className: 'section-title', text: t('scene.presetsTitle') }),
          presetList,
          el('p', {
            className: 'drawer-subtitle',
            text: t('scene.presetsHint'),
          }),
        ]),
        el('div', { className: 'drawer-section' }, [
          el('label', { className: 'engine-toggle' }, [sssToggle, el('span', { text: t('scene.sssLabel') })]),
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
