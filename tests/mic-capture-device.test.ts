import { describe, expect, it, vi } from 'vitest';
import { buildAudioConstraints, MicCapture } from '../src/audio/mic-capture';

describe('MicCapture — wybór urządzenia (F11)', () => {
  it('buildAudioConstraints bez deviceId nie wymusza urządzenia', () => {
    const constraints = buildAudioConstraints(null);
    expect('deviceId' in constraints).toBe(false);
    expect(constraints.channelCount).toBe(1);
    expect(constraints.echoCancellation).toBe(true);
  });

  it('buildAudioConstraints z deviceId używa exact', () => {
    const constraints = buildAudioConstraints('mic-42');
    expect(constraints.deviceId).toEqual({ exact: 'mic-42' });
  });

  it('setDeviceId normalizuje pusty string do null', () => {
    const capture = new MicCapture();
    capture.setDeviceId('  ');
    expect(capture.getDeviceId()).toBeNull();
    capture.setDeviceId('mic-7');
    expect(capture.getDeviceId()).toBe('mic-7');
  });

  it('listDevices zwraca wyłącznie audioinput z fallbackiem etykiety', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: async () => [
          { kind: 'audioinput', deviceId: 'mic1', label: '' },
          { kind: 'audioinput', deviceId: 'mic2', label: 'Yeti' },
          { kind: 'videoinput', deviceId: 'cam', label: 'Kamera' },
        ],
      },
    });

    const capture = new MicCapture();
    const devices = await capture.listDevices();
    expect(devices).toEqual([
      { id: 'mic1', label: 'Mikrofon' },
      { id: 'mic2', label: 'Yeti' },
    ]);

    vi.unstubAllGlobals();
  });

  it('listDevices zwraca pustą listę bez API (graceful degrade)', async () => {
    vi.stubGlobal('navigator', { mediaDevices: undefined });
    const capture = new MicCapture();
    await expect(capture.listDevices()).resolves.toEqual([]);
    vi.unstubAllGlobals();
  });
});
