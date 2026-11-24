/**
 * Application settings schema and validation (Phase 11 — SettingsStore v1).
 *
 * Rules:
 * - a single source of truth for the localStorage keys (the `avatar_settings_v1` blob),
 * - reads are treated as UNTRUSTED: key whitelist, clamps, map limits, rejection of
 *   reserved keys (`__proto__`/`constructor`/`prototype`) — protection against
 *   prototype pollution and DoS via import (ASVS L1, T-11-01/T-11-02),
 * - no dead microphone-sensitivity field (removed in F11, UI-05).
 */
import {
  CalibrationProfile,
  DEFAULT_CALIBRATION_PROFILE,
  LEGACY_SYNC_OFFSETS,
  SYNC_CLOCK_VERSION,
} from '../../lipsync/calibration';
import { VisemeOverrideMap } from '../../lipsync/viseme-overrides';
import { DEFAULT_LIP_SYNC_ENGINE, LipSyncEngine, parseLipSyncEngine } from '../../lipsync/lipsync-engine';
import { DEFAULT_AGENT_CONFIG } from '../../audio/agent-config';

/** Default address of the local A2F wrapper (eventually cloud too, in Phase 10). */
const DEFAULT_A2F_URL = 'http://127.0.0.1:8000';

/** Maximum number of viseme override entries (DoS protection, T-11-02). */
export const MAX_VISEME_OVERRIDES = 512;

const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export type UiMode = 'user' | 'studio';
export type ThemeMode = 'dark' | 'light';
export type { LipSyncEngine };

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
  /** Key = setting path (e.g. 'volume'); true = the user cannot change it. */
  locks: Record<string, boolean>;
}

export interface SettingsStateV1 {
  schemaVersion: 1;
  user: UserSettings;
  studio: StudioSettings;
}

/** localStorage-compatible interface (injected — tests run in a node env). */
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
    lipSyncEngine: DEFAULT_LIP_SYNC_ENGINE,
    calibration: { ...DEFAULT_CALIBRATION_PROFILE },
    visemeOverrides: {},
    locks: {},
  },
};

function clampVolume(value: number): number {
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
  return migrateSyncClock(profile, value);
}

const LEGACY_SYNC_OFFSET_MAP: Readonly<Record<number, number>> = { 90: 20, 100: 30, 120: 40 };

/**
 * One-time migration (Phase 11.2 D-6): offsets saved before the audible clock compensated for
 * ctx.currentTime. Preset values map to the new residuals; custom values lose the ~70 ms typical latency.
 */
function migrateSyncClock(profile: CalibrationProfile, stored: Record<string, unknown>): CalibrationProfile {
  if (stored.clockVersion === SYNC_CLOCK_VERSION) {
    profile.clockVersion = SYNC_CLOCK_VERSION;
    return profile;
  }
  const storedOffset = stored.syncOffsetMs;
  if (typeof storedOffset === 'number' && Number.isFinite(storedOffset)) {
    if ((LEGACY_SYNC_OFFSETS as readonly number[]).includes(storedOffset)) {
      profile.syncOffsetMs = LEGACY_SYNC_OFFSET_MAP[storedOffset] ?? profile.syncOffsetMs;
    } else {
      profile.syncOffsetMs = Math.max(-150, Math.min(400, storedOffset - 70));
    }
  }
  profile.clockVersion = SYNC_CLOCK_VERSION;
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
 * Validates an unknown object into a full v1 state (merge with defaults, clamps, whitelist).
 * Returns an error only when the input is not an object or the schemaVersion is unsupported
 * or reserved keys are detected at the top level.
 */
export function validateSettings(raw: unknown): { ok: true; value: SettingsStateV1 } | { ok: false; error: string } {
  if (!isRecord(raw)) {
    return { ok: false, error: 'Settings must be a JSON object.' };
  }
  if (hasReservedKeys(raw)) {
    return { ok: false, error: 'Settings contain reserved keys (__proto__/constructor/prototype).' };
  }
  if (raw.schemaVersion !== undefined && raw.schemaVersion !== 1) {
    return { ok: false, error: `Unsupported schema version: ${String(raw.schemaVersion)}.` };
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
  // Legacy 'phoneme' (pre 17-04) -> 'phoneme-en'; unknown values keep the default.
  const engine = parseLipSyncEngine(studioRaw.lipSyncEngine);
  if (engine !== undefined) studio.lipSyncEngine = engine;
  studio.calibration = sanitizeCalibration(studioRaw.calibration);
  studio.visemeOverrides = sanitizeVisemeOverrides(studioRaw.visemeOverrides);
  studio.locks = sanitizeLocks(studioRaw.locks);

  return { ok: true, value: { schemaVersion: 1, user, studio } };
}
