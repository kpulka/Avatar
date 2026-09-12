/**
 * Narzędzia do resamplingu audio, konwersji formatów PCM i kodowania base64 (docs/2, docs/4)
 */

/**
 * Resampluje bufor Float32 z inSampleRate do outSampleRate (domyślnie 16000 Hz)
 * przy użyciu interpolacji liniowej.
 */
export function resampleFloat32(
  input: Float32Array,
  inSampleRate: number,
  outSampleRate = 16000
): Float32Array {
  if (inSampleRate === outSampleRate || input.length === 0) {
    return new Float32Array(input);
  }

  const ratio = inSampleRate / outSampleRate;
  const outputLength = Math.round(input.length / ratio);
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const originalPos = i * ratio;
    const index1 = Math.floor(originalPos);
    const index2 = Math.min(index1 + 1, input.length - 1);
    const fraction = originalPos - index1;

    // Liniowa interpolacja pomiędzy próbkami
    output[i] = input[index1] + fraction * (input[index2] - input[index1]);
  }

  return output;
}

/**
 * Konwertuje próbki Float32 [-1.0, 1.0] do 16-bit PCM Int16 [-32768, 32767]
 */
export function float32ToInt16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    // Clamp do zakresu [-1.0, 1.0] i skalowanie do Int16
    const s = Math.max(-1.0, Math.min(1.0, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

/**
 * Koduje Int16Array (16-bit PCM little endian) do łańcucha base64
 */
export function int16ToBase64(input: Int16Array): string {
  const uint8 = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  let binary = '';
  const len = uint8.byteLength;
  const chunkSize = 0x8000; // 32KB chunki unikające stack overflow w String.fromCharCode

  for (let i = 0; i < len; i += chunkSize) {
    const slice = uint8.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, slice as unknown as number[]);
  }

  return btoa(binary);
}

/**
 * Dekoduje łańcuch base64 reprezentujący 16-bit PCM (little endian) do Uint8Array
 */
export function base64ToPcmBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Konwertuje surowe bajty 16-bit PCM (Uint8Array) do Float32Array dla Web Audio API
 */
export function pcmBytesToFloat32(bytes: Uint8Array): Float32Array {
  const sampleCount = Math.floor(bytes.length / 2);
  const out = new Float32Array(sampleCount);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  for (let i = 0; i < sampleCount; i++) {
    out[i] = view.getInt16(i * 2, true) / 32768;
  }

  return out;
}
