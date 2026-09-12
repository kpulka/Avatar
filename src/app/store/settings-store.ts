/**
 * SettingsStore v1 (Faza 11): jeden schemat, precedencja defaults → studio → user,
 * locki, persistence (StorageLike), export/import profilu.
 *
 * Precedencja (F11; doprecyzowana po review A1 — lock zamraża bieżącą wartość):
 *   locked ? (klucz usera: user[key] ?? default | klucz studia: studio[key] ?? default)
 *          : (user[key] ?? studio[key] ?? default)
 *
 * `setUser` na zablokowanym kluczu jest no-op (UI-05).
 */
import {
  DEFAULT_SETTINGS,
  SettingsStateV1,
  StorageLike,
  UserSettings,
  StudioSettings,
  validateSettings,
} from './settings-schema';
import { BLOB_KEY, migrateLegacy } from './migrate';

export type Unsub = () => void;
export type SettingsListener = (state: SettingsStateV1) => void;

const USER_KEYS: ReadonlyArray<keyof UserSettings> = [
  'uiMode',
  'volume',
  'theme',
  'scenePreset',
  'scenePresetManual',
  'animationSource',
  'micDeviceId',
];

const STUDIO_KEYS: ReadonlyArray<keyof StudioSettings> = [
  'agentId',
  'a2fUrl',
  'lipSyncEngine',
  'calibration',
  'visemeOverrides',
  'locks',
];

function cloneState(state: SettingsStateV1): SettingsStateV1 {
  return JSON.parse(JSON.stringify(state)) as SettingsStateV1;
}

export class SettingsStore {
  private state: SettingsStateV1;
  private readonly listeners = new Set<SettingsListener>();

  constructor(
    private readonly storage: StorageLike,
    private readonly now: () => number = Date.now
  ) {
    this.state = this.loadInitialState();
  }

  private loadInitialState(): SettingsStateV1 {
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(BLOB_KEY);
    } catch {
      raw = null;
    }

    if (raw !== null) {
      try {
        const result = validateSettings(JSON.parse(raw) as unknown);
        if (result.ok) return result.value;
        console.warn('[SettingsStore] Zatruty blob ustawień — używam defaultów:', result.error);
      } catch (error) {
        console.warn('[SettingsStore] Uszkodzony JSON bloba ustawień — używam defaultów:', error);
      }
      return cloneState(DEFAULT_SETTINGS);
    }

    const migrated = migrateLegacy(this.storage, this.now);
    return migrated ?? cloneState(DEFAULT_SETTINGS);
  }

  public getState(): SettingsStateV1 {
    return cloneState(this.state);
  }

  public getEffective<T = unknown>(path: string): T {
    const locked = this.state.studio.locks[path] === true;
    const isUserKey = USER_KEYS.includes(path as keyof UserSettings);
    const userValue = (this.state.user as unknown as Record<string, unknown>)[path];
    const studioValue = (this.state.studio as unknown as Record<string, unknown>)[path];
    const defaults = (DEFAULT_SETTINGS.user as unknown as Record<string, unknown>)[path]
      ?? (DEFAULT_SETTINGS.studio as unknown as Record<string, unknown>)[path];
    // Lock zamraża BIEŻĄCĄ wartość klucza (CONTEXT:53,57): tweaker odbiera userowi
    // prawo zmiany, ale nie nadpisuje wartości własną. Klucze usera i studia są
    // rozłączne, więc źródłem wartości zamrożonej jest właściwy profil —
    // wcześniejsze `studioValue ?? defaults` dla klucza usera zrzucało go na default.
    const value = locked
      ? isUserKey
        ? userValue ?? defaults
        : studioValue ?? defaults
      : userValue ?? studioValue ?? defaults;
    return value as T;
  }

  public isLocked(path: string): boolean {
    return this.state.studio.locks[path] === true;
  }

  public setUser(path: string, value: unknown): void {
    if (!USER_KEYS.includes(path as keyof UserSettings)) {
      console.warn(`[SettingsStore] setUser: nieznana ścieżka '${path}' — ignoruję.`);
      return;
    }
    if (this.isLocked(path)) {
      console.warn(`[SettingsStore] setUser: '${path}' zablokowane przez studio — no-op.`);
      return;
    }
    this.update((draft) => {
      (draft.user as unknown as Record<string, unknown>)[path] = value;
    });
  }

  public setStudio(path: string, value: unknown): void {
    if (!STUDIO_KEYS.includes(path as keyof StudioSettings)) {
      console.warn(`[SettingsStore] setStudio: nieznana ścieżka '${path}' — ignoruję.`);
      return;
    }
    this.update((draft) => {
      (draft.studio as unknown as Record<string, unknown>)[path] = value;
    });
  }

  public setLock(path: string, locked: boolean): void {
    this.update((draft) => {
      if (locked) {
        draft.studio.locks[path] = true;
      } else {
        delete draft.studio.locks[path];
      }
    });
  }

  public subscribe(listener: SettingsListener): Unsub {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public exportProfile(): string {
    return JSON.stringify(
      {
        schemaVersion: 1,
        exportedAt: new Date(this.now()).toISOString(),
        profile: this.state,
      },
      null,
      2
    );
  }

  public importProfile(json: string): { ok: boolean; error?: string; value?: SettingsStateV1 } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json) as unknown;
    } catch {
      return { ok: false, error: 'Import nie powiódł się: to nie jest poprawny JSON.' };
    }

    const candidate =
      typeof parsed === 'object' && parsed !== null && 'profile' in (parsed as Record<string, unknown>)
        ? (parsed as Record<string, unknown>).profile
        : parsed;

    const result = validateSettings(candidate);
    if (!result.ok) {
      return { ok: false, error: `Import odrzucony: ${result.error}` };
    }

    this.state = result.value;
    this.persist();
    this.notify();
    return { ok: true, value: this.getState() };
  }

  public reset(): void {
    this.state = cloneState(DEFAULT_SETTINGS);
    this.persist();
    this.notify();
  }

  private update(mutator: (draft: SettingsStateV1) => void): void {
    const draft = cloneState(this.state);
    mutator(draft);
    const result = validateSettings(draft);
    if (!result.ok) {
      console.warn(`[SettingsStore] Zapis odrzucony przez walidację: ${result.error}`);
      return;
    }
    this.state = result.value;
    this.persist();
    this.notify();
  }

  private persist(): void {
    try {
      this.storage.setItem(BLOB_KEY, JSON.stringify(this.state));
    } catch (error) {
      console.warn('[SettingsStore] Nie udało się zapisać ustawień:', error);
    }
  }

  private notify(): void {
    const snapshot = this.getState();
    for (const listener of [...this.listeners]) {
      try {
        listener(snapshot);
      } catch (error) {
        console.warn('[SettingsStore] Błąd subskrybenta:', error);
      }
    }
  }
}
