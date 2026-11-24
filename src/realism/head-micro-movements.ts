import { Object3D } from 'three';
import { ANIM_DEFAULTS } from './anim-config';

const { head: headConfig, breath: breathConfig } = ANIM_DEFAULTS;

export interface MicroMovementOptions {
  maxYawRad?: number; // Maximum yaw angle (default head.ampYawRad)
  maxPitchRad?: number; // Maximum pitch angle (default head.ampPitchRad)
  maxRollRad?: number; // Maximum roll angle (default head.ampRollRad)
  breathingFreqHz?: number; // Breathing frequency (default breath.freqHz)
  breathingAmplitudeY?: number; // Chest rise amplitude (default breath.ampM)
}

/**
 * Generator of procedural head micro-movements and the breathing cycle (REAL-01, docs/5).
 * Physiological rule: the head neither pulses nor bobs vertically.
 * Breathing is applied only to the chest (rib rise and expansion).
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
    this.maxYaw = options.maxYawRad ?? headConfig.ampYawRad; // very subtle left/right drift
    this.maxPitch = options.maxPitchRad ?? headConfig.ampPitchRad; // subtle tilt, WITHOUT rhythmic nodding
    this.maxRoll = options.maxRollRad ?? headConfig.ampRollRad;
    this.breathingFreq = options.breathingFreqHz ?? breathConfig.freqHz;
    this.breathingAmpY = options.breathingAmplitudeY ?? breathConfig.ampM;
  }

  /**
   * Computes head rotation offsets and chest breathing parameters
   */
  public compute(time: number): {
    yaw: number;
    pitch: number;
    roll: number;
    offsetY: number;
    breathNorm: number;
  } {
    // 1. Very slow, natural harmonic head noise (no rhythmic pulsing)
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

    // 2. Chest breathing cycle (asymmetric inhale/exhale)
    const breathPhase = time * this.breathingFreq * Math.PI * 2;
    const breathNorm = (Math.sin(breathPhase) + 1) / 2; // [0, 1]
    const offsetY = Math.pow(breathNorm, 1.2) * this.breathingAmpY;

    return { yaw, pitch, roll, offsetY, breathNorm };
  }

  /**
   * Updates the objects: the head performs only a micro-rotation,
   * while the chest (chestTarget) rises and expands with the breath.
   */
  public update(dt: number, headTarget: Object3D, chestTarget?: Object3D): void {
    if (!this.isBaseSet) {
      this.basePosition = { x: headTarget.position.x, y: headTarget.position.y, z: headTarget.position.z };
      this.baseRotation = { x: headTarget.rotation.x, y: headTarget.rotation.y, z: headTarget.rotation.z };
      this.isBaseSet = true;
    }

    this.elapsedTime += dt;
    const { yaw, pitch, roll, offsetY, breathNorm } = this.compute(this.elapsedTime);

    // HEAD: fixed Y position (ZERO vertical pulsing), only a subtle in-place micro-rotation
    headTarget.rotation.x = this.baseRotation.x + pitch;
    headTarget.rotation.y = this.baseRotation.y + yaw;
    headTarget.rotation.z = this.baseRotation.z + roll;
    headTarget.position.y = this.basePosition.y;

    // CHEST: the physiological breathing rise and expansion happens ONLY here
    if (chestTarget) {
      if (!this.isChestBaseSet) {
        this.baseChestPosition = { x: chestTarget.position.x, y: chestTarget.position.y, z: chestTarget.position.z };
        this.baseChestScale = { x: chestTarget.scale.x, y: chestTarget.scale.y, z: chestTarget.scale.z };
        this.isChestBaseSet = true;
      }

      // Chest rise on inhalation
      chestTarget.position.y = this.baseChestPosition.y + offsetY;
      // Chest expansion (the chest circumference grows on inhalation)
      chestTarget.scale.x = this.baseChestScale.x * (1 + breathNorm * breathConfig.chestScaleX);
      chestTarget.scale.z = this.baseChestScale.z * (1 + breathNorm * breathConfig.chestScaleZ);
    }
  }

  public reset(): void {
    this.elapsedTime = 0;
    this.isBaseSet = false;
    this.isChestBaseSet = false;
  }
}
