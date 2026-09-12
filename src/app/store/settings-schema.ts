/**
 * Schemat i walidacja ustawień aplikacji (Faza 11 — SettingsStore v1).
 *
 * Zasady:
 * - jedno źródło prawdy dla kluczy localStorage (blob `avatar_settings_v1`),
 * - odczyt traktowany jako UNTRUSTED: whitelist kluczy, clampy, limity map, odrzucanie
 *   kluczy zarezerwowanych (`__proto__`/`constructor`/`prototype`) — ochrona przed
 *   prototype pollution i DoS przez import (ASVS L1, T-11-01/T-11-02),
 * - brak martwego pola czułości mikrofonu (usunięte w F11, UI-05).
 */
import { CalibrationProfile, DEFAULT_CALIBRATION_PROFILE } from '../../lipsync/calibration';
import { VisemeOverrideMap } from '../../lipsync/viseme-overrides';
import { DEFAULT_AGENT_CONFIG } from '../../audio/agent-config';

/** Domyślny adres lokalnego wrappera A2F (docelowo także cloud w Fazie 10). */
export const DEFAULT_A2F_URL = 'http://127.0.0.1:8000';

/** Maksymalna liczba wpisów nadpisań wizemów (ochrona przed DoS, T-11-02). */
export const MAX_VISEME_OVERRIDES = 512;

const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export type UiMode = 'user' | 'studio';
export type ThemeMode = 'dark' | 'light';
export type LipSyncEngine = 'phoneme' | 'char';

export interface UserSettings {
  uiMode: UiMode;
  volume: number;
  theme: ThemeMode;
  scenePreset: string;
  scenePresetManual: boolean;
  animationSource: string;
  micDeviceId: string | null;
}

export interface StudioSettings {
  agentId: string;
  a2fUrl: string;
  lipSyncEngine: LipSyncEngine;
  calibration: CalibrationProfile;
  visemeOverrides: VisemeOverrideMap;
  /** Klucz = ścieżka ustawienia (np. 'volume'); true = user nie może zmienić. */
  locks: Record<string, boolean>;
}

export interface SettingsStateV1 {
  schemaVersion: 1;
  user: UserSettings;
  studio: StudioSettings;
}

/** Interfejs kompatybilny z localStorage (wstrzykiwany — testy w env node). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const DEFAULT_SETTINGS: SettingsStateV1 = {
  schemaVersion: 1,
  user: {
    uiMode: 'user',
    volume: 1.0,
    theme: 'dark',
    scenePreset: 'studio-dark',
    scenePresetManual: false,
    animationSource: 'viseme',
    micDeviceId: null,
  },
  studio: {
    agentId: DEFAULT_AGENT_CONFIG.agentId,
    a2fUrl: DEFAULT_A2F_URL,
    lipSyncEngine: 'phoneme',
    calibration: { ...DEFAULT_CALIBRATION_PROFILE },
    visemeOverrides: {},
    locks: {},
  },
};

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS.user.volume;
  return Math.max(0, Math.min(1, value));
}

export function isValidA2fUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '') return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasReservedKeys(source: Record<string, unknown>): boolean {
  return Object.keys(source).some((key) => RESERVED_KEYS.has(key));
}

function sanitizeCalibration(value: unknown): CalibrationProfile {
  if (!isRecord(value) || hasReservedKeys(value)) {
    return { ...DEFAULT_CALIBRATION_PROFILE };
  }
  const profile: CalibrationProfile = { ...DEFAULT_CALIBRATION_PROFILE };
  for (const key of Object.keys(DEFAULT_CALIBRATION_PROFILE) as Array<keyof CalibrationProfile>) {
    const raw = value[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      profile[key] = raw;
    }
  }
  return profile;
}

function sanitizeVisemeOverrides(value: unknown): VisemeOverrideMap {
  const result: VisemeOverrideMap = Object.create(null);
  if (!isRecord(value)) return result;
  if (hasReservedKeys(value)) return result;
  let total = 0;
  for (const [visemeKey, shapesRaw] of Object.entries(value)) {
    if (RESERVED_KEYS.has(visemeKey)) return Object.create(null);
    if (!isRecord(shapesRaw) || hasReservedKeys(shapesRaw)) continue;
    const shapes: Record<string, number> = {};
    for (const [shapeKey, raw] of Object.entries(shapesRaw)) {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
      shapes[shapeKey] = Math.max(0, Math.min(1, raw));
      total += 1;
      if (total > MAX_VISEME_OVERRIDES) return Object.create(null);
    }
    result[visemeKey] = shapes;
  }
  return result;
}

function sanitizeLocks(value: unknown): Record<string, boolean> {
  const locks: Record<string, boolean> = Object.create(null);
  if (!isRecord(value)) return locks;
  for (const [key, raw] of Object.entries(value)) {
    if (RESERVED_KEYS.has(key)) continue;
    if (raw === true) locks[key] = true;
  }
  return locks;
}

/**
 * Waliduje nieznany obiekt do pełnego stanu v1 (merge z defaultami, clampy, whitelist).
 * Zwraca błąd tylko gdy wejście nie jest obiektem lub schemaVersion jest nieobsługiwana
 * albo wykryto klucze zarezerwowane na najwyższym poziomie.
 */
export function validateSettings(raw: unknown): { ok: true; value: SettingsStateV1 } | { ok: false; error: string } {
  if (!isRecord(raw)) {
    return { ok: false, error: 'Ustawienia muszą być obiektem JSON.' };
  }
  if (hasReservedKeys(raw)) {
    return { ok: false, error: 'Ustawienia zawierają zarezerwowane klucze (__proto__/constructor/prototype).' };
  }
  if (raw.schemaVersion !== undefined && raw.schemaVersion !== 1) {
    return { ok: false, error: `Nieobsługiwana wersja schematu: ${String(raw.schemaVersion)}.` };
  }

  const userRaw = isRecord(raw.user) && !hasReservedKeys(raw.user) ? raw.user : {};
  const studioRaw = isRecord(raw.studio) && !hasReservedKeys(raw.studio) ? raw.studio : {};

  const user: UserSettings = { ...DEFAULT_SETTINGS.user };
  if (userRaw.uiMode === 'user' || userRaw.uiMode === 'studio') user.uiMode = userRaw.uiMode;
  if (typeof userRaw.volume === 'number') user.volume = clampVolume(userRaw.volume);
  if (userRaw.theme === 'dark' || userRaw.theme === 'light') user.theme = userRaw.theme;
  if (typeof userRaw.scenePreset === 'string' && userRaw.scenePreset.trim() !== '') {
    user.scenePreset = userRaw.scenePreset.trim();
  }
  if (typeof userRaw.scenePresetManual === 'boolean') user.scenePresetManual = userRaw.scenePresetManual;
  if (typeof userRaw.animationSource === 'string' && userRaw.animationSource.trim() !== '') {
    user.animationSource = userRaw.animationSource.trim();
  }
  if (typeof userRaw.micDeviceId === 'string' && userRaw.micDeviceId.trim() !== '') {
    user.micDeviceId = userRaw.micDeviceId.trim();
  } else if (userRaw.micDeviceId === null) {
    user.micDeviceId = null;
  }

  const studio: StudioSettings = {
    agentId: DEFAULT_SETTINGS.studio.agentId,
    a2fUrl: DEFAULT_SETTINGS.studio.a2fUrl,
    lipSyncEngine: DEFAULT_SETTINGS.studio.lipSyncEngine,
    calibration: { ...DEFAULT_CALIBRATION_PROFILE },
    visemeOverrides: Object.create(null),
    locks: Object.create(null),
  };
  if (typeof studioRaw.agentId === 'string' && studioRaw.agentId.trim() !== '') {
    studio.agentId = studioRaw.agentId.trim();
  }
  if (typeof studioRaw.a2fUrl === 'string' && isValidA2fUrl(studioRaw.a2fUrl)) {
    studio.a2fUrl = studioRaw.a2fUrl.trim();
  }
  if (studioRaw.lipSyncEngine === 'phoneme' || studioRaw.lipSyncEngine === 'char') {
    studio.lipSyncEngine = studioRaw.lipSyncEngine;
  }
  studio.calibration = sanitizeCalibration(studioRaw.calibration);
  studio.visemeOverrides = sanitizeVisemeOverrides(studioRaw.visemeOverrides);
  studio.locks = sanitizeLocks(studioRaw.locks);

  return { ok: true, value: { schemaVersion: 1, user, studio } };
}
