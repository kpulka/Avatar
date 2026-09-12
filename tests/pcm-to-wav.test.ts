import { describe, expect, it } from 'vitest';
import { encodeWav } from '../src/audio/pcm-to-wav';

async function readHeader(blob: Blob): Promise<{ bytes: Uint8Array; view: DataView }> {
  const buffer = await blob.arrayBuffer();
  return { bytes: new Uint8Array(buffer), view: new DataView(buffer) };
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

describe('encodeWav', () => {
  it('tworzy poprawny nagłówek RIFF/WAVE (mono 16-bit)', async () => {
    const pcm = new Uint8Array(1000);
    const wav = encodeWav(pcm, 44100);
    expect(wav.type).toBe('audio/wav');
    expect(wav.size).toBe(44 + pcm.byteLength);

    const { bytes, view } = await readHeader(wav);
    expect(ascii(bytes, 0, 4)).toBe('RIFF');
    expect(ascii(bytes, 8, 4)).toBe('WAVE');
    expect(ascii(bytes, 12, 4)).toBe('fmt ');
    expect(ascii(bytes, 36, 4)).toBe('data');
    expect(view.getUint32(4, true)).toBe(36 + pcm.byteLength);
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint32(28, true)).toBe(44100 * 2);
    expect(view.getUint16(32, true)).toBe(2);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(pcm.byteLength);
  });

  it('obsługuje pusty PCM (poprawny, zerowy data)', async () => {
    const wav = encodeWav(new Uint8Array(0), 16000);
    expect(wav.size).toBe(44);
    const { bytes, view } = await readHeader(wav);
    expect(ascii(bytes, 0, 4)).toBe('RIFF');
    expect(view.getUint32(40, true)).toBe(0);
    expect(view.getUint32(24, true)).toBe(16000);
  });
});
