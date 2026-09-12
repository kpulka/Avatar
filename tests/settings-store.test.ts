import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  MAX_VISEME_OVERRIDES,
  validateSettings,
} from '../src/app/store/settings-schema';
import { BLOB_KEY, LEGACY_KEYS, migrateLegacy } from '../src/app/store/migrate';
import { SettingsStore } from '../src/app/store/settings-store';
import { attachLegacyBridge } from '../src/app/store/legacy-bridge';
import { DEFAULT_CALIBRATION_PROFILE, CALIBRATION_PRESETS } from '../src/lipsync/calibration';
import { createMemoryStorage } from './helpers/memory-storage';

function buildOverrides(count: number): Record<string, Record<string, number>> {
  const map: Record<string, Record<string, number>> = {};
  for (let i = 0; i < count; i += 1) {
    map[`V${i}`] = { jawOpen: 0.5 };
  }
  return map;
}

describe('validateSettings (schema)', () => {
  it('odrzuca klucze zarezerwowane i nie pozwala zatruć prototypu', () => {
    const evil = JSON.parse('{"__proto__":{"polluted":true}}') as unknown;
    const result = validateSettings(evil);
    expect(result.ok).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
  });

  it('klamuje volume i waliduje URL A2F', () => {
    const high = validateSettings({ schemaVersion: 1, user: { volume: 1.5 } });
    expect(high.ok && high.value.user.volume).toBe(1);
    const low = validateSettings({ schemaVersion: 1, user: { volume: -0.2 } });
    expect(low.ok && low.value.user.volume).toBe(0);

    const bad = validateSettings({ schemaVersion: 1, studio: { a2fUrl: 'javascript:alert(1)' } });
    expect(bad.ok && bad.value.studio.a2fUrl).toBe(DEFAULT_SETTINGS.studio.a2fUrl);
    const good = validateSettings({ schemaVersion: 1, studio: { a2fUrl: 'http://127.0.0.1:8000' } });
    expect(good.ok && good.value.studio.a2fUrl).toBe('http://127.0.0.1:8000');
  });

  it('limit mapy nadpisań wizemów: 511 przechodzi, 600 jest odrzucane', () => {
    const small = validateSettings({ schemaVersion: 1, studio: { visemeOverrides: buildOverrides(MAX_VISEME_OVERRIDES - 1) } });
    expect(small.ok).toBe(true);
    if (small.ok) {
      expect(Object.keys(small.value.studio.visemeOverrides)).toHaveLength(MAX_VISEME_OVERRIDES - 1);
    }
    const big = validateSettings({ schemaVersion: 1, studio: { visemeOverrides: buildOverrides(600) } });
    expect(big.ok).toBe(true);
    if (big.ok) {
      expect(Object.keys(big.value.studio.visemeOverrides)).toHaveLength(0);
    }
  });

  it('nie zna martwego pola micSensitivity', () => {
    expect('micSensitivity' in DEFAULT_SETTINGS.user).toBe(false);
    expect('micSensitivity' in DEFAULT_SETTINGS.studio).toBe(false);
  });

  it('odrzuca nieobsługiwaną wersję schematu', () => {
    const result = validateSettings({ schemaVersion: 99 });
    expect(result.ok).toBe(false);
  });
});

describe('migrateLegacy', () => {
  const fullProfile = CALIBRATION_PRESETS.expressive;

  function seedLegacy() {
    return createMemoryStorage({
      [LEGACY_KEYS.calibration]: JSON.stringify(fullProfile),
      [LEGACY_KEYS.visemeOverrides]: JSON.stringify({ AA: { jawOpen: 0.5, mouthPucker: 0.25 } }),
      [LEGACY_KEYS.lipSyncEngine]: 'char',
      [LEGACY_KEYS.animationSource]: 'frames',
      [LEGACY_KEYS.agentId]: 'agent_legacy',
      [LEGACY_KEYS.theme]: 'light',
      [LEGACY_KEYS.volume]: '0.5',
      [LEGACY_KEYS.a2fUrl]: 'http://localhost:9000',
      avatar_settings_mic_sensitivity: '1.5',
    });
  }

  it('przenosi legacy bez utraty kalibracji i wizemów + robi backup + zapisuje blob', () => {
    const storage = seedLegacy();
    const state = migrateLegacy(storage, () => 1234567890);
    expect(state).not.toBeNull();
    if (!state) return;

    for (const key of Object.keys(DEFAULT_CALIBRATION_PROFILE) as Array<keyof typeof fullProfile>) {
      expect(state.studio.calibration[key]).toBe(fullProfile[key]);
    }
    expect(state.studio.visemeOverrides).toEqual({ AA: { jawOpen: 0.5, mouthPucker: 0.25 } });
    expect(state.studio.lipSyncEngine).toBe('char');
    expect(state.user.animationSource).toBe('frames');
    expect(state.studio.agentId).toBe('agent_legacy');
    expect(state.user.theme).toBe('light');
    expect(state.user.volume).toBe(0.5);
    expect(state.studio.a2fUrl).toBe('http://localhost:9000');

    const dump = storage.dump();
    expect(dump[BLOB_KEY]).toBeDefined();
    expect(Object.keys(dump).some((key) => key.startsWith('avatar_settings_backup_'))).toBe(true);
    expect('micSensitivity' in state.user).toBe(false);
  });

  it('jest idempotentna — drugie wywołanie zwraca null', () => {
    const storage = seedLegacy();
    expect(migrateLegacy(storage)).not.toBeNull();
    expect(migrateLegacy(storage)).toBeNull();
  });

  it('uszkodzony JSON kalibracji nie przerywa migracji (default pola, reszta zachowana)', () => {
    const storage = createMemoryStorage({
      [LEGACY_KEYS.calibration]: '{oops',
      [LEGACY_KEYS.agentId]: 'agent_ok',
      [LEGACY_KEYS.volume]: '0.8',
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const state = migrateLegacy(storage);
    warn.mockRestore();

    expect(state).not.toBeNull();
    expect(state?.studio.calibration).toEqual(DEFAULT_CALIBRATION_PROFILE);
    expect(state?.studio.agentId).toBe('agent_ok');
    expect(state?.user.volume).toBe(0.8);
  });
});

describe('SettingsStore', () => {
  it('stosuje precedencję defaults → studio → user', () => {
    const store = new SettingsStore(createMemoryStorage());
    expect(store.getEffective('volume')).toBe(1);
    expect(store.getEffective('a2fUrl')).toBe(DEFAULT_SETTINGS.studio.a2fUrl);

    store.setStudio('agentId', 'agent_x');
    expect(store.getEffective('agentId')).toBe('agent_x');

    store.setUser('theme', 'light');
    expect(store.getEffective('theme')).toBe('light');
  });

  it('lock blokuje setUser, a wartość efektywna się nie zmienia', () => {
    const store = new SettingsStore(createMemoryStorage());
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    store.setLock('volume', true);
    const before = store.getEffective('volume');
    store.setUser('volume', 0.3);
    expect(store.getEffective('volume')).toBe(before);
    expect(store.isLocked('volume')).toBe(true);
    warn.mockRestore();

    store.setLock('volume', false);
    store.setUser('volume', 0.3);
    expect(store.getEffective('volume')).toBeCloseTo(0.3);
  });

  it('ignoruje nieznane ścieżki zapisu', () => {
    const store = new SettingsStore(createMemoryStorage());
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const before = JSON.stringify(store.getState());
    store.setUser('nope', 1);
    store.setStudio('nope', 1);
    expect(JSON.stringify(store.getState())).toBe(before);
    warn.mockRestore();
  });

  it('persystuje stan między instancjami', () => {
    const storage = createMemoryStorage();
    const store = new SettingsStore(storage);
    store.setUser('volume', 0.7);
    store.setStudio('lipSyncEngine', 'char');

    const restored = new SettingsStore(storage);
    expect(restored.getEffective('volume')).toBeCloseTo(0.7);
    expect(restored.getEffective('lipSyncEngine')).toBe('char');
  });

  it('export → import jest round-tripem', () => {
    const store = new SettingsStore(createMemoryStorage());
    store.setUser('volume', 0.42);
    store.setUser('scenePreset', 'cinema');
    store.setUser('scenePresetManual', true);
    store.setStudio('a2fUrl', 'https://a2f.example.com');
    store.setStudio('lipSyncEngine', 'char');
    store.setLock('theme', true);

    const json = store.exportProfile();
    const fresh = new SettingsStore(createMemoryStorage());
    const result = fresh.importProfile(json);

    expect(result.ok).toBe(true);
    expect(fresh.getEffective('volume')).toBeCloseTo(0.42);
    expect(fresh.getEffective('scenePreset')).toBe('cinema');
    expect(fresh.getEffective('a2fUrl')).toBe('https://a2f.example.com');
    expect(fresh.isLocked('theme')).toBe(true);
    expect(fresh.getState()).toEqual(store.getState());
  });

  it('odrzuca zły JSON i zatruty import bez zmiany stanu', () => {
    const store = new SettingsStore(createMemoryStorage());
    const before = JSON.stringify(store.getState());

    expect(store.importProfile('to nie json').ok).toBe(false);
    expect(store.importProfile('{"__proto__":{"x":1}}').ok).toBe(false);
    expect(JSON.stringify(store.getState())).toBe(before);
  });

  it('reset przywraca defaulty', () => {
    const store = new SettingsStore(createMemoryStorage());
    store.setUser('volume', 0.1);
    store.setLock('volume', true);
    store.reset();
    expect(store.getEffective('volume')).toBe(1);
    expect(store.isLocked('volume')).toBe(false);
  });
});

describe('legacy bridge (write-through)', () => {
  it('zapisuje zmiany store do kluczy legacy bez pętli', () => {
    const storage = createMemoryStorage();
    const store = new SettingsStore(storage);
    attachLegacyBridge(store, storage);

    store.setStudio('lipSyncEngine', 'char');
    expect(storage.getItem(LEGACY_KEYS.lipSyncEngine)).toBe('char');

    store.setUser('animationSource', 'frames');
    expect(storage.getItem(LEGACY_KEYS.animationSource)).toBe('frames');

    const listener = vi.fn();
    store.subscribe(listener);
    store.setUser('volume', 0.5);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('most synchronizuje stan początkowy (po migracji)', () => {
    const storage = createMemoryStorage({ [LEGACY_KEYS.agentId]: 'agent_seed' });
    const store = new SettingsStore(storage);
    attachLegacyBridge(store, storage);
    expect(storage.getItem(LEGACY_KEYS.calibration)).toBeDefined();
    const parsed = JSON.parse(storage.getItem(LEGACY_KEYS.calibration) ?? '{}') as Record<string, number>;
    expect(parsed.jawScale).toBe(DEFAULT_CALIBRATION_PROFILE.jawScale);
  });
});
