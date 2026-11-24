import { describe, it, expect } from 'vitest';
import { FaceController } from '../src/lipsync/face-controller';
import { FaceDriver } from '../src/types/avatar';
import { AudioEngine } from '../src/audio/audio-engine';

class StubDriver implements FaceDriver {
  public applyTargets(): void {}
  public applyWeight(): void {}
  public listAvailableShapes(): string[] {
    return ['jawOpen', 'mouthFunnel', 'tongueOut', 'mouthSmileLeft', 'mouthSmileRight', 'eyeBlinkLeft', 'eyeBlinkRight'];
  }
  public getSpeechMeshes(): never[] {
    return [];
  }
  public getMorphTargetDictionary(): Record<string, number> {
    return {};
  }
}

const engine = { ctx: { currentTime: 0 }, getEpoch: () => 0, hasPendingAudio: () => true };

function charTurn(text: string): { queued: number } {
  const controller = new FaceController(new StubDriver(), engine as unknown as AudioEngine);
  controller.setLipSyncEngine('char');
  const chars = text.split('');
  controller.onAudioChunk(
    {
      chars,
      char_start_times_ms: chars.map((_, i) => i * 60),
      char_durations_ms: chars.map(() => 60),
    },
    0,
    0,
  );
  return { queued: controller.getVisemeQueueLength() };
}

describe('character engine: digraph second-letter skip (17-01)', () => {
  it('"the" enqueues exactly two visemes (TH, E), not three', () => {
    expect(charTurn('the').queued).toBe(2);
  });

  it('"ship" -> SH, I, P (three visemes for four letters)', () => {
    expect(charTurn('ship').queued).toBe(3);
  });

  it('letters that do not start a digraph are unchanged (one viseme each)', () => {
    expect(charTurn('cat').queued).toBe(3);
  });

  it('keeps the vowel after a soft-i digraph: "nice" still has four visemes', () => {
    expect(charTurn('nice').queued).toBe(4);
  });
});
