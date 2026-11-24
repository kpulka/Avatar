import type { EyeLookWeights } from '../types/avatar';
import { ANIM_DEFAULTS } from './anim-config';

const { gaze: gazeConfig } = ANIM_DEFAULTS;

export interface GazeOptions {
  maxAngleRad?: number; // Maximum gaze angle (default gaze.maxAngleRad)
  minSaccadeIntervalSec?: number; // Minimum interval between saccades (default gaze.saccadeMinSec)
  maxSaccadeIntervalSec?: number; // Maximum interval between saccades (default gaze.saccadeMaxSec)
  saccadeMaxAngleRad?: number; // Maximum saccade jump (default gaze.saccadeAmpRad)
}

export type EyeGazeWeights = EyeLookWeights;

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

  // Reused result object (BORROWED by callers until the next compute()) — no per-frame allocation.
  private readonly weights: EyeGazeWeights = {
    eyeLookInLeft: 0,
    eyeLookOutLeft: 0,
    eyeLookUpLeft: 0,
    eyeLookDownLeft: 0,
    eyeLookInRight: 0,
    eyeLookOutRight: 0,
    eyeLookUpRight: 0,
    eyeLookDownRight: 0,
  };

  // Saccade state
  private nextSaccadeTimeSec = 1.0;
  private saccadeOffsetX = 0;
  private saccadeOffsetY = 0;
  private isSaccading = false;
  private saccadeStartTimeSec = 0;
  private saccadeDurationSec = gazeConfig.saccadeDefaultDurationSec;

  constructor(options: GazeOptions = {}) {
    this.maxAngle = options.maxAngleRad ?? gazeConfig.maxAngleRad;
    this.minInterval = options.minSaccadeIntervalSec ?? gazeConfig.saccadeMinSec;
    this.maxInterval = options.maxSaccadeIntervalSec ?? gazeConfig.saccadeMaxSec;
    this.saccadeMaxAngle = options.saccadeMaxAngleRad ?? gazeConfig.saccadeAmpRad;
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
   * Main gaze computation step.
   * BORROWED result: the same object is mutated and returned every call — copy it to keep it.
   */
  public compute(currentTimeSec: number, dt: number): EyeGazeWeights {
    // 1. Check and update micro-saccades
    this.updateSaccade(currentTimeSec);

    // 2. Gaze smoothing (exponential damping: alpha = 1 - exp(-lambda * dt))
    const alpha = 1 - Math.exp(-gazeConfig.lambda * dt);
    const targetWithSaccadeX = this.targetX + this.saccadeOffsetX;
    const targetWithSaccadeY = this.targetY + this.saccadeOffsetY;

    this.currentX += (targetWithSaccadeX - this.currentX) * alpha;
    this.currentY += (targetWithSaccadeY - this.currentY) * alpha;

    // 3. Convert to ARKit weights [0, 1] (taking maxAngle / the 15° limit into account)
    const lookX = Math.max(-1, Math.min(1, this.currentX));
    const lookY = Math.max(-1, Math.min(1, this.currentY));

    const w = this.weights;
    // Left eye (seen from the front: cursor to the right -> left eye outwards / towards the ear)
    w.eyeLookInLeft = lookX < 0 ? -lookX : 0;
    w.eyeLookOutLeft = lookX > 0 ? lookX : 0;
    w.eyeLookUpLeft = lookY > 0 ? lookY : 0;
    w.eyeLookDownLeft = lookY < 0 ? -lookY : 0;

    // Right eye (cursor to the right -> right eye inwards / towards the nose)
    w.eyeLookInRight = lookX > 0 ? lookX : 0;
    w.eyeLookOutRight = lookX < 0 ? -lookX : 0;
    w.eyeLookUpRight = lookY > 0 ? lookY : 0;
    w.eyeLookDownRight = lookY < 0 ? -lookY : 0;
    return w;
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
    const yaw = lookX * (this.maxAngle * gazeConfig.boneYawScale);
    const pitch = -lookY * (this.maxAngle * gazeConfig.bonePitchScale);

    if (leftEye) {
      const isSkeletonBone = Boolean(leftEye.isBone || leftEye.type === 'Bone');
      if (isSkeletonBone) {
        leftEye.rotation.y = yaw;
        leftEye.rotation.x = gazeConfig.boneRestOffset + pitch;
      } else {
        leftEye.rotation.y = -Math.PI / 2 + yaw;
        leftEye.rotation.x = -pitch;
      }
    }
    if (rightEye) {
      const isSkeletonBone = Boolean(rightEye.isBone || rightEye.type === 'Bone');
      if (isSkeletonBone) {
        rightEye.rotation.y = yaw;
        rightEye.rotation.x = gazeConfig.boneRestOffset + pitch;
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
        this.saccadeDurationSec =
          gazeConfig.saccadeDurationMinSec + Math.random() * (gazeConfig.saccadeDurationMaxSec - gazeConfig.saccadeDurationMinSec);

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
    this.saccadeDurationSec = gazeConfig.saccadeDefaultDurationSec;
    this.saccadeOffsetX = offsetX;
    this.saccadeOffsetY = offsetY;
  }
}
