/**
 * Panel „Animacja" (Faza 11, 11-04): silnik lip-sync (A/B), źródło animacji, presety
 * i suwaki kalibracji, testy głosek/fraz, demo A2F. 1:1 z sekcji kalibratora w hud.ts.
 */
import { PanelContext, PanelDefinition, PanelHandle } from '../panel-registry';
import { el } from '../../shared/dom';
import {
  CALIBRATION_PRESETS,
  CalibrationPresetName,
  CalibrationProfile,
} from '../../../lipsync/calibration';
import { AnimationMode } from '../../../types/avatar';

interface SliderSpec {
  key: keyof CalibrationProfile;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
}

const SLIDERS: SliderSpec[] = [
  { key: 'jawScale', label: 'Głębokość otwarcia żuchwy (jawOpen)', min: 0.5, max: 1.3, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
  { key: 'closeScale', label: 'Domykanie warg M / B / P (mouthClose)', min: 0.3, max: 1.2, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
  { key: 'puckerScale', label: 'Zaokrąglenie warg O / U (mouthPucker)', min: 0.4, max: 1.3, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
  { key: 'funnelScale', label: 'Tuba wargowa O / SZ (mouthFunnel)', min: 0.4, max: 1.3, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
  { key: 'rollScale', label: 'Podwijanie dolnej wargi F / V (mouthRollLower)', min: 0.4, max: 1.3, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
  { key: 'teethExposureScale', label: 'Odsłanianie zębów / siekaczy (mouthUpperUp)', min: 0.4, max: 1.3, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
  { key: 'smileScale', label: 'Szerokość uśmiechu w mowie (mouthSmile)', min: 0.4, max: 1.3, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
  { key: 'coarticulationSpeed', label: 'Płynność przejść głosek (Szybkość lambda)', min: 8, max: 35, step: 1, format: (v) => `${Math.round(v)}` },
  { key: 'syncOffsetMs', label: 'Przesunięcie synchronizacji AV (Audio Lead)', min: -150, max: 400, step: 5, format: (v) => `${v > 0 ? '+' : ''}${Math.round(v)} ms` },
];

const PHONEMES: Array<{ key: 'A' | 'E' | 'O' | 'U' | 'M' | 'SZ' | 'F' | 'neutral'; label: string }> = [
  { key: 'A', label: '[ A ]' },
  { key: 'E', label: '[ E / I ]' },
  { key: 'O', label: '[ O / U ]' },
  { key: 'M', label: '[ M / B / P ]' },
  { key: 'SZ', label: '[ SZ / CZ ]' },
  { key: 'F', label: '[ F / V ]' },
  { key: 'neutral', label: 'Spoczynek' },
];

export function createAnimationPanel(): PanelDefinition {
  return {
    id: 'animation',
    title: 'Animacja',
    icon: '🎛️',
    visibleIn: 'studio',
    region: 'right',
    mount(ctx: PanelContext): PanelHandle {
      const { store, events, services, ui, container } = ctx;
      const root = el('div', { className: 'panel panel-animation' });

      // 0. Silnik lip-syncu (A/B)
      const engineToggle = el('input', { type: 'checkbox' }) as HTMLInputElement;
      engineToggle.checked = store.getEffective<'phoneme' | 'char'>('lipSyncEngine') === 'phoneme';
      engineToggle.addEventListener('change', () => {
        services.animation.setLipSyncEngine(engineToggle.checked ? 'phoneme' : 'char');
      });
      root.append(
        el('div', { className: 'drawer-section' }, [
          el('label', { className: 'engine-toggle' }, [
            engineToggle,
            el('span', { text: 'Fonemowy silnik EN (G2P)' }),
          ]),
          el('p', { className: 'drawer-subtitle', text: 'ON = litery → fonemy (CMUdict); OFF = stara tabela znaków' }),
        ])
      );

      // 0b. Źródło animacji
      const sourceSelect = el('select', { className: 'engine-select' }) as HTMLSelectElement;
      sourceSelect.append(
        el('option', { value: 'viseme', text: 'LIVE wizemy (domyślne)' }),
        el('option', { value: 'frames', text: 'A2F (frames)' })
      );
      sourceSelect.value = store.getEffective<string>('animationSource') === 'frames' ? 'frames' : 'viseme';
      sourceSelect.addEventListener('change', () => {
        services.animation.setSource(sourceSelect.value === 'frames' ? 'frames' : 'viseme');
      });
      root.append(
        el('div', { className: 'drawer-section' }, [
          el('label', { className: 'engine-toggle column' }, [
            el('span', { text: 'Źródło animacji:' }),
            sourceSelect,
          ]),
          el('p', { className: 'drawer-subtitle', text: 'frames = absolutne ramki neuronowe; wybierz i odpal „▶ Demo A2F" poniżej' }),
        ])
      );

      // 1. Presety
      const presetNames: CalibrationPresetName[] = ['subtle', 'balanced', 'expressive'];
      const presetLabels: Record<CalibrationPresetName, string> = {
        subtle: '🎯 Dyskretny',
        balanced: '🌟 Naturalny',
        expressive: '🎭 Ekspresyjny',
      };
      const presetButtons = new Map<CalibrationPresetName, HTMLButtonElement>();
      const presetRow = el('div', { className: 'preset-buttons' });
      for (const name of presetNames) {
        const button = el('button', {
          className: 'btn btn-small preset-btn',
          type: 'button',
          text: presetLabels[name],
        });
        button.addEventListener('click', () => {
          services.animation.applyPreset(name);
          updateSliders(CALIBRATION_PRESETS[name]);
          setActivePreset(name);
        });
        presetButtons.set(name, button);
        presetRow.append(button);
      }
      root.append(
        el('div', { className: 'drawer-section' }, [
          el('span', { className: 'section-title', text: '1. Profile artykulacji:' }),
          presetRow,
        ])
      );

      // 2. Testy głosek
      const phonemeRow = el('div', { className: 'phoneme-buttons' });
      for (const phoneme of PHONEMES) {
        const button = el('button', {
          className: `btn btn-small btn-phoneme${phoneme.key === 'neutral' ? ' btn-neutral' : ''}`,
          type: 'button',
          text: phoneme.label,
        });
        button.addEventListener('click', () => services.animation.testPhoneme(phoneme.key));
        phonemeRow.append(button);
      }
      const phrasePl = el('button', { className: 'btn btn-small', type: 'button', text: '▶ Zdanie testowe (PL)' });
      phrasePl.addEventListener('click', () => services.animation.testPhrase('pl'));
      const phraseEn = el('button', { className: 'btn btn-small', type: 'button', text: '▶ Sample Speech (EN)' });
      phraseEn.addEventListener('click', () => services.animation.testPhrase('en'));
      const demoA2f = el('button', { className: 'btn btn-small', type: 'button', text: '▶ Demo A2F (frames)' });
      demoA2f.addEventListener('click', () => {
        void services.animation.runA2fDemo();
      });
      root.append(
        el('div', { className: 'drawer-section' }, [
          el('span', { className: 'section-title', text: '2. Podgląd ułożenia ust (statyczny test):' }),
          phonemeRow,
          el('div', { className: 'sample-speech-buttons' }, [phrasePl, phraseEn, demoA2f]),
        ])
      );

      // 3+4. Suwaki kalibracji
      const sliderInputs = new Map<keyof CalibrationProfile, HTMLInputElement>();
      const sliderLabels = new Map<keyof CalibrationProfile, HTMLElement>();
      const geometrySection = el('div', { className: 'drawer-section' }, [
        el('span', { className: 'section-title', text: '3. Geometria ust i zębów:' }),
      ]);
      const dynamicsSection = el('div', { className: 'drawer-section' }, [
        el('span', { className: 'section-title', text: '4. Dynamika i synchronizacja AV:' }),
      ]);

      for (const spec of SLIDERS) {
        const valueLabel = el('span', { text: '' });
        const input = el('input', {
          type: 'range',
          attrs: {
            min: String(spec.min),
            max: String(spec.max),
            step: String(spec.step),
          },
        }) as HTMLInputElement;
        input.addEventListener('input', () => {
          const value = parseFloat(input.value);
          valueLabel.textContent = spec.format(value);
          setActivePreset(null);
          services.animation.setCalibration({ [spec.key]: value } as Partial<CalibrationProfile>);
        });
        sliderInputs.set(spec.key, input);
        sliderLabels.set(spec.key, valueLabel);
        const group = el('div', { className: 'slider-group' }, [
          el('label', {}, [el('span', { text: `${spec.label}: ` }), valueLabel]),
          input,
        ]);
        (spec.key === 'coarticulationSpeed' || spec.key === 'syncOffsetMs' ? dynamicsSection : geometrySection).append(group);
      }

      const saveButton = el('button', { className: 'btn btn-primary', type: 'button', text: '💾 Zapisz Profil' });
      saveButton.addEventListener('click', () => {
        services.animation.saveCalibration();
        ui.toast.show('Profil kalibracji fonetycznej zapisany w pamięci!', 'success');
      });
      const resetButton = el('button', { className: 'btn btn-secondary', type: 'button', text: '↺ Przywróć Domyślne' });
      resetButton.addEventListener('click', () => {
        const profile = services.animation.resetCalibration();
        updateSliders(profile);
        setActivePreset('balanced');
        ui.toast.show('Przywrócono domyślny profil kalibracji', 'success');
      });
      const actions = el('div', { className: 'drawer-actions' }, [saveButton, resetButton]);

      root.append(geometrySection, dynamicsSection, actions);
      container.append(root);

      function updateSliders(profile: CalibrationProfile): void {
        for (const spec of SLIDERS) {
          const input = sliderInputs.get(spec.key);
          const label = sliderLabels.get(spec.key);
          if (input) input.value = String(profile[spec.key]);
          if (label) label.textContent = spec.format(profile[spec.key]);
        }
      }

      function setActivePreset(name: CalibrationPresetName | null): void {
        for (const [key, button] of presetButtons) {
          button.classList.toggle('active', key === name);
        }
      }

      // Stan początkowy
      const initialProfile = services.animation.updateCalibrationSliders();
      updateSliders(initialProfile);

      const unsubSource = events.on('animation:source', (mode: AnimationMode) => {
        sourceSelect.value = mode === 'frames' ? 'frames' : 'viseme';
      });

      return {
        destroy(): void {
          unsubSource();
          root.remove();
        },
      };
    },
  };
}
