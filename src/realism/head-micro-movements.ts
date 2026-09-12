import { Object3D } from 'three';

export interface MicroMovementOptions {
  maxYawRad?: number; // Maksymalny kąt yaw (domyślnie 0.012 rad < 0.7°)
  maxPitchRad?: number; // Maksymalny kąt pitch (domyślnie 0.008 rad < 0.5°)
  maxRollRad?: number; // Maksymalny kąt roll (domyślnie 0.004 rad < 0.25°)
  breathingFreqHz?: number; // Częstotliwość oddechu (domyślnie 0.22 Hz, ~4.5s cykl)
  breathingAmplitudeY?: number; // Amplituda unoszenia klatki piersiowej (domyślnie 0.002 m)
}

/**
 * Generator proceduralnych mikroruchów głowy i cyklu oddechowego (REAL-01, docs/5).
 * Zasada fizjologiczna: głowa nie pulsuje ani nie kołysze się w pionie.
 * Oddech jest aplikowany wyłącznie do klatki piersiowej (unoszenie i rozszerzanie żeber).
 */
export class HeadMicroMovements {
  private readonly maxYaw: number;
  private readonly maxPitch: number;
  private readonly maxRoll: number;
  private readonly breathingFreq: number;
  private readonly breathingAmpY: number;

  private elapsedTime = 0;
  private basePosition = { x: 0, y: 0, z: 0 };
  private baseRotation = { x: 0, y: 0, z: 0 };
  private isBaseSet = false;

  private baseChestPosition = { x: 0, y: 0, z: 0 };
  private baseChestScale = { x: 1, y: 1, z: 1 };
  private isChestBaseSet = false;

  constructor(options: MicroMovementOptions = {}) {
    this.maxYaw = options.maxYawRad ?? 0.012; // bardzo subtelny dryf lewo/prawo (< 0.7°)
    this.maxPitch = options.maxPitchRad ?? 0.008; // subtelne pochylenie (< 0.5°), BEZ rytmicznego kiwania
    this.maxRoll = options.maxRollRad ?? 0.004; // (< 0.25°)
    this.breathingFreq = options.breathingFreqHz ?? 0.22; // ~4.5s cykl oddechu
    this.breathingAmpY = options.breathingAmplitudeY ?? 0.002; // unoszenie klatki piersiowej (2 mm)
  }

  /**
   * Oblicza przesunięcia rotacji głowy oraz parametry oddechu klatki piersiowej
   */
  public compute(time: number): {
    yaw: number;
    pitch: number;
    roll: number;
    offsetY: number;
    breathNorm: number;
  } {
    // 1. Bardzo wolny, naturalny szum harmoniczny głowy (brak rytmicznego pulsowania)
    const yaw =
      (0.6 * Math.sin(time * 0.43) +
        0.3 * Math.sin(time * 0.89) +
        0.1 * Math.cos(time * 1.31)) *
      this.maxYaw;

    const pitch =
      (0.6 * Math.cos(time * 0.37) +
        0.4 * Math.sin(time * 0.79)) *
      this.maxPitch;

    const roll =
      (0.7 * Math.sin(time * 0.31) +
        0.3 * Math.cos(time * 0.67)) *
      this.maxRoll;

    // 2. Cykl oddechu klatki piersiowej (asymetryczny wdech/wydech)
    const breathPhase = time * this.breathingFreq * Math.PI * 2;
    const breathNorm = (Math.sin(breathPhase) + 1) / 2; // [0, 1]
    const offsetY = Math.pow(breathNorm, 1.2) * this.breathingAmpY;

    return { yaw, pitch, roll, offsetY, breathNorm };
  }

  /**
   * Aktualizuje obiekty: głowa wykonuje wyłącznie mikrorotację,
   * a klatka piersiowa (chestTarget) unosi się i rozszerza przy oddechu.
   */
  public update(dt: number, headTarget: Object3D, chestTarget?: Object3D): void {
    if (!this.isBaseSet) {
      this.basePosition = { x: headTarget.position.x, y: headTarget.position.y, z: headTarget.position.z };
      this.baseRotation = { x: headTarget.rotation.x, y: headTarget.rotation.y, z: headTarget.rotation.z };
      this.isBaseSet = true;
    }

    this.elapsedTime += dt;
    const { yaw, pitch, roll, offsetY, breathNorm } = this.compute(this.elapsedTime);

    // GŁOWA: stała pozycja Y (ZERO pulsowania w pionie), wyłącznie subtelna mikrorotacja w miejscu
    headTarget.rotation.x = this.baseRotation.x + pitch;
    headTarget.rotation.y = this.baseRotation.y + yaw;
    headTarget.rotation.z = this.baseRotation.z + roll;
    headTarget.position.y = this.basePosition.y;

    // KLATKA PIERSIOWA: wyłącznie tu zachodzi fizjologiczne unoszenie i rozszerzanie oddechu
    if (chestTarget) {
      if (!this.isChestBaseSet) {
        this.baseChestPosition = { x: chestTarget.position.x, y: chestTarget.position.y, z: chestTarget.position.z };
        this.baseChestScale = { x: chestTarget.scale.x, y: chestTarget.scale.y, z: chestTarget.scale.z };
        this.isChestBaseSet = true;
      }

      // Unoszenie klatki piersiowej przy wdechu
      chestTarget.position.y = this.baseChestPosition.y + offsetY;
      // Rozszerzanie klatki piersiowej (obwód klatki rośnie o ~2% przy wdechu)
      chestTarget.scale.x = this.baseChestScale.x * (1 + breathNorm * 0.02);
      chestTarget.scale.z = this.baseChestScale.z * (1 + breathNorm * 0.035);
    }
  }

  public reset(): void {
    this.elapsedTime = 0;
    this.isBaseSet = false;
    this.isChestBaseSet = false;
  }
}
