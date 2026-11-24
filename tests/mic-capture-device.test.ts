import { describe, expect, it, vi } from 'vitest';
import { buildAudioConstraints, MicCapture } from '../src/audio/mic-capture';

describe('MicCapture — device selection (F11)', () => {
  it('buildAudioConstraints without deviceId does not force a device', () => {
    const constraints = buildAudioConstraints(null);
    expect('deviceId' in constraints).toBe(false);
    expect(constraints.channelCount).toBe(1);
    expect(constraints.echoCancellation).toBe(true);
  });

  it('buildAudioConstraints with deviceId uses exact', () => {
    const constraints = buildAudioConstraints('mic-42');
    expect(constraints.deviceId).toEqual({ exact: 'mic-42' });
  });

  it('setDeviceId normalizes an empty string to null', () => {
    const capture = new MicCapture();
    capture.setDeviceId('  ');
    expect(capture.getDeviceId()).toBeNull();
    capture.setDeviceId('mic-7');
    expect(capture.getDeviceId()).toBe('mic-7');
  });

  it('listDevices returns only audioinput, with a label fallback', async () => {
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
      { id: 'mic1', label: 'Microphone' },
      { id: 'mic2', label: 'Yeti' },
    ]);

    vi.unstubAllGlobals();
  });

  it('listDevices returns an empty list without the API (graceful degrade)', async () => {
    vi.stubGlobal('navigator', { mediaDevices: undefined });
    const capture = new MicCapture();
    await expect(capture.listDevices()).resolves.toEqual([]);
    vi.unstubAllGlobals();
  });
});
