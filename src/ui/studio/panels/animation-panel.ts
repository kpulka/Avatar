/**
 * "Animation" panel (Phase 11, 11-04): lip-sync engine (A/B), animation source, presets
 * and calibration sliders, phoneme/phrase tests, A2F demo. 1:1 from the calibrator section of hud.ts.
 */
import { PanelContext, PanelDefinition, PanelHandle } from '../panel-registry';
import { el, uid } from '../../shared/dom';
import { CALIBRATION_PRESETS, CalibrationPresetName, CalibrationProfile } from '../../../lipsync/calibration';
import { AnimationMode } from '../../../types/avatar';
import { t } from '../../../app/copy';
import { LipSyncEngine, parseLipSyncEngine } from '../../../lipsync/lipsync-engine';

interface SliderSpec {
  key: keyof CalibrationProfile;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
}

const SLIDERS: SliderSpec[] = [
  { key: 'jawScale', label: t('animation.slider.jawScale'), min: 0.5, max: 1.3, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
  { key: 'closeScale', label: t('animation.slider.closeScale'), min: 0.3, max: 1.2, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
  {
    key: 'puckerScale',
    label: t('animation.slider.puckerScale'),
    min: 0.4,
    max: 1.3,
    step: 0.05,
    format: (v) => `${Math.round(v * 100)}%`,
  },
  {
    key: 'funnelScale',
    label: t('animation.slider.funnelScale'),
    min: 0.4,
    max: 1.3,
    step: 0.05,
    format: (v) => `${Math.round(v * 100)}%`,
  },
  { key: 'rollScale', label: t('animation.slider.rollScale'), min: 0.4, max: 1.3, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
  {
    key: 'teethExposureScale',
    label: t('animation.slider.teethExposureScale'),
    min: 0.4,
    max: 1.3,
    step: 0.05,
    format: (v) => `${Math.round(v * 100)}%`,
  },
  { key: 'smileScale', label: t('animation.slider.smileScale'), min: 0.4, max: 1.3, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
  {
    key: 'coarticulationSpeed',
    label: t('animation.slider.coarticulationSpeed'),
    min: 8,
    max: 35,
    step: 1,
    format: (v) => `${Math.round(v)}`,
  },
  {
    key: 'syncOffsetMs',
    label: t('animation.slider.syncOffsetMs'),
    min: -150,
    max: 400,
    step: 5,
    format: (v) => `${v > 0 ? '+' : ''}${Math.round(v)} ms`,
  },
];

const PHONEMES: Array<{ key: 'A' | 'E' | 'O' | 'U' | 'M' | 'SZ' | 'F' | 'neutral'; label: string }> = [
  { key: 'A', label: '[ A ]' },
  { key: 'E', label: '[ E / I ]' },
  { key: 'O', label: '[ O / U ]' },
  { key: 'M', label: '[ M / B / P ]' },
  { key: 'SZ', label: '[ SZ / CZ ]' },
  { key: 'F', label: '[ F / V ]' },
  { key: 'neutral', label: t('animation.phonemeRest') },
];

export function createAnimationPanel(): PanelDefinition {
  return {
    id: 'animation',
    title: t('panel.title.animation'),
    icon: '🎛️',
    visibleIn: 'studio',
    region: 'right',
    mount(ctx: PanelContext): PanelHandle {
      const { store, events, services, ui, container } = ctx;
      const root = el('div', { className: 'panel panel-animation' });

      // 0. Lip-sync engine (A/B)
      const engineSelect = el('select', { className: 'engine-select', ariaLabel: t('animation.engineLabel') });
      engineSelect.append(
        el('option', { value: 'phoneme-en', text: t('animation.engineEn') }),
        el('option', { value: 'phoneme-pl', text: t('animation.enginePl') }),
        el('option', { value: 'char', text: t('animation.engineChar') })
      );
      engineSelect.value = store.getEffective<LipSyncEngine>('lipSyncEngine');
      engineSelect.addEventListener('change', () => {
        services.animation.setLipSyncEngine(parseLipSyncEngine(engineSelect.value) ?? 'phoneme-en');
      });
      root.append(
        el('div', { className: 'drawer-section' }, [
          el('label', { className: 'engine-toggle column' }, [el('span', { text: t('animation.engineLabel') }), engineSelect]),
          el('p', { className: 'drawer-subtitle', text: t('animation.engineHint') }),
        ])
      );

      // 0b. Animation source
      const sourceSelect = el('select', { className: 'engine-select', ariaLabel: t('animation.sourceLabel') });
      sourceSelect.append(
        el('option', { value: 'viseme', text: t('animation.sourceViseme') }),
        el('option', { value: 'frames', text: t('animation.sourceFrames') })
      );
      sourceSelect.value = store.getEffective<string>('animationSource') === 'frames' ? 'frames' : 'viseme';
      sourceSelect.addEventListener('change', () => {
        services.animation.setSource(sourceSelect.value === 'frames' ? 'frames' : 'viseme');
      });
      root.append(
        el('div', { className: 'drawer-section' }, [
          el('label', { className: 'engine-toggle column' }, [el('span', { text: t('animation.sourceLabel') }), sourceSelect]),
          el('p', { className: 'drawer-subtitle', text: t('animation.sourceHint') }),
        ])
      );

      // 1. Presets
      const presetNames: CalibrationPresetName[] = ['subtle', 'balanced', 'expressive'];
      const presetLabels: Record<CalibrationPresetName, string> = {
        subtle: t('animation.presetSubtle'),
        balanced: t('animation.presetBalanced'),
        expressive: t('animation.presetExpressive'),
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
          el('span', { className: 'section-title', text: t('animation.presetsTitle') }),
          presetRow,
        ])
      );

      // 2. Phoneme tests
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
      const phrasePl = el('button', { className: 'btn btn-small', type: 'button', text: t('animation.phrasePl') });
      phrasePl.addEventListener('click', () => services.animation.testPhrase('pl'));
      const phraseEn = el('button', { className: 'btn btn-small', type: 'button', text: t('animation.phraseEn') });
      phraseEn.addEventListener('click', () => services.animation.testPhrase('en'));
      const demoA2f = el('button', { className: 'btn btn-small', type: 'button', text: t('animation.demoA2f') });
      demoA2f.addEventListener('click', () => {
        void services.animation.runA2fDemo();
      });
      root.append(
        el('div', { className: 'drawer-section' }, [
          el('span', { className: 'section-title', text: t('animation.phonemesTitle') }),
          phonemeRow,
          el('div', { className: 'sample-speech-buttons' }, [phrasePl, phraseEn, demoA2f]),
        ])
      );

      // 3+4. Calibration sliders
      const sliderInputs = new Map<keyof CalibrationProfile, HTMLInputElement>();
      const sliderLabels = new Map<keyof CalibrationProfile, HTMLElement>();
      const geometrySection = el('div', { className: 'drawer-section' }, [
        el('span', { className: 'section-title', text: t('animation.geometryTitle') }),
      ]);
      const dynamicsSection = el('div', { className: 'drawer-section' }, [
        el('span', { className: 'section-title', text: t('animation.dynamicsTitle') }),
      ]);

      for (const spec of SLIDERS) {
        const valueLabel = el('span', { text: '' });
        const input = el('input', {
          id: uid(`slider-${String(spec.key)}`),
          type: 'range',
          attrs: {
            min: String(spec.min),
            max: String(spec.max),
            step: String(spec.step),
          },
        });
        input.addEventListener('input', () => {
          const value = parseFloat(input.value);
          valueLabel.textContent = spec.format(value);
          setActivePreset(null);
          services.animation.setCalibration({ [spec.key]: value });
        });
        sliderInputs.set(spec.key, input);
        sliderLabels.set(spec.key, valueLabel);
        const group = el('div', { className: 'slider-group' }, [
          el('label', { attrs: { for: input.id } }, [el('span', { text: `${spec.label}: ` }), valueLabel]),
          input,
        ]);
        (spec.key === 'coarticulationSpeed' || spec.key === 'syncOffsetMs' ? dynamicsSection : geometrySection).append(group);
      }

      const saveButton = el('button', { className: 'btn btn-primary', type: 'button', text: t('animation.save') });
      saveButton.addEventListener('click', () => {
        services.animation.saveCalibration();
        ui.toast.show(t('animation.savedToast'), 'success');
      });
      const resetButton = el('button', { className: 'btn btn-secondary', type: 'button', text: t('animation.reset') });
      resetButton.addEventListener('click', () => {
        const profile = services.animation.resetCalibration();
        updateSliders(profile);
        setActivePreset('balanced');
        ui.toast.show(t('animation.resetToast'), 'success');
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

      // Initial state
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
