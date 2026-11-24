/**
 * Shared jsdom fixtures for UI tests (Phase 15): a fake PanelContext with spy-able services.
 */
import { vi } from 'vitest';
import { TypedEventBus } from '../../src/app/events';
import { AppEvents, AppServices } from '../../src/app/app-types';
import { SettingsStore } from '../../src/app/store/settings-store';
import { PanelContext, PanelUi } from '../../src/ui/studio/panel-registry';
import { DEFAULT_CALIBRATION_PROFILE } from '../../src/lipsync/calibration';
import { createMemoryStorage } from './memory-storage';

export interface UiFixture {
  ctx: PanelContext;
  events: TypedEventBus<AppEvents>;
  store: SettingsStore;
  host: HTMLElement;
  /** Content passed to the last `ui.modal.open` call. */
  modalCalls: Array<{ title: string; content: HTMLElement }>;
  spies: {
    toast: ReturnType<typeof vi.fn>;
    loaderShow: ReturnType<typeof vi.fn>;
    loaderHide: ReturnType<typeof vi.fn>;
    modalClose: ReturnType<typeof vi.fn>;
    compareRun: ReturnType<typeof vi.fn>;
    compareCancel: ReturnType<typeof vi.fn>;
    conversationToggle: ReturnType<typeof vi.fn>;
    conversationStart: ReturnType<typeof vi.fn>;
    loadDemo: ReturnType<typeof vi.fn>;
    uiModeSet: ReturnType<typeof vi.fn>;
  };
}

export interface FixtureOptions {
  canCompare?: boolean;
  compareState?: string;
  source?: 'viseme' | 'frames';
  uiMode?: 'user' | 'studio';
  locks?: string[];
}

export function createUiFixture(options: FixtureOptions = {}): UiFixture {
  document.body.replaceChildren();
  const host = document.createElement('div');
  document.body.append(host);

  const events = new TypedEventBus<AppEvents>();
  const store = new SettingsStore(createMemoryStorage() as unknown as Storage);
  for (const key of options.locks ?? []) store.setLock(key, true);

  const spies = {
    toast: vi.fn(),
    loaderShow: vi.fn(),
    loaderHide: vi.fn(),
    modalClose: vi.fn(),
    compareRun: vi.fn(async () => true),
    compareCancel: vi.fn(),
    conversationToggle: vi.fn(async () => undefined),
    conversationStart: vi.fn(async () => undefined),
    loadDemo: vi.fn(),
    uiModeSet: vi.fn(),
  };
  const modalCalls: UiFixture['modalCalls'] = [];

  let mode: 'user' | 'studio' = options.uiMode ?? 'user';
  const services = {
    conversation: {
      start: spies.conversationStart,
      stop: vi.fn(async () => undefined),
      toggle: spies.conversationToggle,
      toggleMute: vi.fn(),
      isMuted: () => false,
      isRunning: () => false,
      interrupt: vi.fn(),
      say: vi.fn(),
      setInputDevice: vi.fn(),
      listInputDevices: vi.fn(async () => [{ id: 'mic-1', label: 'Mic 1' }]),
      runPocStress: vi.fn(async () => undefined),
    },
    animation: {
      getSource: () => options.source ?? 'viseme',
      setSource: vi.fn(),
      updateCalibrationSliders: () => DEFAULT_CALIBRATION_PROFILE,
      resetCalibration: () => DEFAULT_CALIBRATION_PROFILE,
      setCalibration: vi.fn(),
      applyPreset: vi.fn(),
      saveCalibration: vi.fn(),
      setLipSyncEngine: vi.fn(),
      testPhrase: vi.fn(),
      testPhoneme: vi.fn(),
      demoSpeech: vi.fn(),
      runA2fDemo: vi.fn(async () => undefined),
      applyVisemeOverrides: vi.fn(),
      previewViseme: vi.fn(),
      setManualOverride: vi.fn(),
      resetMorphs: vi.fn(),
    },
    animationSources: {
      list: () => [
        { id: 'viseme', label: 'LIVE visemes', short: 'LIVE', apply: vi.fn() },
        { id: 'frames', label: 'A2F frames', short: 'A2F', apply: vi.fn() },
      ],
      get: (id: string) =>
        id === 'frames'
          ? { id: 'frames', label: 'A2F frames', short: 'A2F', apply: vi.fn() }
          : { id: 'viseme', label: 'LIVE visemes', short: 'LIVE', apply: vi.fn() },
    },
    compare: {
      run: spies.compareRun,
      cancel: spies.compareCancel,
      canCompare: () => options.canCompare ?? true,
      getState: () => options.compareState ?? 'idle',
    },
    lastTurn: { hasTurn: () => true },
    scenePresets: {
      apply: vi.fn(),
      list: () => [
        { id: 'studio-dark', label: 'Studio Dark' },
        { id: 'studio-soft', label: 'Studio Soft' },
        { id: 'cinema', label: 'Cinema' },
        { id: 'light', label: 'Light' },
      ],
      getCurrentId: () => 'studio-dark',
    },
    scene: {
      loadDemo: spies.loadDemo,
      loadFile: vi.fn(async () => undefined),
      pointerMove: vi.fn(),
      getAvatarInfo: () => null,
    },
    telemetry: {
      sample: () => ({
        ttfbMs: null,
        bargeInCount: 0,
        session: '00:00',
        align: { elevenlabs: 0, fallback: 0 },
        fps: 60,
        frameTimeMs: 16,
      }),
    },
    uiMode: {
      getMode: () => mode,
      set: (next: 'user' | 'studio') => {
        mode = next;
        spies.uiModeSet(next);
      },
      toggle: () => {
        mode = mode === 'user' ? 'studio' : 'user';
      },
    },
  } as unknown as AppServices;

  const ui: PanelUi = {
    toast: { show: spies.toast, hide: vi.fn(), destroy: vi.fn() },
    loader: { show: spies.loaderShow, error: vi.fn(), hide: spies.loaderHide, destroy: vi.fn() },
    modal: {
      open: (title: string, content: HTMLElement) => {
        modalCalls.push({ title, content });
      },
      close: spies.modalClose,
      isOpen: () => false,
      destroy: vi.fn(),
    },
  };

  const ctx: PanelContext = { store, events, services, ui, container: host };
  return { ctx, events, store, host, modalCalls, spies };
}
