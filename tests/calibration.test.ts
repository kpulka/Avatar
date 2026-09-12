import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadCalibrationProfile,
  saveCalibrationProfile,
  resetCalibrationProfile,
  CALIBRATION_PRESETS,
  DEFAULT_CALIBRATION_PROFILE,
  CalibrationProfile,
} from '../src/lipsync/calibration';
import { VisemeScheduler } from '../src/lipsync/viseme-scheduler';

describe('Lip-Sync Calibration Module', () => {
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    for (const k in mockStorage) delete mockStorage[k];

    vi.stubGlobal('localStorage', {
      getItem: (k: string) => mockStorage[k] ?? null,
      setItem: (k: string, v: string) => {
        mockStorage[k] = v;
      },
      removeItem: (k: string) => {
        delete mockStorage[k];
      },
      clear: () => {
        for (const k in mockStorage) delete mockStorage[k];
      },
    });
  });

  it('loads default balanced profile when localStorage is empty', () => {
    const profile = loadCalibrationProfile();
    expect(profile).toEqual(DEFAULT_CALIBRATION_PROFILE);
    expect(profile.jawScale).toBe(1.0);
    expect(profile.closeScale).toBe(0.6);
    expect(profile.syncOffsetMs).toBe(100);
  });

  it('ignores legacy v1 localStorage profile (v2 key isolation -> automatic reset to DEFAULT)', () => {
    // Stary zapis pod kluczem v1 (semantyka 0.3-0.65 tłumików) nie może zatruć v2:
    const legacyV1: CalibrationProfile = {
      jawScale: 0.55,
      closeScale: 0.30,
      puckerScale: 0.50,
      funnelScale: 0.40,
      rollScale: 0.65,
      teethExposureScale: 0.50,
      smileScale: 0.45,
      coarticulationSpeed: 18,
      syncOffsetMs: -25,
    };
    mockStorage['avatar_lip_calibration_profile'] = JSON.stringify(legacyV1);

    const profile = loadCalibrationProfile();
    expect(profile).toEqual(DEFAULT_CALIBRATION_PROFILE);
    expect(profile.jawScale).toBe(1.0);
    expect(profile.closeScale).toBe(0.6);
    expect(profile.syncOffsetMs).toBe(100);
  });

  it('saves and reloads custom calibration profile from localStorage', () => {
    const custom: CalibrationProfile = {
      jawScale: 0.42,
      closeScale: 0.58,
      puckerScale: 0.45,
      funnelScale: 0.35,
      rollScale: 0.60,
      teethExposureScale: 0.50,
      smileScale: 0.40,
      coarticulationSpeed: 20,
      syncOffsetMs: -15,
    };

    saveCalibrationProfile(custom);
    const loaded = loadCalibrationProfile();
    expect(loaded).toEqual(custom);
    expect(loaded.jawScale).toBe(0.42);
    expect(loaded.syncOffsetMs).toBe(-15);
  });

  it('resets profile to default when resetCalibrationProfile is called', () => {
    saveCalibrationProfile({
      ...DEFAULT_CALIBRATION_PROFILE,
      jawScale: 0.99,
    });

    expect(loadCalibrationProfile().jawScale).toBe(0.99);

    const reset = resetCalibrationProfile();
    expect(reset.jawScale).toBe(DEFAULT_CALIBRATION_PROFILE.jawScale);
    expect(loadCalibrationProfile().jawScale).toBe(DEFAULT_CALIBRATION_PROFILE.jawScale);
  });

  it('has distinct preset values for subtle, balanced and expressive', () => {
    expect(CALIBRATION_PRESETS.subtle.jawScale).toBeLessThan(CALIBRATION_PRESETS.balanced.jawScale);
    expect(CALIBRATION_PRESETS.balanced.jawScale).toBeLessThan(CALIBRATION_PRESETS.expressive.jawScale);
    expect(CALIBRATION_PRESETS.subtle.puckerScale).toBeLessThan(CALIBRATION_PRESETS.expressive.puckerScale);
  });

  it('dynamically adapts VisemeScheduler scaling and coarticulation speed when profile is updated', () => {
    const scheduler = new VisemeScheduler();
    scheduler.setCalibrationProfile({
      jawScale: 0.30,
      coarticulationSpeed: 25,
    });

    const activeProfile = scheduler.getCalibrationProfile();
    expect(activeProfile.jawScale).toBe(0.30);
    expect(activeProfile.coarticulationSpeed).toBe(25);

    // Sprawdź wkład fonemu 'a' z mniejszym jawScale
    scheduler.enqueue({
      epoch: 0,
      char: 'a',
      shapes: new Map([['jawOpen', 0.55]]),
      startTimeSec: 1.0,
      durationSec: 0.1,
    });

    const updated = scheduler.update(1.05, 0.016, 0, ['jawOpen']);
    const jawWeight = updated.get('jawOpen') ?? 0;
    // Przy maxVal 0.55 i jawScale 0.30 target wynosi 0.55 * 0.30 = 0.165
    expect(jawWeight).toBeLessThan(0.25);
    expect(jawWeight).toBeGreaterThan(0.05);
  });
});

