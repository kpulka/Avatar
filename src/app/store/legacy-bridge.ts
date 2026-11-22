/**
 * Legacy bridge (Phase 11, transitional stage): write-through store → old localStorage keys.
 *
 * Reason: during the transitional period of phase 11 the old modules read the legacy
 * keys. The bridge keeps them consistent with the blob so there is no split-brain.
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
      // agentId is NOT mirrored: SettingsStore is the single source (Phase 11.1 D-9).
      storage.setItem(LEGACY_KEYS.theme, state.user.theme);
      storage.setItem(LEGACY_KEYS.volume, String(state.user.volume));
      storage.setItem(LEGACY_KEYS.a2fUrl, state.studio.a2fUrl);
    } catch (error) {
      console.warn('[LegacyBridge] Could not synchronize the legacy keys:', error);
    }
  };

  // Mirror the state after migration — old modules see fresh values from the first read.
  sync(store.getState());
  return store.subscribe(sync);
}
