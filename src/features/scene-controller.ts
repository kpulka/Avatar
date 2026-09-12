/**
 * SceneController (Faza 11, 11-02) — scena, ładowanie awatara, kadr i pętla render (część 3D).
 *
 * Nie dotyka DOM: emituje `avatar:loaded` z kompletnymi danymi dla UI (model info, shapes).
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
import { FaceDriver, LoadedAvatar } from '../types/avatar';
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

  public loadDefaultAvatar(): void {
    this.deps.loader
      .load('/models/avatar.glb')
      .then((avatar) => {
        this.onLoaded(avatar, 'MetaPerson Rigged Avatar (avatar.glb)');
        console.log('[Avatar] Pomyślnie załadowano zrigowany model MetaPerson avatar.glb');
      })
      .catch((error) => {
        console.warn('[Avatar] Brak /models/avatar.glb lub błąd ładowania, używam awatara demo:', error);
        try {
          this.onLoaded(createTestAvatar(), 'Demo ARKit Avatar (52 shapes)');
        } catch (fallbackError) {
          console.error('Błąd awatara demo:', fallbackError);
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

    // Automatyczne wykadrowanie kamery portretowej na twarzy modelu.
    const box = new THREE.Box3().setFromObject(avatar.root);
    const faceY = box.min.y + (box.max.y - box.min.y) * 0.88;
    this.faceY = faceY;
    this.deps.camera.instance.position.set(0, faceY + 0.03, 1.22);
    this.deps.camera.controls.target.set(0, faceY, 0);
    this.deps.camera.controls.update();

    this.deps.events.emit('avatar:loaded', {
      root: avatar.root,
      faceDriver: avatar.faceDriver,
      speechMeshes: avatar.speechMeshes.length,
      shapesCount: avatar.faceDriver.listAvailableShapes().length,
      name,
    });
    this.avatarInfo = {
      name,
      shapesCount: avatar.faceDriver.listAvailableShapes().length,
      speechMeshes: avatar.speechMeshes.length,
    };
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

    if (this.faceDriver) {
      this.deps.gaze.applyToDriver(this.faceDriver, timestampMs / 1000, dt);
    }

    if (root) {
      const leftEye =
        root.userData?.leftEye ||
        root.getObjectByName('LeftEye') ||
        root.getObjectByName('AvatarLeftEyeball') ||
        root.getObjectByName('Avatar_LeftEye');
      const rightEye =
        root.userData?.rightEye ||
        root.getObjectByName('RightEye') ||
        root.getObjectByName('AvatarRightEyeball') ||
        root.getObjectByName('Avatar_RightEye');
      this.deps.gaze.applyToEyeObjects(leftEye, rightEye);
    }

    this.deps.renderer.render(this.deps.scene.instance, this.deps.camera.instance);
  }
}
