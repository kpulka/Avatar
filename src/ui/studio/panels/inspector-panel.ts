/**
 * "Inspector" panel (Phase 11, 11-04): manual testing of the 51 ARKit blendshapes
 * by category, with filter, L/R symmetry and reset — 1:1 from the inspector section of hud.ts.
 */
import { PanelContext, PanelDefinition, PanelHandle } from '../panel-registry';
import { el, uid } from '../../shared/dom';
import { t } from '../../../app/copy';

interface ShapeRow {
  shape: string;
  label: string;
}

interface Category {
  title: string;
  open?: boolean;
  rows: ShapeRow[];
}

const CATEGORIES: Category[] = [
  {
    title: t('inspector.category.jaw'),
    open: true,
    rows: [
      { shape: 'jawOpen', label: t('inspector.shape.jawOpen') },
      { shape: 'jawForward', label: t('inspector.shape.jawForward') },
      { shape: 'jawLeft', label: t('inspector.shape.jawLeft') },
      { shape: 'jawRight', label: t('inspector.shape.jawRight') },
    ],
  },
  {
    title: t('inspector.category.mouth'),
    open: true,
    rows: [
      { shape: 'mouthClose', label: t('inspector.shape.mouthClose') },
      { shape: 'mouthFunnel', label: t('inspector.shape.mouthFunnel') },
      { shape: 'mouthPucker', label: t('inspector.shape.mouthPucker') },
      { shape: 'mouthRollLower', label: t('inspector.shape.mouthRollLower') },
      { shape: 'mouthRollUpper', label: t('inspector.shape.mouthRollUpper') },
      { shape: 'mouthShrugLower', label: t('inspector.shape.mouthShrugLower') },
      { shape: 'mouthShrugUpper', label: t('inspector.shape.mouthShrugUpper') },
      { shape: 'mouthPressLeft', label: t('inspector.shape.mouthPressLeft') },
      { shape: 'mouthPressRight', label: t('inspector.shape.mouthPressRight') },
      { shape: 'mouthUpperUpLeft', label: t('inspector.shape.mouthUpperUpLeft') },
      { shape: 'mouthUpperUpRight', label: t('inspector.shape.mouthUpperUpRight') },
      { shape: 'mouthLowerDownLeft', label: t('inspector.shape.mouthLowerDownLeft') },
      { shape: 'mouthLowerDownRight', label: t('inspector.shape.mouthLowerDownRight') },
      { shape: 'mouthSmileLeft', label: t('inspector.shape.mouthSmileLeft') },
      { shape: 'mouthSmileRight', label: t('inspector.shape.mouthSmileRight') },
      { shape: 'mouthFrownLeft', label: t('inspector.shape.mouthFrownLeft') },
      { shape: 'mouthFrownRight', label: t('inspector.shape.mouthFrownRight') },
      { shape: 'mouthDimpleLeft', label: t('inspector.shape.mouthDimpleLeft') },
      { shape: 'mouthDimpleRight', label: t('inspector.shape.mouthDimpleRight') },
      { shape: 'mouthStretchLeft', label: t('inspector.shape.mouthStretchLeft') },
      { shape: 'mouthStretchRight', label: t('inspector.shape.mouthStretchRight') },
      { shape: 'mouthLeft', label: t('inspector.shape.mouthLeft') },
      { shape: 'mouthRight', label: t('inspector.shape.mouthRight') },
    ],
  },
  {
    title: t('inspector.category.eyes'),
    rows: [
      { shape: 'eyeBlinkLeft', label: t('inspector.shape.eyeBlinkLeft') },
      { shape: 'eyeBlinkRight', label: t('inspector.shape.eyeBlinkRight') },
      { shape: 'eyeWideLeft', label: t('inspector.shape.eyeWideLeft') },
      { shape: 'eyeWideRight', label: t('inspector.shape.eyeWideRight') },
      { shape: 'eyeSquintLeft', label: t('inspector.shape.eyeSquintLeft') },
      { shape: 'eyeSquintRight', label: t('inspector.shape.eyeSquintRight') },
      { shape: 'eyeLookUpLeft', label: t('inspector.shape.eyeLookUpLeft') },
      { shape: 'eyeLookUpRight', label: t('inspector.shape.eyeLookUpRight') },
      { shape: 'eyeLookDownLeft', label: t('inspector.shape.eyeLookDownLeft') },
      { shape: 'eyeLookDownRight', label: t('inspector.shape.eyeLookDownRight') },
      { shape: 'eyeLookInLeft', label: t('inspector.shape.eyeLookInLeft') },
      { shape: 'eyeLookInRight', label: t('inspector.shape.eyeLookInRight') },
      { shape: 'eyeLookOutLeft', label: t('inspector.shape.eyeLookOutLeft') },
      { shape: 'eyeLookOutRight', label: t('inspector.shape.eyeLookOutRight') },
    ],
  },
  {
    title: t('inspector.category.brows'),
    rows: [
      { shape: 'browInnerUp', label: t('inspector.shape.browInnerUp') },
      { shape: 'browDownLeft', label: t('inspector.shape.browDownLeft') },
      { shape: 'browDownRight', label: t('inspector.shape.browDownRight') },
      { shape: 'browOuterUpLeft', label: t('inspector.shape.browOuterUpLeft') },
      { shape: 'browOuterUpRight', label: t('inspector.shape.browOuterUpRight') },
    ],
  },
  {
    title: t('inspector.category.cheeks'),
    rows: [
      { shape: 'cheekPuff', label: t('inspector.shape.cheekPuff') },
      { shape: 'cheekSquintLeft', label: t('inspector.shape.cheekSquintLeft') },
      { shape: 'cheekSquintRight', label: t('inspector.shape.cheekSquintRight') },
      { shape: 'noseSneerLeft', label: t('inspector.shape.noseSneerLeft') },
      { shape: 'noseSneerRight', label: t('inspector.shape.noseSneerRight') },
    ],
  },
];

const MIRROR_BASES = [
  'eyeBlink', 'eyeSquint', 'eyeWide', 'eyeLookUp', 'eyeLookDown', 'eyeLookIn', 'eyeLookOut',
  'browDown', 'browOuterUp', 'cheekSquint', 'noseSneer',
  'mouthSmile', 'mouthPress', 'mouthUpperUp', 'mouthLowerDown', 'mouthDimple', 'mouthFrown',
  'mouthStretch',
];

function isMirrorShape(shape: string): boolean {
  if (shape.endsWith('Left') || shape.endsWith('Right')) {
    const base = shape.endsWith('Left') ? shape.slice(0, -4) : shape.slice(0, -5);
    return MIRROR_BASES.includes(base);
  }
  return false;
}

function mirrorCounterpart(shape: string): string {
  return shape.endsWith('Left') ? shape.replace(/Left$/, 'Right') : shape.replace(/Right$/, 'Left');
}

export function createInspectorPanel(): PanelDefinition {
  return {
    id: 'inspector',
    title: t('panel.title.inspector'),
    icon: '🧪',
    visibleIn: 'studio',
    region: 'left',
    mount(ctx: PanelContext): PanelHandle {
      const { services, container } = ctx;
      const root = el('div', { className: 'panel panel-inspector' });

      const searchInput = el('input', {
        className: 'search-input',
        placeholder: t('inspector.searchPlaceholder'),
        ariaLabel: t('inspector.searchAria'),
        type: 'text',
      }) as HTMLInputElement;
      const resetAllButton = el('button', { className: 'btn btn-tiny btn-secondary', type: 'button', text: t('inspector.resetAll') });
      const toolbar = el('div', { className: 'drawer-toolbar' }, [searchInput, resetAllButton]);

      const mirrorCheckbox = el('input', { type: 'checkbox' }) as HTMLInputElement;
      const mirrorToggle = el('label', { className: 'engine-toggle inspector-mirror-toggle' }, [
        mirrorCheckbox,
        el('span', { text: t('inspector.mirror') }),
      ]);
      const mirrorRow = el('div', { className: 'drawer-toolbar mirror-row' }, [
        mirrorToggle,
        el('span', { className: 'mirror-hint', text: t('inspector.mirrorHint') }),
      ]);

      const body = el('div', { className: 'drawer-body' });
      const rowsByShape = new Map<string, { row: HTMLElement; input: HTMLInputElement; label: HTMLElement }>();

      for (const category of CATEGORIES) {
        const content = el('div', { className: 'rig-category-content' });
        for (const row of category.rows) {
          const valueLabel = el('span', { text: '0.00' });
          const input = el('input', {
            id: uid('inspector-shape'),
            type: 'range',
            attrs: { min: '0', max: '1', step: '0.01' },
          }) as HTMLInputElement;
          input.value = '0';

          input.addEventListener('input', () => {
            const value = parseFloat(input.value);
            valueLabel.textContent = value.toFixed(2);
            services.animation.setManualOverride(row.shape, value);
            if (mirrorCheckbox.checked && isMirrorShape(row.shape)) {
              const sibling = rowsByShape.get(mirrorCounterpart(row.shape));
              if (sibling) {
                sibling.input.value = String(value);
                sibling.label.textContent = value.toFixed(2);
              }
              services.animation.setManualOverride(mirrorCounterpart(row.shape), value);
            }
          });

          const rowEl = el('div', { className: 'slider-group inspector-row', attrs: { 'data-shape': row.shape } }, [
            el('label', { attrs: { for: input.id } }, [el('span', { text: `${row.label} ` }), valueLabel]),
            input,
          ]);
          rowsByShape.set(row.shape, { row: rowEl, input, label: valueLabel });
          content.append(rowEl);
        }
        const details = el('details', { className: 'rig-category' });
        if (category.open) details.setAttribute('open', '');
        const summary = el('summary', { className: 'rig-category-title', text: category.title });
        details.append(summary, content);
        body.append(details);
      }

      searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        for (const [shape, entry] of rowsByShape) {
          entry.row.style.display = shape.toLowerCase().includes(query) ? '' : 'none';
        }
      });

      resetAllButton.addEventListener('click', () => {
        for (const entry of rowsByShape.values()) {
          entry.input.value = '0';
          entry.label.textContent = '0.00';
        }
        services.animation.resetMorphs();
      });

      root.append(toolbar, mirrorRow, body);
      container.append(root);

      return {
        destroy(): void {
          root.remove();
        },
      };
    },
  };
}
