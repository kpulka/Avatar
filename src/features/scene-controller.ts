/**
 * SceneController (Phase 11, 11-02) — scene, avatar loading, framing and render loop (the 3D part).
 *
 * Does not touch the DOM: emits `avatar:loaded` with complete data for the UI (model info, shapes).
 */
import * as THREE from 'three';
import { AppRenderer } from '../core/renderer';
import { AppCamera } from '../core/camera';
import { AppScene } from '../core/scene';
import { StudioLighting } from '../scene/lighting';
import { EnvironmentManager } from '../scene/environment';
import { enhanceAvatarMaterials } from '../scene/materials';
import { MetaPersonLoader } from '../avatar/meta-person-loader';
import { createTestAvatar } from '../avatar/test-avatar-generator';
import { HeadMicroMovements } from '../realism/head-micro-movements';
import { GazeSaccades } from '../realism/gaze-saccades';
import { EyeLookWeights, FaceDriver, LoadedAvatar } from '../types/avatar';
import { TypedEventBus } from '../app/events';
import { AppEvents, SceneService } from '../app/app-types';

export interface SceneControllerDeps {
  renderer: AppRenderer;
  camera: AppCamera;
  scene: AppScene;
  lighting: StudioLighting;
  environment: EnvironmentManager;
  loader: MetaPersonLoader;
  headMicro: HeadMicroMovements;
  gaze: GazeSaccades;
  events: TypedEventBus<AppEvents>;
}

export class SceneController implements SceneService {
  private root: THREE.Object3D | null = null;
  private faceDriver: FaceDriver | null = null;
  private avatarInfo: { name: string; shapesCount: number; speechMeshes: number } | null = null;
  private faceY = 0;
  /** Last gaze morph weights (computed here, APPLIED by FaceController — single writer). */
  private gazeWeights: EyeLookWeights | null = null;
  /** Gate for the procedural eyeball bones; false when an A2F clip carries its own eyes. */
  private proceduralEyesGate: () => boolean = () => true;

  constructor(private readonly deps: SceneControllerDeps) {}

  public getRoot(): THREE.Object3D | null {
    return this.root;
  }

  public getAvatarInfo(): { name: string; shapesCount: number; speechMeshes: number } | null {
    return this.avatarInfo ? { ...this.avatarInfo } : null;
  }

  public getFaceY(): number {
    return this.faceY;
  }

  public getFaceDriver(): FaceDriver | null {
    return this.faceDriver;
  }

  /** Latest gaze weights for the FaceController gaze provider (null before the first frame). */
  public getGazeWeights(): Readonly<EyeLookWeights> | null {
    return this.gazeWeights;
  }

  /** Sets the carriesEyes gate for the eyeball bones (same gate FaceController uses for blink/gaze). */
  public setProceduralEyesGate(gate: () => boolean): void {
    this.proceduralEyesGate = gate;
  }

  public loadDefaultAvatar(): void {
    this.deps.loader
      .load('/models/avatar.glb', undefined, (fraction) => {
        this.deps.events.emit('avatar:progress', { fraction });
      })
      .then((avatar) => {
        this.onLoaded(avatar, 'MetaPerson Rigged Avatar (avatar.glb)');
        // eslint-disable-next-line no-console -- trace log, not a diagnostic: kept as console.log on purpose (warn/error are the diagnostic channels)
        console.log('[Avatar] Successfully loaded the rigged MetaPerson avatar.glb model');
      })
      .catch((error) => {
        console.warn('[Avatar] /models/avatar.glb is missing or failed to load, using the demo avatar:', error);
        try {
          this.onLoaded(createTestAvatar(), 'Demo ARKit Avatar (52 shapes)');
        } catch (fallbackError) {
          console.error('Demo avatar error:', fallbackError);
          this.deps.events.emit('avatar:error', {
            message: 'The 3D avatar could not be loaded. Please reload the page.',
          });
        }
      });
  }

  public async loadFile(file: File): Promise<void> {
    const loaded = await this.deps.loader.load(file);
    this.onLoaded(loaded, file.name);
  }

  public loadDemo(): void {
    this.onLoaded(createTestAvatar(), 'Demo ARKit Avatar (52 shapes)');
  }

  private onLoaded(avatar: LoadedAvatar, name: string): void {
    this.root = avatar.root;
    this.faceDriver = avatar.faceDriver;
    this.deps.headMicro.reset();
    enhanceAvatarMaterials(avatar.root, this.deps.renderer.instance);
    this.deps.scene.setAvatar(avatar.root);

    // Automatic framing of the portrait camera on the model's face.
    const box = new THREE.Box3().setFromObject(avatar.root);
    const faceY = box.min.y + (box.max.y - box.min.y) * 0.88;
    this.faceY = faceY;
    this.deps.camera.instance.position.set(0, faceY + 0.03, 1.22);
    this.deps.camera.controls.target.set(0, faceY, 0);
    this.deps.camera.controls.update();
    this.deps.lighting?.focusOn(new THREE.Vector3(0, faceY, 0));

    const shapesCount = avatar.faceDriver.listAvailableShapes().length;
    this.avatarInfo = {
      name,
      shapesCount,
      speechMeshes: avatar.speechMeshes.length,
    };
    this.deps.events.emit('avatar:loaded', {
      root: avatar.root,
      faceDriver: avatar.faceDriver,
      speechMeshes: avatar.speechMeshes.length,
      shapesCount,
      name,
    });
  }

  public pointerMove(normX: number, normY: number): void {
    this.deps.gaze.setPointer(normX, normY);
  }

  public update(dt: number, timestampMs: number): void {
    const root = this.root;
    if (root) {
      const torso = (root.userData?.torso || root.getObjectByName('Avatar_Torso')) as THREE.Object3D | undefined;
      this.deps.headMicro.update(dt, root, torso);
    } else {
      this.deps.headMicro.update(dt, this.deps.scene.avatarContainer);
    }

    this.deps.camera.update();

    // Gaze weights are computed here but written to the morphs by FaceController (single writer).
    if (this.faceDriver) {
      this.gazeWeights = this.deps.gaze.compute(timestampMs / 1000, dt);
    }

    // Eyeball bones: skipped when the active A2F clip carries its own eyes.
    if (root && this.proceduralEyesGate()) {
      // userData is an untyped bag (any): the eye objects, when a loader sets them, are Object3Ds.
      const eyeData = root.userData as { leftEye?: THREE.Object3D; rightEye?: THREE.Object3D };
      const leftEye =
        eyeData.leftEye ||
        root.getObjectByName('LeftEye') ||
        root.getObjectByName('AvatarLeftEyeball') ||
        root.getObjectByName('Avatar_LeftEye');
      const rightEye =
        eyeData.rightEye ||
        root.getObjectByName('RightEye') ||
        root.getObjectByName('AvatarRightEyeball') ||
        root.getObjectByName('Avatar_RightEye');
      this.deps.gaze.applyToEyeObjects(leftEye, rightEye);
    }

    this.deps.renderer.render(this.deps.scene.instance, this.deps.camera.instance);
  }
}
