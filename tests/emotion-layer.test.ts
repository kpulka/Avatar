import { describe, it, expect } from 'vitest';
import { EmotionLayer } from '../src/realism/emotion-layer';

describe('EmotionLayer (REAL-03)', () => {
  it('accurately identifies emotional sentiment from agent response text', () => {
    const layer = new EmotionLayer();

    expect(layer.analyzeText('It is a great pleasure to meet you!')).toBe('happy');
    expect(layer.analyzeText('Wow, that is really an interesting question.')).toBe('surprised');
    expect(layer.analyzeText('Let me think and consider how to solve this problem.')).toBe('focused');
    expect(layer.analyzeText('Standard connection established.')).toBe('neutral');
  });

  it('smoothly cross-fades emotional weights and decays back to neutral', () => {
    const layer = new EmotionLayer();

    // Aktywuj emocję 'happy'
    layer.setEmotion('happy');

    // W połowie cross-fade (200ms)
    layer.update(0.2);
    expect(layer.getWeight('mouthSmileLeft')).toBeGreaterThan(0.05);

    // Po pełnym cross-fade (kolejne 250ms)
    layer.update(0.25);
    expect(layer.getWeight('mouthSmileLeft')).toBeCloseTo(0.22, 2);
    expect(layer.getCurrentEmotion()).toBe('happy');

    // Powrót do neutralnego
    layer.setEmotion('neutral');
    layer.update(0.2);
    layer.update(0.25);
    expect(layer.getWeight('mouthSmileLeft')).toBe(0);
    expect(layer.getCurrentEmotion()).toBe('neutral');
  });
});
