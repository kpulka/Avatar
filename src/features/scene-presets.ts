/**
 * Scene preset data (Phase 11, 11-07): background, light rig, exposure, pedestal, framing.
 * Values 1:1 from the 11-UI-SPEC table (studio-dark = the original StudioLighting).
 */
import { t } from '../app/copy';

export interface ScenePreset {
  id: string;
  label: string;
  background: { type: 'color'; value: number } | { type: 'gradient'; from: number; to: number };
  key: { intensity: number; color: number };
  fill: { intensity: number; color: number };
  rim: { intensity: number; color: number };
  ambient: number;
  exposure: number;
  pedestal: boolean;
  framing: 'bust' | 'head';
}

export const SCENE_PRESETS: ScenePreset[] = [
  {
    id: 'studio-dark',
    label: t('scenePreset.studio-dark'),
    background: { type: 'color', value: 0x0e1117 },
    key: { intensity: 2.2, color: 0xfff2e0 },
    fill: { intensity: 0.7, color: 0xdbe9ff },
    rim: { intensity: 2.6, color: 0xffe8d6 },
    ambient: 0.15,
    exposure: 1.0,
    pedestal: true,
    framing: 'bust',
  },
  {
    id: 'studio-soft',
    label: t('scenePreset.studio-soft'),
    background: { type: 'gradient', from: 0x1a2233, to: 0x0b0f17 },
    key: { intensity: 1.8, color: 0xfff6ea },
    fill: { intensity: 1.1, color: 0xdbe9ff },
    rim: { intensity: 1.4, color: 0xffe8d6 },
    ambient: 0.25,
    exposure: 1.05,
    pedestal: true,
    framing: 'bust',
  },
  {
    id: 'cinema',
    label: t('scenePreset.cinema'),
    background: { type: 'color', value: 0x05070c },
    key: { intensity: 2.6, color: 0xffffff },
    fill: { intensity: 0.35, color: 0xbfd4ff },
    rim: { intensity: 3.2, color: 0xffe0c0 },
    ambient: 0.08,
    exposure: 0.95,
    pedestal: false,
    framing: 'bust',
  },
  {
    id: 'light',
    label: t('scenePreset.light'),
    background: { type: 'color', value: 0xe8eef7 },
    key: { intensity: 1.4, color: 0xffffff },
    fill: { intensity: 1.2, color: 0xeaf1ff },
    rim: { intensity: 0.9, color: 0xffffff },
    ambient: 0.5,
    exposure: 1.0,
    pedestal: false,
    framing: 'bust',
  },
];

export function getScenePreset(id: string): ScenePreset {
  return SCENE_PRESETS.find((preset) => preset.id === id) ?? SCENE_PRESETS[0];
}
