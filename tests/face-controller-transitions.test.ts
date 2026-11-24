import { describe, it, expect, beforeEach } from 'vitest';
import { FaceController } from '../src/lipsync/face-controller';
import { FaceDriver, FramesClip } from '../src/types/avatar';
import { AudioEngine } from '../src/audio/audio-engine';

/** Driver mock that also records every write in order (for flicker / zero-pop assertions). */
class RecordingFaceDriver implements FaceDriver {
  public appliedWeights: Record<string, number> = {};
  public writes: Array<[string, number]> = [];

  public applyTargets(weights: Record<string, number>): void {
    Object.assign(this.appliedWeights, weights);
  }
  public applyWeight(shape: string, weight: number): void {
    this.appliedWeights[shape] = weight;
    this.writes.push([shape, weight]);
  }
  public listAvailableShapes(): string[] {
    return ['jawOpen', 'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthSmileLeft', 'mouthSmileRight', 'eyeBlinkLeft', 'eyeBlinkRight'];
  }
  public getSpeechMeshes(): never[] {
    return [];
  }
  public getMorphTargetDictionary(): Record<string, number> {
    return {};
  }
}

class MockAudioEngine {
  public epoch = 0;
  public ctx = { currentTime: 0 };
  public hasPending = true;
  public getEpoch(): number {
    return this.epoch;
  }
  public hasPendingAudio(): boolean {
    return this.hasPending;
  }
}

const CHUNK = {
  chars: ['a'],
  char_start_times_ms: [0],
  char_durations_ms: [2000],
};

const FRAMES: FramesClip = {
  shapes: ['jawOpen'],
  fps: 60,
  frames: [
    { timeSec: 0, weights: { jawOpen: 0.4 } },
    { timeSec: 0.5, weights: { jawOpen: 0.2 } },
  ],
  carriesEyes: false,
};

describe('FaceController transition matrix (16-CONTEXT §2)', () => {
  let driver: RecordingFaceDriver;
  let engine: MockAudioEngine;
  let controller: FaceController;
  let audible = 0;
  let wallMs = 0; // hand-driven wall clock injected as nowMs (no fake timers)

  /** Speaks one long vowel and renders until the jaw is clearly open (non-zero currentWeights). */
  function speakUntilJawOpen(): void {
    controller.onAudioChunk(CHUNK, 0, engine.epoch);
    audible = 0.5;
    for (let i = 0; i < 20; i++) controller.render(0.016);
    expect(controller.getState()).toBe('SPEAKING');
    expect(controller.getCurrentWeight('jawOpen')).toBeGreaterThan(0.05);
  }

  beforeEach(() => {
    audible = 0;
    wallMs = 0;
    driver = new RecordingFaceDriver();
    engine = new MockAudioEngine();
    controller = new FaceController(driver, engine as unknown as AudioEngine, {
      audibleClock: () => audible,
      nowMs: () => wallMs,
    });
    controller.setLipSyncEngine('char');
    controller.setCalibrationProfile({ syncOffsetMs: 0 });
  });

  it('row 3: interruption in IDLE stays IDLE with empty queues', () => {
    controller.onInterruption();
    expect(controller.getState()).toBe('IDLE');
    expect(controller.getVisemeQueueLength()).toBe(0);
    expect(controller.getFrameQueueLength()).toBe(0);
  });

  it('row 7: deferred switch request in IDLE is applied immediately (documented fall-through)', () => {
    controller.setAnimationMode('frames', { deferToTurnEnd: true });
    expect(controller.getAnimationMode()).toBe('frames');
    expect(controller.getState()).toBe('IDLE');
  });

  it('row 13: immediate switch during SPEAKING eases out via RELAXING (no snap)', () => {
    speakUntilJawOpen();
    const mark = driver.writes.length;
    controller.setAnimationMode('frames');
    expect(controller.getAnimationMode()).toBe('frames');
    expect(controller.getState()).toBe('RELAXING');
    expect(controller.getVisemeQueueLength()).toBe(0);

    controller.render(0.016);
    const jawWrites = driver.writes
      .slice(mark)
      .filter(([s]) => s === 'jawOpen')
      .map(([, w]) => w);
    expect(jawWrites.length).toBeGreaterThan(0);
    expect(jawWrites.every((w) => w > 0.05)).toBe(true);
  });

  it('row 14: testPhoneme during SPEAKING is ignored (cannot cut a live turn)', () => {
    speakUntilJawOpen();
    const queueBefore = controller.getVisemeQueueLength();
    const mark = driver.writes.length;
    controller.testPhoneme('neutral');
    controller.testPhoneme('M');
    expect(controller.getState()).toBe('SPEAKING');
    expect(controller.getVisemeQueueLength()).toBe(queueBefore);
    expect(driver.writes.length).toBe(mark);
  });

  it('row 14b: testPhoneme outside SPEAKING still works (dev tool)', () => {
    controller.testPhoneme('A');
    expect(driver.appliedWeights['jawOpen']).toBeGreaterThan(0.1);
    controller.testPhoneme('neutral');
    expect(controller.getState()).toBe('RELAXING');
  });

  it('row 16: chunk during RELAXING resumes SPEAKING and never zero-writes the jaw (rapid turn-taking)', () => {
    speakUntilJawOpen();
    controller.onInterruption();
    expect(controller.getState()).toBe('RELAXING');
    controller.render(0.016); // t=0 of relax: factor 1 -> weights preserved

    const mark = driver.writes.length;
    engine.hasPending = true;
    controller.onAudioChunk(CHUNK, 0, engine.epoch);
    expect(controller.getState()).toBe('SPEAKING');
    for (let i = 0; i < 5; i++) controller.render(0.016);

    const jawWrites = driver.writes
      .slice(mark)
      .filter(([s]) => s === 'jawOpen')
      .map(([, w]) => w);
    expect(jawWrites.length).toBeGreaterThan(0);
    expect(jawWrites.some((w) => w === 0)).toBe(false);
  });

  it('row 17: stale-epoch chunk during RELAXING is ignored', () => {
    speakUntilJawOpen();
    controller.onInterruption();
    engine.epoch = 1; // hardStop bumped the engine epoch
    controller.onAudioChunk(CHUNK, 0, 0); // stale epoch 0
    expect(controller.getState()).toBe('RELAXING');
    expect(controller.getVisemeQueueLength()).toBe(0);
  });

  it('row 18: feedFrames during RELAXING enters SPEAKING in frames mode (compare-B replay path)', () => {
    controller.setAnimationMode('frames');
    controller.testPhoneme('neutral'); // force RELAXING
    expect(controller.getState()).toBe('RELAXING');
    controller.feedFrames(FRAMES, 0, engine.epoch);
    expect(controller.getState()).toBe('SPEAKING');
    expect(controller.getFrameQueueLength()).toBe(2);
  });

  it('row 19: double interruption stays RELAXING and re-anchors the relax timer (bounded at 2x)', () => {
    speakUntilJawOpen();
    controller.onInterruption();
    wallMs += 100;
    controller.onInterruption(); // re-anchor at t=100
    expect(controller.getState()).toBe('RELAXING');

    // 100 ms after the re-anchor the relax must NOT be complete (a stale anchor would finish at 150 ms)
    wallMs += 100; // t=200 -> 100 ms since re-anchor (< 150)
    controller.render(0.016);
    expect(controller.getState()).toBe('RELAXING');

    wallMs += 60; // 160 ms since re-anchor
    controller.render(0.016);
    expect(controller.getState()).toBe('IDLE');
  });

  it('rows 21/22: mode switch during RELAXING keeps easing from currentWeights (no zero frame)', () => {
    speakUntilJawOpen();
    controller.onInterruption();
    controller.render(0.016);
    const mark = driver.writes.length;

    controller.setAnimationMode('frames'); // row 21 (immediate)
    expect(controller.getState()).toBe('RELAXING');
    controller.setAnimationMode('viseme', { deferToTurnEnd: true }); // row 22 (deferred falls through)
    expect(controller.getState()).toBe('RELAXING');
    expect(controller.getAnimationMode()).toBe('viseme');

    controller.render(0.016);
    const jawWrites = driver.writes
      .slice(mark)
      .filter(([s]) => s === 'jawOpen')
      .map(([, w]) => w);
    expect(jawWrites.length).toBeGreaterThan(0);
    expect(jawWrites.every((w) => w > 0.05)).toBe(true);
  });

  it('B5: RELAXING -> switch to A2F -> next live chunk never drops all mouth weights to 0 in between', () => {
    speakUntilJawOpen();
    controller.onInterruption();
    controller.render(0.016);
    const mark = driver.writes.length;

    controller.setAnimationMode('frames'); // user flips to A2F in the audio gap
    controller.render(0.016);
    controller.setAnimationMode('viseme'); // animation-controller forces visemes for a live chunk
    controller.onAudioChunk(CHUNK, 0, engine.epoch);
    for (let i = 0; i < 3; i++) controller.render(0.016);

    const jawWrites = driver.writes
      .slice(mark)
      .filter(([s]) => s === 'jawOpen')
      .map(([, w]) => w);
    expect(jawWrites.length).toBeGreaterThan(0);
    expect(jawWrites.some((w) => w === 0)).toBe(false);
    expect(controller.getState()).toBe('SPEAKING');
  });

  it('pending mode: deferred switch mid-turn lands on interruption and relaxes (no snap)', () => {
    speakUntilJawOpen();
    controller.setAnimationMode('frames', { deferToTurnEnd: true });
    expect(controller.getAnimationMode()).toBe('viseme');
    controller.onInterruption();
    expect(controller.getAnimationMode()).toBe('frames');
    expect(controller.getState()).toBe('RELAXING');
  });
});
