import { describe, it, expect } from 'vitest';
import {
  resampleFloat32,
  float32ToInt16,
  int16ToBase64,
  base64ToPcmBytes,
  pcmBytesToFloat32,
} from '../src/audio/pcm-resampler';

describe('PCM Resampler and Format Utilities', () => {
  it('resamples 48000 Hz input to 16000 Hz output with exact 3:1 length ratio', () => {
    const input = new Float32Array(4800); // 100ms at 48kHz
    for (let i = 0; i < input.length; i++) {
      input[i] = Math.sin((i / 4800) * Math.PI * 2); // 1 okres sinusoidy
    }

    const output = resampleFloat32(input, 48000, 16000);
    expect(output.length).toBe(1600); // 100ms at 16kHz
    expect(output[0]).toBeCloseTo(0.0);
  });

  it('converts Float32 [-1, 1] to Int16 with correct boundary clipping', () => {
    const input = new Float32Array([-1.0, 0.0, 1.0, 1.5, -2.0]);
    const output = float32ToInt16(input);

    expect(output[0]).toBe(-32768);
    expect(output[1]).toBe(0);
    expect(output[2]).toBe(32767);
    expect(output[3]).toBe(32767); // clipped
    expect(output[4]).toBe(-32768); // clipped
  });

  it('performs lossless round-trip between Int16, Base64, and PCM bytes', () => {
    const originalInt16 = new Int16Array([0, 1000, -1000, 32767, -32768]);
    const base64 = int16ToBase64(originalInt16);
    expect(typeof base64).toBe('string');
    expect(base64.length).toBeGreaterThan(0);

    const decodedBytes = base64ToPcmBytes(base64);
    expect(decodedBytes.length).toBe(originalInt16.length * 2);

    const floats = pcmBytesToFloat32(decodedBytes);
    expect(floats.length).toBe(originalInt16.length);

    expect(floats[0]).toBeCloseTo(0.0);
    expect(floats[3]).toBeCloseTo(1.0, 2);
    expect(floats[4]).toBeCloseTo(-1.0, 2);
  });
});
