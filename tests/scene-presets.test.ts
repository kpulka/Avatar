import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { SCENE_PRESETS } from '../src/features/scene-presets';
import { ScenePresetController, ScenePresetHost } from '../src/features/scene-preset-controller';
import { SettingsStore } from '../src/app/store/settings-store';
import { TypedEventBus } from '../src/app/events';
import { AppEvents } from '../src/app/app-types';
import { createMemoryStorage } from './helpers/memory-storage';

interface FakeHost extends ScenePresetHost {
  backgrounds: string[];
  pedestal: boolean;
  framing: 'bust' | 'head';
  exposureValue: number;
}

function makeHost(): FakeHost {
  const host: FakeHost = {
    key: { intensity: 2.2, color: new THREE.Color(0xfff2e0) },
    fill: { intensity: 0.7, color: new THREE.Color(0xdbe9ff) },
    rim: { intensity: 2.6, color: new THREE.Color(0xffe8d6) },
    ambient: { intensity: 0.15 },
    backgrounds: [],
    pedestal: true,
    framing: 'bust',
    exposureValue: 1.0,
    setBackgroundColor(hex: number) {
      host.backgrounds.push(`color:${hex.toString(16)}`);
    },
    setGradientBackground(from: number, to: number) {
      host.backgrounds.push(`gradient:${from.toString(16)}:${to.toString(16)}`);
    },
    setPedestal(visible: boolean) {
      host.pedestal = visible;
    },
    setFraming(framing: 'bust' | 'head') {
      host.framing = framing;
    },
    getExposure() {
      return host.exposureValue;
    },
    setExposure(value: number) {
      host.exposureValue = value;
    },
  };
  return host;
}

function makeController(options: { reduced?: boolean; createGradient?: (from: number, to: number) => THREE.Texture } = {}) {
  const storage = createMemoryStorage();
  const store = new SettingsStore(storage);
  const events = new TypedEventBus<AppEvents>();
  const host = makeHost();
  const textures: THREE.Texture[] = [];
  if (options.createGradient) {
    (host as unknown as { setBackgroundTexture: (texture: THREE.Texture) => void }).setBackgroundTexture = (texture) => {
      textures.push(texture);
    };
  }
  const controller = new ScenePresetController({
    host,
    store,
    events,
    reducedMotion: () => options.reduced === true,
    createGradient: options.createGradient,
  });
  return { controller, host, store, events, textures };
}

describe('SCENE_PRESETS (dane)', () => {
  it('zawiera min. 3 presety o unikalnych id, w tym wymagane cztery', () => {
    expect(SCENE_PRESETS.length).toBeGreaterThanOrEqual(3);
    const ids = SCENE_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['studio-dark', 'studio-soft', 'cinema', 'light']));
  });

  it('wartości presetów są w sensownych zakresach', () => {
    for (const preset of SCENE_PRESETS) {
      expect(preset.key.intensity).toBeGreaterThan(0);
      expect(preset.key.intensity).toBeLessThan(5);
      expect(preset.exposure).toBeGreaterThan(0.5);
      expect(preset.exposure).toBeLessThan(1.5);
      expect(['bust', 'head']).toContain(preset.framing);
    }
  });
});

describe('ScenePresetController', () => {
  it('apply + tween kończy w wartościach docelowych (cinema)', () => {
    const { controller, host } = makeController({ reduced: false });
    controller.apply('cinema');
    for (let i = 0; i < 40; i += 1) controller.update(0.016);

    expect(host.key.intensity).toBeCloseTo(2.6, 2);
    expect(host.fill.intensity).toBeCloseTo(0.35, 2);
    expect(host.rim.intensity).toBeCloseTo(3.2, 2);
    expect(host.exposureValue).toBeCloseTo(0.95, 2);
    expect(host.ambient.intensity).toBeCloseTo(0.08, 3);
    expect(host.pedestal).toBe(false);
    expect(host.framing).toBe('bust');
    expect(host.backgrounds).toContain(`color:${(0x05070c).toString(16)}`);
  });

  it('reduced-motion stosuje wartości natychmiast', () => {
    const { controller, host } = makeController({ reduced: true });
    controller.apply('light');
    expect(host.key.intensity).toBeCloseTo(1.4, 3);
    expect(host.exposureValue).toBeCloseTo(1.0, 3);
    expect(host.backgrounds).toContain(`color:${(0xe8eef7).toString(16)}`);
  });

  it('wymiana tekstury gradientu dispose-uje poprzednią', () => {
    let created = 0;
    const disposers: Array<ReturnType<typeof vi.fn>> = [];
    const createGradient = (): THREE.Texture => {
      created += 1;
      const dispose = vi.fn();
      disposers.push(dispose);
      return { dispose } as unknown as THREE.Texture;
    };
    const { controller, textures } = makeController({ reduced: true, createGradient });

    controller.apply('studio-soft'); // gradient #1
    expect(created).toBe(1);
    expect(textures).toHaveLength(1);

    controller.apply('cinema'); // color → dispose gradientu #1
    expect(disposers[0]).toHaveBeenCalledTimes(1);

    controller.apply('studio-soft'); // gradient #2
    expect(created).toBe(2);

    controller.apply('studio-soft'); // gradient → gradient: dispose #2
    expect(disposers[1]).toHaveBeenCalledTimes(1);
  });

  it('sync motywu działa tylko bez ręcznego wyboru presetu', () => {
    const { controller, store } = makeController({ reduced: true });

    controller.onThemeChange('light');
    expect(controller.getCurrentId()).toBe('light');

    store.setUser('scenePresetManual', true);
    controller.apply('studio-dark');
    controller.onThemeChange('light');
    expect(controller.getCurrentId()).toBe('studio-dark');

    // dark przywraca studio-dark tylko gdy aktualnie light
    store.setUser('scenePresetManual', false);
    controller.onThemeChange('light');
    expect(controller.getCurrentId()).toBe('light');
    controller.onThemeChange('dark');
    expect(controller.getCurrentId()).toBe('studio-dark');
  });
});
