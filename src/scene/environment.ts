import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Image-Based Lighting (IBL) environment generator
 * Uses a light PMREM from RoomEnvironment, eliminating the flat look of PBR materials (docs/5)
 */
export class EnvironmentManager {
  private readonly pmremGenerator: THREE.PMREMGenerator;
  private currentEnvTexture: THREE.Texture | null = null;

  constructor(renderer: THREE.WebGLRenderer) {
    this.pmremGenerator = new THREE.PMREMGenerator(renderer);
    this.pmremGenerator.compileEquirectangularShader();
  }

  public setupRoomEnvironment(scene: THREE.Scene): THREE.Texture {
    if (this.currentEnvTexture) {
      this.currentEnvTexture.dispose();
    }

    const roomEnv = new RoomEnvironment();
    // 0.04 sigma gives soft, realistic studio reflections
    const envRenderTarget = this.pmremGenerator.fromScene(roomEnv, 0.04);
    this.currentEnvTexture = envRenderTarget.texture;

    scene.environment = this.currentEnvTexture;
    return this.currentEnvTexture;
  }

  /**
   * Studio softbox IBL: three emissive panels on a near-black backdrop, baked once into a PMREM texture
   * (zero per-frame cost). Gives rectangular catchlights in the eyes and a gentle sheen on forehead/nose,
   * where RoomEnvironment gives flat, boxy reflections.
   */
  public setupSoftboxEnvironment(scene: THREE.Scene): THREE.Texture {
    if (this.currentEnvTexture) {
      this.currentEnvTexture.dispose();
    }

    const env = new THREE.Scene();
    env.background = new THREE.Color(0x0b0b0d);
    const panel = (w: number, h: number, intensity: number, pos: [number, number, number]): void => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(1, 0.97, 0.92).multiplyScalar(intensity),
          side: THREE.DoubleSide,
        })
      );
      mesh.position.set(...pos);
      mesh.lookAt(0, 1.5, 0);
      env.add(mesh);
    };
    panel(1.2, 1.6, 6, [1.6, 1.8, 1.6]); // key softbox (same side as the key light)
    panel(0.8, 1.2, 2, [-2.0, 1.4, 1.2]); // fill
    panel(2.0, 0.3, 4, [0.0, 3.0, -0.5]); // top strip (hair/forehead sheen)

    const envRenderTarget = this.pmremGenerator.fromScene(env, 0.02);
    env.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      (mesh.material as THREE.Material | undefined)?.dispose?.();
    });
    this.currentEnvTexture = envRenderTarget.texture;

    scene.environment = this.currentEnvTexture;
    scene.environmentIntensity = 0.8;
    return this.currentEnvTexture;
  }

  public dispose(): void {
    if (this.currentEnvTexture) {
      this.currentEnvTexture.dispose();
    }
    this.pmremGenerator.dispose();
  }
}
