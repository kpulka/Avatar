/**
 * Panel „Inspektor" (Faza 11, 11-04): ręczne testowanie 51 blendshape'ów ARKit
 * w kategoriach, z filtrem, symetrią L/R i resetem — 1:1 z sekcji inspektora w hud.ts.
 */
import { PanelContext, PanelDefinition, PanelHandle } from '../panel-registry';
import { el } from '../../shared/dom';

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
    title: '🦴 Żuchwa (4)',
    open: true,
    rows: [
      { shape: 'jawOpen', label: 'jawOpen (Otwarcie żuchwy)' },
      { shape: 'jawForward', label: 'jawForward (Wysunięcie)' },
      { shape: 'jawLeft', label: 'jawLeft (W lewo)' },
      { shape: 'jawRight', label: 'jawRight (W prawo)' },
    ],
  },
  {
    title: '👄 Usta & Wargi (23)',
    open: true,
    rows: [
      { shape: 'mouthClose', label: 'mouthClose (Domykanie warg)' },
      { shape: 'mouthFunnel', label: 'mouthFunnel (Tuba)' },
      { shape: 'mouthPucker', label: 'mouthPucker (Dzióbek)' },
      { shape: 'mouthRollLower', label: 'mouthRollLower (Podwinięcie dolnej)' },
      { shape: 'mouthRollUpper', label: 'mouthRollUpper (Podwinięcie górnej)' },
      { shape: 'mouthShrugLower', label: 'mouthShrugLower (Wypchnięcie dolnej)' },
      { shape: 'mouthShrugUpper', label: 'mouthShrugUpper (Pociągnięcie górnej)' },
      { shape: 'mouthPressLeft', label: 'mouthPressLeft (Docisk L)' },
      { shape: 'mouthPressRight', label: 'mouthPressRight (Docisk P)' },
      { shape: 'mouthUpperUpLeft', label: 'mouthUpperUpLeft (Górna warga góra L)' },
      { shape: 'mouthUpperUpRight', label: 'mouthUpperUpRight (Górna warga góra P)' },
      { shape: 'mouthLowerDownLeft', label: 'mouthLowerDownLeft (Dolna warga dół L)' },
      { shape: 'mouthLowerDownRight', label: 'mouthLowerDownRight (Dolna warga dół P)' },
      { shape: 'mouthSmileLeft', label: 'mouthSmileLeft (Uśmiech L)' },
      { shape: 'mouthSmileRight', label: 'mouthSmileRight (Uśmiech P)' },
      { shape: 'mouthFrownLeft', label: 'mouthFrownLeft (Smutek L)' },
      { shape: 'mouthFrownRight', label: 'mouthFrownRight (Smutek P)' },
      { shape: 'mouthDimpleLeft', label: 'mouthDimpleLeft (Dołeczek L)' },
      { shape: 'mouthDimpleRight', label: 'mouthDimpleRight (Dołeczek P)' },
      { shape: 'mouthStretchLeft', label: 'mouthStretchLeft (Rozciągnięcie L)' },
      { shape: 'mouthStretchRight', label: 'mouthStretchRight (Rozciągnięcie P)' },
      { shape: 'mouthLeft', label: 'mouthLeft (Usta w lewo)' },
      { shape: 'mouthRight', label: 'mouthRight (Usta w prawo)' },
    ],
  },
  {
    title: '👁️ Oczy & Spojrzenie (14)',
    rows: [
      { shape: 'eyeBlinkLeft', label: 'eyeBlinkLeft (Mrugnięcie L)' },
      { shape: 'eyeBlinkRight', label: 'eyeBlinkRight (Mrugnięcie P)' },
      { shape: 'eyeWideLeft', label: 'eyeWideLeft (Szerokie oko L)' },
      { shape: 'eyeWideRight', label: 'eyeWideRight (Szerokie oko P)' },
      { shape: 'eyeSquintLeft', label: 'eyeSquintLeft (Zmrużenie L)' },
      { shape: 'eyeSquintRight', label: 'eyeSquintRight (Zmrużenie P)' },
      { shape: 'eyeLookUpLeft', label: 'eyeLookUpLeft (Wzrok góra L)' },
      { shape: 'eyeLookUpRight', label: 'eyeLookUpRight (Wzrok góra P)' },
      { shape: 'eyeLookDownLeft', label: 'eyeLookDownLeft (Wzrok dół L)' },
      { shape: 'eyeLookDownRight', label: 'eyeLookDownRight (Wzrok dół P)' },
      { shape: 'eyeLookInLeft', label: 'eyeLookInLeft (Wzrok wewnątrz L)' },
      { shape: 'eyeLookInRight', label: 'eyeLookInRight (Wzrok wewnątrz P)' },
      { shape: 'eyeLookOutLeft', label: 'eyeLookOutLeft (Wzrok zewnątrz L)' },
      { shape: 'eyeLookOutRight', label: 'eyeLookOutRight (Wzrok zewnątrz P)' },
    ],
  },
  {
    title: '🤨 Brwi & Czoło (5)',
    rows: [
      { shape: 'browInnerUp', label: 'browInnerUp (Wewnętrzne uniesienie)' },
      { shape: 'browDownLeft', label: 'browDownLeft (Ściągnięcie dół L)' },
      { shape: 'browDownRight', label: 'browDownRight (Ściągnięcie dół P)' },
      { shape: 'browOuterUpLeft', label: 'browOuterUpLeft (Zewnętrzne uniesienie L)' },
      { shape: 'browOuterUpRight', label: 'browOuterUpRight (Zewnętrzne uniesienie P)' },
    ],
  },
  {
    title: '😊 Policzki & Nos (5)',
    rows: [
      { shape: 'cheekPuff', label: 'cheekPuff (Nadęcie policzków)' },
      { shape: 'cheekSquintLeft', label: 'cheekSquintLeft (Podciągnięcie policzka L)' },
      { shape: 'cheekSquintRight', label: 'cheekSquintRight (Podciągnięcie policzka P)' },
      { shape: 'noseSneerLeft', label: 'noseSneerLeft (Marszczenie nozdrza L)' },
      { shape: 'noseSneerRight', label: 'noseSneerRight (Marszczenie nozdrza P)' },
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
    title: 'Inspektor',
    icon: '🧪',
    visibleIn: 'studio',
    region: 'left',
    mount(ctx: PanelContext): PanelHandle {
      const { services, container } = ctx;
      const root = el('div', { className: 'panel panel-inspector' });

      const searchInput = el('input', {
        className: 'search-input',
        placeholder: '🔍 Szukaj kształtu (np. jaw, roll, eye)...',
        type: 'text',
      }) as HTMLInputElement;
      const resetAllButton = el('button', { className: 'btn btn-tiny btn-secondary', type: 'button', text: 'Resetuj wszystko' });
      const toolbar = el('div', { className: 'drawer-toolbar' }, [searchInput, resetAllButton]);

      const mirrorCheckbox = el('input', { type: 'checkbox' }) as HTMLInputElement;
      const mirrorToggle = el('label', { className: 'engine-toggle inspector-mirror-toggle' }, [
        mirrorCheckbox,
        el('span', { text: 'Symetrycznie L/R (smile, press, brow, oko…)' }),
      ]);
      const mirrorRow = el('div', { className: 'drawer-toolbar mirror-row' }, [
        mirrorToggle,
        el('span', { className: 'mirror-hint', text: 'jaw/mouth translacje zostają osobno' }),
      ]);

      const body = el('div', { className: 'drawer-body' });
      const rowsByShape = new Map<string, { row: HTMLElement; input: HTMLInputElement; label: HTMLElement }>();

      for (const category of CATEGORIES) {
        const content = el('div', { className: 'rig-category-content' });
        for (const row of category.rows) {
          const valueLabel = el('span', { text: '0.00' });
          const input = el('input', {
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
            el('label', {}, [el('span', { text: `${row.label} ` }), valueLabel]),
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
