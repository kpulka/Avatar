/**
 * Legacy bridge (Phase 11, transitional stage): write-through store → old localStorage keys.
 *
 * WHAT: mirrors the SettingsStore blob back into the pre-F11 localStorage keys (`LEGACY_KEYS` in
 * migrate.ts, which holds the one-shot legacy → blob direction). Reason: modules written before
 * the store still read those keys directly, and the bridge keeps them consistent with the blob so
 * there is no split-brain. Today the one live reader is `loadVisemeOverrides()` (lipsync/
 * viseme-overrides.ts, called by the FaceController constructor); the calibration, engine, theme,
 * volume, animation-source and A2F-URL keys are mirrored but nothing in the production call graph reads them (`loadCalibrationProfile` exists but has no caller).
 *
 * REMOVE WHEN (both):
 *   (a) v1.1 has been public for one full milestone cycle, so users coming from a pre-F11 build
 *       have already been migrated by `migrateLegacy` on their first store read; AND
 *   (b) no module reads a legacy key directly: `FaceController` takes the viseme overrides from the
 *       SettingsStore (injected), and `loadCalibrationProfile` / `saveCalibrationProfile` /
 *       `loadVisemeOverrides` / `saveVisemeOverrides` (lipsync/) are deleted or re-pointed at the store.
 *
 * REMOVE HOW: keep `migrateLegacy` (it is the one-shot upgrade path and stays in migrate.ts);
 * delete this file, the `attachLegacyBridge` import and call in `app/container.ts` together with
 * its `unsubLegacyBridge` entry in `dispose()`, drop the `importableBy: ['app-root']` entry for this
 * file in tests/layering-rules.ts, and extend tests/settings-store.test.ts so the legacy-key
 * fixtures assert the migration alone.
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
