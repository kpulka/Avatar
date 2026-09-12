/**
 * Legacy bridge (Faza 11, etap przejściowy): write-through store → stare klucze localStorage.
 *
 * Powód: w okresie przejściowym fazy 11 stare moduły czytały klucze
 * legacy. Bridge utrzymuje je spójnymi z blobem, żeby nie było split-brain.
 */
import { SettingsStore } from './settings-store';
import { LEGACY_KEYS } from './migrate';
import { SettingsStateV1, StorageLike } from './settings-schema';
import { Unsub } from '../events';

export function attachLegacyBridge(store: SettingsStore, storage: StorageLike): Unsub {
  const sync = (state: SettingsStateV1): void => {
    try {
      storage.setItem(LEGACY_KEYS.calibration, JSON.stringify(state.studio.calibration));
      storage.setItem(LEGACY_KEYS.visemeOverrides, JSON.stringify(state.studio.visemeOverrides));
      storage.setItem(LEGACY_KEYS.lipSyncEngine, state.studio.lipSyncEngine);
      storage.setItem(LEGACY_KEYS.animationSource, state.user.animationSource);
      storage.setItem(LEGACY_KEYS.agentId, state.studio.agentId);
      storage.setItem(LEGACY_KEYS.theme, state.user.theme);
      storage.setItem(LEGACY_KEYS.volume, String(state.user.volume));
      storage.setItem(LEGACY_KEYS.a2fUrl, state.studio.a2fUrl);
    } catch (error) {
      console.warn('[LegacyBridge] Nie udało się zsynchronizować kluczy legacy:', error);
    }
  };

  // Mirror stanu po migracji — stare moduły widzą świeże wartości od pierwszego odczytu.
  sync(store.getState());
  return store.subscribe(sync);
}
