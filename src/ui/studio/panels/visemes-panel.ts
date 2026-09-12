/**
 * Panel „Wizemy" (Faza 11, 11-04): edytor wizemów per głoska — 1:1 z hud.ts.
 * Nadpisania zapisywane przez store (`studio.visemeOverrides`) i aplikowane na FaceController.
 */
import { PanelContext, PanelDefinition, PanelHandle } from '../panel-registry';
import { el } from '../../shared/dom';
import {
  VISEME_GROUPS,
  EDITOR_SHAPES,
  defaultVisemeShapes,
  VisemeOverrideMap,
} from '../../../lipsync/viseme-overrides';

interface ShapeControl {
  id: string;
  shapes: readonly string[];
  label: string;
}

const SHAPE_CONTROLS: ShapeControl[] = [
  { id: 'jawOpen', shapes: ['jawOpen'], label: 'Otwarcie żuchwy (jawOpen)' },
  { id: 'mouthClose', shapes: ['mouthClose'], label: 'Domknięcie warg (mouthClose)' },
  { id: 'mouthPucker', shapes: ['mouthPucker'], label: 'Zaokrąglenie (mouthPucker)' },
  { id: 'mouthFunnel', shapes: ['mouthFunnel'], label: 'Tuba (mouthFunnel)' },
  { id: 'mouthRollLower', shapes: ['mouthRollLower'], label: 'Podwinięcie dolnej wargi (mouthRollLower)' },
  { id: 'mouthShrugLower', shapes: ['mouthShrugLower'], label: 'Uniesienie dolnej wargi (mouthShrugLower)' },
  { id: 'tongueOut', shapes: ['tongueOut'], label: 'Język na zewnątrz (tongueOut)' },
  { id: 'mouthUpperUp', shapes: ['mouthUpperUpLeft', 'mouthUpperUpRight'], label: 'Uniesienie górnej wargi (L+P)' },
  { id: 'mouthLowerDown', shapes: ['mouthLowerDownLeft', 'mouthLowerDownRight'], label: 'Opuść dolną wargę (L+P)' },
  { id: 'mouthSmile', shapes: ['mouthSmileLeft', 'mouthSmileRight'], label: 'Rozciągnięcie kącików (L+P)' },
  { id: 'mouthPress', shapes: ['mouthPressLeft', 'mouthPressRight'], label: 'Ściśnięcie warg (L+P)' },
];

export function createVisemesPanel(): PanelDefinition {
  return {
    id: 'visemes',
    title: 'Wizemy',
    icon: '✏️',
    visibleIn: 'studio',
    region: 'left',
    mount(ctx: PanelContext): PanelHandle {
      const { store, services, container } = ctx;
      const root = el('div', { className: 'panel panel-visemes' });

      let group: 'en' | 'char' = 'en';
      let query = '';
      let selectedKey: string | null = null;
      let record: VisemeOverrideMap = store.getEffective<VisemeOverrideMap>('visemeOverrides') ?? {};

      const groupSelect = el('select', { className: 'viseme-group-select' }) as HTMLSelectElement;
      groupSelect.append(
        el('option', { value: 'en', text: 'Silnik EN (fonemy G2P)' }),
        el('option', { value: 'char', text: 'Ścieżka znaków (PL / fallback)' })
      );
      const searchInput = el('input', { className: 'search-input', placeholder: '🔍 Filtruj głoski...', type: 'text' }) as HTMLInputElement;

      const chipsEl = el('div', { className: 'viseme-chip-list' });
      const detailName = el('strong', { text: '— wybierz głoskę —' });
      const detailState = el('span', { className: 'viseme-detail-state' });
      const slidersEl = el('div', { className: 'viseme-shape-sliders' });
      const detail = el('div', { className: 'viseme-detail' }, [
        el('div', { className: 'viseme-detail-head' }, [detailName, detailState]),
        slidersEl,
      ]);

      const resetKeyButton = el('button', { className: 'btn btn-tiny btn-secondary', type: 'button', text: '↺ Reset tej głoski (domyślna)' });
      const resetAllButton = el('button', { className: 'btn btn-tiny btn-danger', type: 'button', text: '✖ Reset WSZYSTKICH głosek' });
      detail.append(el('div', { className: 'viseme-detail-actions' }, [resetKeyButton, resetAllButton]));

      root.append(
        el('div', { className: 'viseme-toolbar' }, [groupSelect, searchInput]),
        chipsEl,
        detail,
        el('p', { className: 'viseme-hint', text: 'Zmiany zapisują się automatycznie i działają w live lip-syncu. Podgląd znika, gdy agent zacznie mówić.' })
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
        detailName.textContent = '— wybierz głoskę —';
        detailState.textContent = '';
        slidersEl.replaceChildren();
      };

      const selectViseme = (ref: { key: string; label: string }): void => {
        selectedKey = ref.key;
        renderChips();
        detailName.textContent = `${ref.key} — ${ref.label}`;
        detailState.textContent = record[ref.key] ? '⚙ nadpisana' : 'domyślna';
        slidersEl.replaceChildren();

        for (const control of SHAPE_CONTROLS) {
          const valueSpan = el('span', { text: shapeVal(ref.key, control.shapes[0]).toFixed(2) });
          const input = el('input', {
            type: 'range',
            attrs: { min: '0', max: '1', step: '0.01' },
          }) as HTMLInputElement;
          input.value = String(shapeVal(ref.key, control.shapes[0]));
          input.addEventListener('input', () => {
            const value = parseFloat(input.value);
            valueSpan.textContent = value.toFixed(2);
            const base: Record<string, number> = {};
            for (const shape of EDITOR_SHAPES) base[shape] = shapeVal(ref.key, shape);
            for (const shape of control.shapes) base[shape] = value;
            record[ref.key] = base;
            detailState.textContent = '⚙ nadpisana';
            renderChips();
            notifyRecord();
            preview();
          });
          slidersEl.append(
            el('div', { className: 'slider-group' }, [
              el('label', {}, [el('span', { text: `${control.label}: ` }), valueSpan]),
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
          chipsEl.textContent = 'Brak głosek dla filtra.';
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

      resetAllButton.addEventListener('click', () => {
        record = {};
        selectedKey = null;
        notifyRecord();
        renderChips();
        clearDetail();
        services.animation.previewViseme(null);
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
