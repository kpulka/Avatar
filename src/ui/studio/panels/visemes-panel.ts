/**
 * "Visemes" panel (Phase 11, 11-04): per-key viseme editor — 1:1 from hud.ts.
 * Overrides are persisted through the store (`studio.visemeOverrides`) and applied to FaceController.
 */
import { PanelContext, PanelDefinition, PanelHandle } from '../panel-registry';
import { el, uid } from '../../shared/dom';
import {
  VISEME_GROUPS,
  EDITOR_SHAPES,
  defaultVisemeShapes,
  VisemeOverrideMap,
} from '../../../lipsync/viseme-overrides';
import { t } from '../../../app/copy';

interface ShapeControl {
  id: string;
  shapes: readonly [string, ...string[]]; // non-empty: the slider is driven by the first shape
  label: string;
}

const SHAPE_CONTROLS: ShapeControl[] = [
  { id: 'jawOpen', shapes: ['jawOpen'], label: t('visemes.shape.jawOpen') },
  { id: 'mouthClose', shapes: ['mouthClose'], label: t('visemes.shape.mouthClose') },
  { id: 'mouthPucker', shapes: ['mouthPucker'], label: t('visemes.shape.mouthPucker') },
  { id: 'mouthFunnel', shapes: ['mouthFunnel'], label: t('visemes.shape.mouthFunnel') },
  { id: 'mouthRollLower', shapes: ['mouthRollLower'], label: t('visemes.shape.mouthRollLower') },
  { id: 'mouthShrugLower', shapes: ['mouthShrugLower'], label: t('visemes.shape.mouthShrugLower') },
  { id: 'tongueOut', shapes: ['tongueOut'], label: t('visemes.shape.tongueOut') },
  { id: 'mouthUpperUp', shapes: ['mouthUpperUpLeft', 'mouthUpperUpRight'], label: t('visemes.shape.mouthUpperUp') },
  { id: 'mouthLowerDown', shapes: ['mouthLowerDownLeft', 'mouthLowerDownRight'], label: t('visemes.shape.mouthLowerDown') },
  { id: 'mouthSmile', shapes: ['mouthSmileLeft', 'mouthSmileRight'], label: t('visemes.shape.mouthSmile') },
  { id: 'mouthPress', shapes: ['mouthPressLeft', 'mouthPressRight'], label: t('visemes.shape.mouthPress') },
];

export function createVisemesPanel(): PanelDefinition {
  return {
    id: 'visemes',
    title: t('panel.title.visemes'),
    icon: '✏️',
    visibleIn: 'studio',
    region: 'left',
    mount(ctx: PanelContext): PanelHandle {
      const { store, services, container, ui } = ctx;
      const root = el('div', { className: 'panel panel-visemes' });

      let group: 'en' | 'char' = 'en';
      let query = '';
      let selectedKey: string | null = null;
      let record: VisemeOverrideMap = store.getEffective<VisemeOverrideMap>('visemeOverrides') ?? {};

      const groupSelect = el('select', { className: 'viseme-group-select', ariaLabel: t('visemes.groupAria') });
      groupSelect.append(
        el('option', { value: 'en', text: t('visemes.groupEn') }),
        el('option', { value: 'char', text: t('visemes.groupChar') })
      );
      const searchInput = el('input', {
        className: 'search-input',
        placeholder: t('visemes.searchPlaceholder'),
        ariaLabel: t('visemes.searchAria'),
        type: 'text',
      });

      const chipsEl = el('div', { className: 'viseme-chip-list' });
      const detailName = el('strong', { text: t('visemes.pickViseme') });
      const detailState = el('span', { className: 'viseme-detail-state' });
      const slidersEl = el('div', { className: 'viseme-shape-sliders' });
      const detail = el('div', { className: 'viseme-detail' }, [
        el('div', { className: 'viseme-detail-head' }, [detailName, detailState]),
        slidersEl,
      ]);

      const resetKeyButton = el('button', { className: 'btn btn-tiny btn-secondary', type: 'button', text: t('visemes.resetKey') });
      const resetAllButton = el('button', { className: 'btn btn-tiny btn-danger', type: 'button', text: t('visemes.resetAll') });
      detail.append(el('div', { className: 'viseme-detail-actions' }, [resetKeyButton, resetAllButton]));

      root.append(
        el('div', { className: 'viseme-toolbar' }, [groupSelect, searchInput]),
        chipsEl,
        detail,
        el('p', { className: 'viseme-hint', text: t('visemes.hint') })
      );
      container.append(root);

      const notifyRecord = (): void => {
        services.animation.applyVisemeOverrides({ ...record });
      };
      const preview = (): void => {
        services.animation.previewViseme(selectedKey);
      };

      const shapeVal = (key: string, shape: string): number => {
        const override = record[key];
        if (override && override[shape] !== undefined) return override[shape];
        const defaults = defaultVisemeShapes(key);
        return defaults?.get(shape) ?? 0;
      };

      const activeVisemes = () => {
        const groupDef = VISEME_GROUPS.find((entry) => entry.id === group) ?? VISEME_GROUPS[0];
        return groupDef.visemes.filter((viseme) => {
          if (!query) return true;
          return viseme.key.toLowerCase().includes(query) || viseme.label.toLowerCase().includes(query);
        });
      };

      const clearDetail = (): void => {
        detailName.textContent = t('visemes.pickViseme');
        detailState.textContent = '';
        slidersEl.replaceChildren();
      };

      const selectViseme = (ref: { key: string; label: string }): void => {
        selectedKey = ref.key;
        renderChips();
        detailName.textContent = `${ref.key} — ${ref.label}`;
        detailState.textContent = record[ref.key] ? t('visemes.stateOverride') : t('visemes.stateDefault');
        slidersEl.replaceChildren();

        for (const control of SHAPE_CONTROLS) {
          const valueSpan = el('span', { text: shapeVal(ref.key, control.shapes[0]).toFixed(2) });
          const input = el('input', {
            id: uid('viseme-shape'),
            type: 'range',
            attrs: { min: '0', max: '1', step: '0.01' },
          });
          input.value = String(shapeVal(ref.key, control.shapes[0]));
          input.addEventListener('input', () => {
            const value = parseFloat(input.value);
            valueSpan.textContent = value.toFixed(2);
            const base: Record<string, number> = {};
            for (const shape of EDITOR_SHAPES) base[shape] = shapeVal(ref.key, shape);
            for (const shape of control.shapes) base[shape] = value;
            record[ref.key] = base;
            detailState.textContent = t('visemes.stateOverride');
            renderChips();
            notifyRecord();
            preview();
          });
          slidersEl.append(
            el('div', { className: 'slider-group' }, [
              el('label', { attrs: { for: input.id } }, [el('span', { text: `${control.label}: ` }), valueSpan]),
              input,
            ])
          );
        }
        preview();
      };

      const renderChips = (): void => {
        chipsEl.replaceChildren();
        for (const viseme of activeVisemes()) {
          const chip = el('button', {
            className: `viseme-chip${viseme.key === selectedKey ? ' active' : ''}${record[viseme.key] ? ' modified' : ''}`,
            type: 'button',
            text: viseme.label,
            title: viseme.key,
          });
          chip.addEventListener('click', () => selectViseme(viseme));
          chipsEl.append(chip);
        }
        if (chipsEl.childElementCount === 0) {
          chipsEl.textContent = t('visemes.noMatches');
        }
      };

      groupSelect.addEventListener('change', () => {
        group = groupSelect.value === 'char' ? 'char' : 'en';
        selectedKey = null;
        renderChips();
        clearDetail();
      });
      searchInput.addEventListener('input', () => {
        query = searchInput.value.toLowerCase().trim();
        renderChips();
      });

      resetKeyButton.addEventListener('click', () => {
        if (!selectedKey) return;
        delete record[selectedKey];
        notifyRecord();
        renderChips();
        const ref = VISEME_GROUPS.find((entry) => entry.id === group)?.visemes.find((viseme) => viseme.key === selectedKey);
        selectViseme(ref ?? { key: selectedKey, label: selectedKey });
      });

      const wipeAll = (): void => {
        record = {};
        selectedKey = null;
        notifyRecord();
        renderChips();
        clearDetail();
        services.animation.previewViseme(null);
      };

      // S5: wiping every persisted override is destructive, so it goes through a confirm dialog.
      resetAllButton.addEventListener('click', () => {
        const accept = el('button', { className: 'btn btn-primary', type: 'button', text: t('visemes.resetAllConfirmAccept') });
        const cancel = el('button', { className: 'btn btn-secondary', type: 'button', text: t('visemes.resetAllConfirmCancel') });
        accept.addEventListener('click', () => {
          ui.modal.close();
          wipeAll();
        });
        cancel.addEventListener('click', () => ui.modal.close());
        ui.modal.open(
          t('visemes.resetAllConfirmTitle'),
          el('div', { className: 'confirm-body' }, [
            el('p', { text: t('visemes.resetAllConfirmBody') }),
            el('div', { className: 'drawer-actions' }, [accept, cancel]),
          ])
        );
      });

      renderChips();

      return {
        destroy(): void {
          services.animation.previewViseme(null);
          root.remove();
        },
      };
    },
  };
}
