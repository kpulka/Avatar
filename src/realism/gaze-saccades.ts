import { FaceDriver } from '../types/avatar';

export interface GazeOptions {
  maxAngleRad?: number; // Maximum gaze angle (default 0.26 rad ~15°)
  minSaccadeIntervalSec?: number; // Minimum interval between saccades (default 0.5s)
  maxSaccadeIntervalSec?: number; // Maximum interval between saccades (default 2.0s)
  saccadeMaxAngleRad?: number; // Maximum saccade jump (default 0.087 rad ~5°)
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
 * Gaze and eye micro-saccade controller (REAL-02, docs/5)
 */
export class GazeSaccades {
  private readonly maxAngle: number;
  private readonly minInterval: number;
  private readonly maxInterval: number;
  private readonly saccadeMaxAngle: number;

  // Mouse cursor target [-1, 1]
  private targetX = 0;
  private targetY = 0;

  // Current smoothed eye position
  private currentX = 0;
  private currentY = 0;

  // Saccade state
  private nextSaccadeTimeSec = 1.0;
  private saccadeOffsetX = 0;
  private saccadeOffsetY = 0;
  private isSaccading = false;
  private saccadeStartTimeSec = 0;
  private saccadeDurationSec = 0.04; // 40ms

  constructor(options: GazeOptions = {}) {
    this.maxAngle = options.maxAngleRad ?? 0.26; // 15 degrees
    this.minInterval = options.minSaccadeIntervalSec ?? 0.5;
    this.maxInterval = options.maxSaccadeIntervalSec ?? 2.0;
    this.saccadeMaxAngle = options.saccadeMaxAngleRad ?? 0.087; // 5 degrees
  }

  /**
   * Updates the cursor position in normalized screen coordinates [-1, 1]
   */
  public setPointer(normX: number, normY: number): void {
    // Clamp to the range [-1, 1]
    this.targetX = Math.max(-1, Math.min(1, normX));
    this.targetY = Math.max(-1, Math.min(1, normY));
  }

  /**
   * Main gaze computation step
   */
  public compute(currentTimeSec: number, dt: number): EyeGazeWeights {
    // 1. Check and update micro-saccades
    this.updateSaccade(currentTimeSec);

    // 2. Gaze smoothing (exponential damping: alpha = 1 - exp(-15 * dt))
    const alpha = 1 - Math.exp(-15 * dt);
    const targetWithSaccadeX = this.targetX + this.saccadeOffsetX;
    const targetWithSaccadeY = this.targetY + this.saccadeOffsetY;

    this.currentX += (targetWithSaccadeX - this.currentX) * alpha;
    this.currentY += (targetWithSaccadeY - this.currentY) * alpha;

    // 3. Convert to ARKit weights [0, 1] (taking maxAngle / the 15° limit into account)
    const lookX = Math.max(-1, Math.min(1, this.currentX));
    const lookY = Math.max(-1, Math.min(1, this.currentY));

    return {
      // Left eye (seen from the front: cursor to the right -> left eye outwards / towards the ear)
      eyeLookInLeft: lookX < 0 ? -lookX : 0,
      eyeLookOutLeft: lookX > 0 ? lookX : 0,
      eyeLookUpLeft: lookY > 0 ? lookY : 0,
      eyeLookDownLeft: lookY < 0 ? -lookY : 0,

      // Right eye (cursor to the right -> right eye inwards / towards the nose)
      eyeLookInRight: lookX > 0 ? lookX : 0,
      eyeLookOutRight: lookX < 0 ? -lookX : 0,
      eyeLookUpRight: lookY > 0 ? lookY : 0,
      eyeLookDownRight: lookY < 0 ? -lookY : 0,
    };
  }

  /**
   * Applies the gaze weights to FaceDriver with a moderate weight so the eyelids naturally support the movement without distortion
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
   * Directly rotates the eyeball bones / 3D objects
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

        // Random micro-jump of the eye < 5 degrees
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

        // Schedule the next saccade in 0.5 - 2.0 s
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
