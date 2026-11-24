/**
 * Migration of legacy localStorage → the `avatar_settings_v1` blob (Phase 11).
 *
 * Contract (11-01):
 * - reads legacy ONLY when the blob does not exist (idempotence),
 * - before the first write creates a backup `avatar_settings_backup_<ts>` of the raw keys,
 * - a corrupted JSON in one field does not abort the migration (default for that field, the rest kept),
 * - `avatar_settings_mic_sensitivity` is ignored (dead field, UI-05),
 * - legacy keys are NOT removed (write-through mirror until 11-04).
 */
import {
  SettingsStateV1,
  StorageLike,
  validateSettings,
} from './settings-schema';
import {
  DEFAULT_CALIBRATION_PROFILE,
} from '../../lipsync/calibration';
import { DEFAULT_LIP_SYNC_ENGINE, parseLipSyncEngine } from '../../lipsync/lipsync-engine';

export const BLOB_KEY = 'avatar_settings_v1';

/** Map: logical field → legacy key (mirrored in legacy-bridge). */
export const LEGACY_KEYS = {
  calibration: 'avatar_lip_calibration_profile_v3',
  visemeOverrides: 'avatar_viseme_overrides_v1',
  lipSyncEngine: 'avatar_lipsync_engine',
  animationSource: 'avatar_anim_source',
  agentId: 'elevenlabs_agent_id',
  theme: 'avatar_settings_theme',
  volume: 'avatar_settings_volume',
  a2fUrl: 'avatar_a2f_url',
} as const;


function readRaw(storage: StorageLike, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    console.warn('[Migrate] Corrupted JSON in a legacy key — using the default field value:', error);
    return undefined;
  }
}

/**
 * Builds the v1 blob from legacy keys. Returns `null` when the blob already exists.
 * On success it saves the backup and the blob to storage.
 */
export function migrateLegacy(storage: StorageLike, now: () => number = Date.now): SettingsStateV1 | null {
  if (readRaw(storage, BLOB_KEY) !== null) return null;

  const rawCalibration = readRaw(storage, LEGACY_KEYS.calibration);
  const rawOverrides = readRaw(storage, LEGACY_KEYS.visemeOverrides);
  const rawEngine = readRaw(storage, LEGACY_KEYS.lipSyncEngine);
  const rawAnimSource = readRaw(storage, LEGACY_KEYS.animationSource);
  const rawAgentId = readRaw(storage, LEGACY_KEYS.agentId);
  const rawTheme = readRaw(storage, LEGACY_KEYS.theme);
  const rawVolume = readRaw(storage, LEGACY_KEYS.volume);
  const rawA2fUrl = readRaw(storage, LEGACY_KEYS.a2fUrl);

  const parsedCalibration = parseJson(rawCalibration);
  const candidate: Record<string, unknown> = {
    schemaVersion: 1,
    user: {
      theme: rawTheme === 'dark' || rawTheme === 'light' ? rawTheme : undefined,
      volume: rawVolume !== null ? Number.parseFloat(rawVolume) : undefined,
      animationSource: typeof rawAnimSource === 'string' && rawAnimSource.trim() !== '' ? rawAnimSource : undefined,
    },
    studio: {
      agentId: typeof rawAgentId === 'string' ? rawAgentId : undefined,
      a2fUrl: typeof rawA2fUrl === 'string' ? rawA2fUrl : undefined,
      lipSyncEngine: parseLipSyncEngine(rawEngine),
      calibration: parsedCalibration,
      visemeOverrides: parseJson(rawOverrides),
    },
  };

  const result = validateSettings(candidate);
  const state: SettingsStateV1 = result.ok ? result.value : { ...validateDefaults() };
  if (!result.ok) {
    console.warn('[Migrate] Post-migration validation failed — using defaults:', result.error);
  }

  try {
    const backup: Record<string, string> = {};
    for (const key of Object.values(LEGACY_KEYS)) {
      const value = readRaw(storage, key);
      if (value !== null) backup[key] = value;
    }
    if (Object.keys(backup).length > 0) {
      storage.setItem(`avatar_settings_backup_${now()}`, JSON.stringify(backup));
    }
    storage.setItem(BLOB_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('[Migrate] Could not save the settings backup/blob:', error);
  }

  return state;
}

function validateDefaults(): SettingsStateV1 {
  const fallback = validateSettings({ schemaVersion: 1 });
  if (fallback.ok) return fallback.value;
  // validateSettings cannot fail on a valid object — a type safeguard.
  return {
    schemaVersion: 1,
    user: {
      uiMode: 'user',
      volume: 1,
      theme: 'dark',
      scenePreset: 'studio-dark',
      scenePresetManual: false,
      animationSource: 'viseme',
      micDeviceId: null,
    },
    studio: {
      agentId: '',
      a2fUrl: 'http://127.0.0.1:8000',
      lipSyncEngine: DEFAULT_LIP_SYNC_ENGINE,
      calibration: { ...DEFAULT_CALIBRATION_PROFILE },
      visemeOverrides: {},
      locks: {},
    },
  };
}
