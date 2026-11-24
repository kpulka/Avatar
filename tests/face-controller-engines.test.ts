/**
 * Per-language lip-sync engines (17-04): 'phoneme-en' / 'phoneme-pl' / 'char' selection in FaceController,
 * and the Polish language context handed to the character path.
 */
import { describe, it, expect } from 'vitest';
import { FaceController } from '../src/lipsync/face-controller';
import { FaceDriver } from '../src/types/avatar';
import { AudioEngine } from '../src/audio/audio-engine';
import { ensureG2pLoaded } from '../src/lipsync/g2p/g2p-en';
import { POLISH_CHAR_CONTEXT, CharContext } from '../src/lipsync/viseme-mappings';

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

function turn(
  engineId: 'phoneme-en' | 'phoneme-pl' | 'char',
  text: string,
  mapper?: (c: string[], i: number, ctx?: CharContext) => Map<string, number>
) {
  const controller = new FaceController(new StubDriver(), engine as unknown as AudioEngine);
  controller.setLipSyncEngine(engineId);
  if (mapper) controller.setCharMapper(mapper);
  const chars = text.split('');
  controller.onAudioChunk({ chars, char_start_times_ms: chars.map((_, i) => i * 60), char_durations_ms: chars.map(() => 60) }, 0, 0);
  return controller.getVisemeQueueLength();
}

describe('FaceController engine selection (17-04)', () => {
  it('phoneme-pl queues Polish phonemes WITHOUT the English lexicon (no model needed)', () => {
    // dziekuje with ogonek letters: PL_DZI PL_EN K UW Y EH = 6 visemes
    expect(turn('phoneme-pl', 'dzi\u0119kuj\u0119')).toBe(6);
  });

  it('phoneme-pl treats plain ASCII words as Polish (chata -> 4 visemes: PL_H AA T AA)', () => {
    expect(turn('phoneme-pl', 'chata')).toBe(4);
  });

  it('phoneme-en waits for the lexicon, then routes Polish-evidence words to the Polish rules', async () => {
    await ensureG2pLoaded();
    expect(turn('phoneme-en', 'dzi\u0119kuj\u0119')).toBe(6);
    expect(turn('phoneme-en', 'hello')).toBe(4); // HH AH L OW
  });

  it('char engine ignores the phoneme layer (one viseme per letter, digraphs merged)', () => {
    expect(turn('char', 'cat')).toBe(3);
  });
});

describe('character path language context (17-04)', () => {
  function contextsSeen(engineId: 'phoneme-pl' | 'char', text: string): Array<CharContext | undefined> {
    const seen: Array<CharContext | undefined> = [];
    turn(engineId, text, (_chars, _i, ctx) => {
      seen.push(ctx);
      return new Map();
    });
    return seen;
  }

  it('a chunk with Polish evidence hands the Polish context to the char mapper', () => {
    const seen = contextsSeen('char', 'Dzie\u0144 chata');
    expect(seen.length).toBeGreaterThan(0);
    for (const ctx of seen) expect(ctx).toBe(POLISH_CHAR_CONTEXT);
  });

  it('plain English text gets no context (the English ch is unchanged)', () => {
    const seen = contextsSeen('char', 'the church');
    expect(seen.length).toBeGreaterThan(0);
    for (const ctx of seen) expect(ctx).toBeUndefined();
  });
});
