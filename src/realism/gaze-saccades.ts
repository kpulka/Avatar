import { FaceDriver } from '../types/avatar';

export interface GazeOptions {
  maxAngleRad?: number; // Maksymalny kąt spojrzenia (domyślnie 0.26 rad ~15°)
  minSaccadeIntervalSec?: number; // Minimalny odstęp między sakadami (domyślnie 0.5s)
  maxSaccadeIntervalSec?: number; // Maksymalny odstęp między sakadami (domyślnie 2.0s)
  saccadeMaxAngleRad?: number; // Maksymalny skok sakady (domyślnie 0.087 rad ~5°)
}

export interface EyeGazeWeights {
  eyeLookInLeft: number;
  eyeLookOutLeft: number;
  eyeLookUpLeft: number;
  eyeLookDownLeft: number;
  eyeLookInRight: number;
  eyeLookOutRight: number;
  eyeLookUpRight: number;
  eyeLookDownRight: number;
}

/**
 * Kontroler spojrzenia i mikrosakad oczu (REAL-02, docs/5)
 */
export class GazeSaccades {
  private readonly maxAngle: number;
  private readonly minInterval: number;
  private readonly maxInterval: number;
  private readonly saccadeMaxAngle: number;

  // Cel kursora myszy [-1, 1]
  private targetX = 0;
  private targetY = 0;

  // Bieżące wygładzone położenie oczu
  private currentX = 0;
  private currentY = 0;

  // Stan sakady
  private nextSaccadeTimeSec = 1.0;
  private saccadeOffsetX = 0;
  private saccadeOffsetY = 0;
  private isSaccading = false;
  private saccadeStartTimeSec = 0;
  private saccadeDurationSec = 0.04; // 40ms

  constructor(options: GazeOptions = {}) {
    this.maxAngle = options.maxAngleRad ?? 0.26; // 15 stopni
    this.minInterval = options.minSaccadeIntervalSec ?? 0.5;
    this.maxInterval = options.maxSaccadeIntervalSec ?? 2.0;
    this.saccadeMaxAngle = options.saccadeMaxAngleRad ?? 0.087; // 5 stopni
  }

  /**
   * Aktualizuje pozycję kursora w znormalizowanych współrzędnych ekranu [-1, 1]
   */
  public setPointer(normX: number, normY: number): void {
    // Clamp do zakresu [-1, 1]
    this.targetX = Math.max(-1, Math.min(1, normX));
    this.targetY = Math.max(-1, Math.min(1, normY));
  }

  /**
   * Główny krok obliczeniowy spojrzenia
   */
  public compute(currentTimeSec: number, dt: number): EyeGazeWeights {
    // 1. Sprawdzenie i aktualizacja mikrosakad
    this.updateSaccade(currentTimeSec);

    // 2. Wygładzanie spojrzenia (exponential damping: alpha = 1 - exp(-15 * dt))
    const alpha = 1 - Math.exp(-15 * dt);
    const targetWithSaccadeX = this.targetX + this.saccadeOffsetX;
    const targetWithSaccadeY = this.targetY + this.saccadeOffsetY;

    this.currentX += (targetWithSaccadeX - this.currentX) * alpha;
    this.currentY += (targetWithSaccadeY - this.currentY) * alpha;

    // 3. Przeliczenie na wagi ARKit [0, 1] (z uwzględnieniem maxAngle / limitu 15°)
    const lookX = Math.max(-1, Math.min(1, this.currentX));
    const lookY = Math.max(-1, Math.min(1, this.currentY));

    return {
      // Oko lewe (patrząc od przodu: kursor w prawo -> lewe oko na zewnątrz / do ucha)
      eyeLookInLeft: lookX < 0 ? -lookX : 0,
      eyeLookOutLeft: lookX > 0 ? lookX : 0,
      eyeLookUpLeft: lookY > 0 ? lookY : 0,
      eyeLookDownLeft: lookY < 0 ? -lookY : 0,

      // Oko prawe (kursor w prawo -> prawe oko do wewnątrz / do nosa)
      eyeLookInRight: lookX > 0 ? lookX : 0,
      eyeLookOutRight: lookX < 0 ? -lookX : 0,
      eyeLookUpRight: lookY > 0 ? lookY : 0,
      eyeLookDownRight: lookY < 0 ? -lookY : 0,
    };
  }

  /**
   * Aplikuje wagi spojrzenia do FaceDriver z umiarkowaną wagą, by powieki naturalnie wspierały ruch bez zniekształceń
   */
  public applyToDriver(driver: FaceDriver, currentTimeSec: number, dt: number): void {
    const weights = this.compute(currentTimeSec, dt);
    for (const [shape, val] of Object.entries(weights)) {
      driver.applyWeight(shape, val * 0.35);
    }
  }

  public getLookAngles(): { lookX: number; lookY: number } {
    return {
      lookX: Math.max(-1, Math.min(1, this.currentX)),
      lookY: Math.max(-1, Math.min(1, this.currentY)),
    };
  }

  /**
   * Bezpośrednio obraca kości / obiekty gałek ocznych 3D
   */
  public applyToEyeObjects(
    leftEye?: { rotation: { x: number; y: number }; isBone?: boolean; type?: string } | null,
    rightEye?: { rotation: { x: number; y: number }; isBone?: boolean; type?: string } | null
  ): void {
    const { lookX, lookY } = this.getLookAngles();
    const yaw = lookX * (this.maxAngle * 0.9);
    const pitch = -lookY * (this.maxAngle * 0.75);

    if (leftEye) {
      const isSkeletonBone = Boolean(leftEye.isBone || leftEye.type === 'Bone');
      if (isSkeletonBone) {
        leftEye.rotation.y = yaw;
        leftEye.rotation.x = 0.061 + pitch;
      } else {
        leftEye.rotation.y = -Math.PI / 2 + yaw;
        leftEye.rotation.x = -pitch;
      }
    }
    if (rightEye) {
      const isSkeletonBone = Boolean(rightEye.isBone || rightEye.type === 'Bone');
      if (isSkeletonBone) {
        rightEye.rotation.y = yaw;
        rightEye.rotation.x = 0.061 + pitch;
      } else {
        rightEye.rotation.y = -Math.PI / 2 + yaw;
        rightEye.rotation.x = -pitch;
      }
    }
  }

  private updateSaccade(currentTimeSec: number): void {
    if (!this.isSaccading) {
      if (currentTimeSec >= this.nextSaccadeTimeSec) {
        this.isSaccading = true;
        this.saccadeStartTimeSec = currentTimeSec;
        this.saccadeDurationSec = 0.035 + Math.random() * 0.015; // 35 - 50 ms

        // Losowy mikro-skok oka < 5 stopni
        const angle = Math.random() * Math.PI * 2;
        const mag = (0.2 + Math.random() * 0.8) * (this.saccadeMaxAngle / this.maxAngle);
        this.saccadeOffsetX = Math.cos(angle) * mag;
        this.saccadeOffsetY = Math.sin(angle) * mag;
      }
    } else {
      const elapsed = currentTimeSec - this.saccadeStartTimeSec;
      if (elapsed >= this.saccadeDurationSec) {
        this.isSaccading = false;
        this.saccadeOffsetX = 0;
        this.saccadeOffsetY = 0;

        // Zaplanuj następną sakadę za 0.5 - 2.0 s
        const nextInterval = this.minInterval + Math.random() * (this.maxInterval - this.minInterval);
        this.nextSaccadeTimeSec = currentTimeSec + nextInterval;
      }
    }
  }

  public forceSaccade(currentTimeSec: number, offsetX = 0.1, offsetY = 0.1): void {
    this.isSaccading = true;
    this.saccadeStartTimeSec = currentTimeSec;
    this.saccadeDurationSec = 0.04;
    this.saccadeOffsetX = offsetX;
    this.saccadeOffsetY = offsetY;
  }
}
