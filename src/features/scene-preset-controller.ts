/**
 * ScenePresetController (Faza 11, 11-07, Pattern 6): apply/Tween presetów sceny.
 *
 * - światła + ambient + exposure: tween 280 ms w `update(dt)` (reduced-motion → instant),
 * - tło: color albo gradient (CanvasTexture po stronie sceny; przy wstrzykniętym
 *   `createGradient` kontroler sam dba o `dispose()` poprzedniej tekstury),
 * - pedestal i kadr: natychmiast,
 * - sync z motywem: theme → preset tylko gdy user nie wybrał presetu ręcznie (Open Q2).
 */
import * as THREE from 'three';
import { SettingsStore } from '../app/store/settings-store';
import { TypedEventBus, Unsub } from '../app/events';
import { AppEvents } from '../app/app-types';
import { getScenePreset, ScenePreset } from './scene-presets';

export interface LightTarget {
  intensity: number;
  color: THREE.Color;
}

export interface ScenePresetHost {
  key: LightTarget;
  fill: LightTarget;
  rim: LightTarget;
  ambient: { intensity: number };
  setBackgroundColor(hex: number): void;
  setGradientBackground?(from: number, to: number): void;
  setBackgroundTexture?(texture: THREE.Texture): void;
  setPedestal(visible: boolean): void;
  setFraming(framing: 'bust' | 'head'): void;
  getExposure(): number;
  setExposure(value: number): void;
}

export interface ScenePresetControllerDeps {
  host: ScenePresetHost;
  store: SettingsStore;
  events: TypedEventBus<AppEvents>;
  createGradient?: (from: number, to: number) => THREE.Texture;
  reducedMotion?: () => boolean;
  tweenMs?: number;
}

interface LightSnapshot {
  intensity: number;
  color: THREE.Color;
}

interface Snapshot {
  key: LightSnapshot;
  fill: LightSnapshot;
  rim: LightSnapshot;
  ambient: number;
  exposure: number;
}

export class ScenePresetController {
  private readonly host: ScenePresetHost;
  private readonly store: SettingsStore;
  private readonly events: TypedEventBus<AppEvents>;
  private readonly createGradient?: (from: number, to: number) => THREE.Texture;
  private readonly reducedMotion: () => boolean;
  private readonly tweenSeconds: number;

  private currentId: string;
  private target: ScenePreset | null = null;
  private from: Snapshot | null = null;
  private progress = 1;
  private gradientTexture: THREE.Texture | null = null;
  private readonly subscriptions: Unsub[] = [];

  constructor(deps: ScenePresetControllerDeps) {
    this.host = deps.host;
    this.store = deps.store;
    this.events = deps.events;
    this.createGradient = deps.createGradient;
    this.reducedMotion =
      deps.reducedMotion ??
      (() =>
        typeof window !== 'undefined' && typeof window.matchMedia === 'function'
          ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
          : false);
    this.tweenSeconds = (deps.tweenMs ?? 280) / 1000;
    this.currentId = this.store.getEffective<string>('scenePreset');
    this.subscriptions.push(
      this.events.on('scene:preset', (id) => {
        this.currentId = id;
      })
    );
  }

  public list(): ScenePreset[] {
    return [getScenePreset('studio-dark'), getScenePreset('studio-soft'), getScenePreset('cinema'), getScenePreset('light')];
  }

  public getCurrentId(): string {
    return this.currentId;
  }

  public apply(id: string): void {
    const preset = getScenePreset(id);
    this.currentId = preset.id;

    // Tło natychmiast (color / gradient z własnym dispose).
    if (preset.background.type === 'color') {
      this.host.setBackgroundColor(preset.background.value);
      this.disposeGradient();
    } else if (this.createGradient && this.host.setBackgroundTexture) {
      const texture = this.createGradient(preset.background.from, preset.background.to);
      this.host.setBackgroundTexture(texture);
      this.disposeGradient();
      this.gradientTexture = texture;
    } else {
      this.host.setGradientBackground?.(preset.background.from, preset.background.to);
      this.disposeGradient();
    }

    // Pedestal i kadr natychmiast.
    this.host.setPedestal(preset.pedestal);
    this.host.setFraming(preset.framing);

    // Światła: tween (albo instant przy reduced-motion).
    this.from = this.snapshot();
    this.target = preset;
    this.progress = this.reducedMotion() ? 1 : 0;
    if (this.progress === 1) {
      this.applySnapshot(preset);
    }
    this.events.emit('scene:preset', preset.id);
  }

  public update(dt: number): void {
    if (this.progress >= 1 || !this.target || !this.from) return;
    this.progress = Math.min(1, this.progress + dt / this.tweenSeconds);
    const t = this.easeInOut(this.progress);
    this.host.key.intensity = this.lerp(this.from.key.intensity, this.target.key.intensity, t);
    this.host.fill.intensity = this.lerp(this.from.fill.intensity, this.target.fill.intensity, t);
    this.host.rim.intensity = this.lerp(this.from.rim.intensity, this.target.rim.intensity, t);
    this.host.ambient.intensity = this.lerp(this.from.ambient, this.target.ambient, t);
    this.host.setExposure(this.lerp(this.from.exposure, this.target.exposure, t));
    this.host.key.color.copy(this.from.key.color).lerp(new THREE.Color(this.target.key.color), t);
    this.host.fill.color.copy(this.from.fill.color).lerp(new THREE.Color(this.target.fill.color), t);
    this.host.rim.color.copy(this.from.rim.color).lerp(new THREE.Color(this.target.rim.color), t);
    if (this.progress >= 1 && this.target) {
      this.applySnapshot(this.target);
    }
  }

  /** Sync motywu: sugeruje preset tylko, gdy user nie wybrał presetu ręcznie (Open Q2). */
  public onThemeChange(theme: 'dark' | 'light'): void {
    if (this.store.getEffective<boolean>('scenePresetManual') === true) return;
    const want = theme === 'light' ? 'light' : this.currentId === 'light' ? 'studio-dark' : this.currentId;
    if (want !== this.currentId) {
      this.apply(want);
    }
  }

  public dispose(): void {
    for (const unsub of this.subscriptions.splice(0)) {
      unsub();
    }
    this.disposeGradient();
  }

  private snapshot(): Snapshot {
    return {
      key: { intensity: this.host.key.intensity, color: this.host.key.color.clone() },
      fill: { intensity: this.host.fill.intensity, color: this.host.fill.color.clone() },
      rim: { intensity: this.host.rim.intensity, color: this.host.rim.color.clone() },
      ambient: this.host.ambient.intensity,
      exposure: this.host.getExposure(),
    };
  }

  private applySnapshot(preset: ScenePreset): void {
    this.host.key.intensity = preset.key.intensity;
    this.host.key.color.setHex(preset.key.color);
    this.host.fill.intensity = preset.fill.intensity;
    this.host.fill.color.setHex(preset.fill.color);
    this.host.rim.intensity = preset.rim.intensity;
    this.host.rim.color.setHex(preset.rim.color);
    this.host.ambient.intensity = preset.ambient;
    this.host.setExposure(preset.exposure);
  }

  private disposeGradient(): void {
    if (this.gradientTexture) {
      this.gradientTexture.dispose();
      this.gradientTexture = null;
    }
  }

  private lerp(from: number, to: number, t: number): number {
    return from + (to - from) * t;
  }

  private easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  }
}
