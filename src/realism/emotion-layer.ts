export type EmotionType = 'neutral' | 'happy' | 'surprised' | 'focused';

export interface EmotionProfile {
  type: EmotionType;
  weights: Map<string, number>;
}

const EMOTION_PROFILES: Record<EmotionType, Map<string, number>> = {
  neutral: new Map(),
  happy: new Map([
    ['mouthSmileLeft', 0.22],
    ['mouthSmileRight', 0.22],
    ['cheekSquintLeft', 0.12],
    ['cheekSquintRight', 0.12],
  ]),
  surprised: new Map([
    ['browInnerUp', 0.25],
    ['eyeWideLeft', 0.15],
    ['eyeWideRight', 0.15],
  ]),
  focused: new Map([
    ['browDownLeft', 0.12],
    ['browDownRight', 0.12],
  ]),
};

/**
 * Warstwa emocjonalna (EmotionLayer) analizująca sentyment wypowiedzi (REAL-03, docs/3, docs/5)
 */
export class EmotionLayer {
  private currentEmotion: EmotionType = 'neutral';
  private targetEmotion: EmotionType = 'neutral';

  // Aktualne wagi przenikania
  private readonly activeWeights: Map<string, number> = new Map();
  private crossFadeDurationSec = 0.4; // 400ms cross-fade między stanami
  private crossFadeElapsed = 0.4;

  /**
   * Analizuje tekst wypowiedzi pod kątem leksykalnego sentymentu
   */
  public analyzeText(text: string): EmotionType {
    const lower = text.toLowerCase();

    const happyKeywords = [
      'great',
      'happy',
      'wonderful',
      'glad',
      'awesome',
      'pleasure',
      'super',
      'dobrze',
      'świetnie',
      'nice',
      'love',
      'excellent',
      'welcome',
    ];
    const surprisedKeywords = [
      'wow',
      'really?',
      'amazing',
      'tell me',
      'interesting',
      'incredible',
      'surprise',
      'whoa',
      'extraordinary',
    ];
    const focusedKeywords = [
      'think',
      'consider',
      'important',
      'problem',
      'solve',
      'let me',
      'analyzing',
      'focus',
      'critical',
    ];

    if (happyKeywords.some((w) => lower.includes(w))) {
      return 'happy';
    }
    if (surprisedKeywords.some((w) => lower.includes(w))) {
      return 'surprised';
    }
    if (focusedKeywords.some((w) => lower.includes(w))) {
      return 'focused';
    }

    return 'neutral';
  }

  public setEmotion(type: EmotionType): void {
    if (this.targetEmotion !== type) {
      this.targetEmotion = type;
      this.crossFadeElapsed = 0;
    }
  }

  /**
   * Aktualizuje wagi emocji z uwzględnieniem cross-fade
   */
  public update(dt: number): Map<string, number> {
    this.crossFadeElapsed = Math.min(this.crossFadeDurationSec, this.crossFadeElapsed + dt);
    const progress = this.crossFadeElapsed / this.crossFadeDurationSec;
    // Cosine ease wygładzania emocji
    const ease = Math.sin((progress * Math.PI) / 2);

    const targetProfile = EMOTION_PROFILES[this.targetEmotion];
    const allShapes = new Set([
      ...this.activeWeights.keys(),
      ...targetProfile.keys(),
    ]);

    for (const shape of allShapes) {
      const targetVal = targetProfile.get(shape) ?? 0.0;
      const currentVal = this.activeWeights.get(shape) ?? 0.0;
      const nextVal = currentVal + (targetVal - currentVal) * ease;

      if (nextVal < 0.002 && targetVal === 0) {
        this.activeWeights.delete(shape);
      } else {
        this.activeWeights.set(shape, nextVal);
      }
    }

    if (progress >= 1.0) {
      this.currentEmotion = this.targetEmotion;
    }

    return new Map(this.activeWeights);
  }

  public getCurrentEmotion(): EmotionType {
    return this.currentEmotion;
  }

  public getTargetEmotion(): EmotionType {
    return this.targetEmotion;
  }

  public getWeight(shape: string): number {
    return this.activeWeights.get(shape) ?? 0.0;
  }
}
