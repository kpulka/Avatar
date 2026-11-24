// Run from the repository root with ELEVENLABS_API_KEY set in the environment.
import { mkdir, writeFile } from 'node:fs/promises';

const TEXT = "Hi! I'm a real-time 3D avatar. My lips, my eyes and my expressions are driven live in your browser, perfectly in sync with my voice. Press Start, and maybe we can talk.";
const KEY = process.env.ELEVENLABS_API_KEY;
const VOICE = process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
const RATE = 24000;

if (!KEY) {
  console.error('Set ELEVENLABS_API_KEY');
  process.exit(1);
}

try {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(VOICE)}/with-timestamps?output_format=pcm_${RATE}`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: TEXT, model_id: 'eleven_multilingual_v2' }),
  });
  if (!res.ok) throw new Error(`ElevenLabs request failed (HTTP ${res.status})`);

  const { audio_base64: audio, alignment } = await res.json();
  if (typeof audio !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(audio)) {
    throw new Error('Invalid audio returned by ElevenLabs');
  }
  const pcm = Buffer.from(audio, 'base64');
  if (!pcm.length || pcm.length % 2 || pcm.length > 0xffffffff - 36) {
    throw new Error('Invalid PCM audio returned by ElevenLabs');
  }

  const chars = alignment?.characters;
  const startSeconds = alignment?.character_start_times_seconds;
  const endSeconds = alignment?.character_end_times_seconds;
  if (!Array.isArray(chars) || !chars.length || !Array.isArray(startSeconds) || !Array.isArray(endSeconds)
      || chars.length !== startSeconds.length || chars.length !== endSeconds.length
      || chars.some((c) => typeof c !== 'string' || !c.length)
      || startSeconds.some((s, i) => !Number.isFinite(s) || s < 0 || (i > 0 && s < startSeconds[i - 1]))
      || endSeconds.some((e, i) => !Number.isFinite(e) || e < startSeconds[i])) {
    throw new Error('Invalid character alignment returned by ElevenLabs');
  }
  const starts = startSeconds.map((s) => Math.round(s * 1000));
  const durations = endSeconds.map((e, i) => Math.max(0, Math.round(e * 1000) - starts[i]));
  const metadata = { text: TEXT, sampleRate: RATE, alignment: { chars, char_start_times_ms: starts, char_durations_ms: durations, source: 'elevenlabs' } };

  await mkdir('public/demo', { recursive: true });
  await writeFile('public/demo/demo-hello.wav', Buffer.concat([wavHeader(pcm.length, RATE), pcm]));
  await writeFile('public/demo/demo-hello.json', JSON.stringify(metadata, null, 2));
  console.log('Created public/demo/demo-hello.wav and demo-hello.json');
} catch (error) {
  // Do not print fetch errors or response bodies: they may contain request details.
  const safeMessages = new Set(['Invalid audio returned by ElevenLabs', 'Invalid PCM audio returned by ElevenLabs', 'Invalid character alignment returned by ElevenLabs']);
  console.error(safeMessages.has(error?.message) || /^ElevenLabs request failed \(HTTP \d+\)$/.test(error?.message || '')
    ? error.message : 'Could not generate the demo clip.');
  process.exitCode = 1;
}

function wavHeader(dataLen, rate) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0, 'ascii');
  h.writeUInt32LE(36 + dataLen, 4);
  h.write('WAVE', 8, 'ascii');
  h.write('fmt ', 12, 'ascii');
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36, 'ascii');
  h.writeUInt32LE(dataLen, 40);
  return h;
}
