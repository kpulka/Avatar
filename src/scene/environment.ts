import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Generator środowiska Image-Based Lighting (IBL)
 * Wykorzystuje lekki PMREM z RoomEnvironment, eliminując płaski wygląd materiałów PBR (docs/5)
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
    // 0.04 sigma daje miękkie, realistyczne odbicia studyjne
    const envRenderTarget = this.pmremGenerator.fromScene(roomEnv, 0.04);
    this.currentEnvTexture = envRenderTarget.texture;

    scene.environment = this.currentEnvTexture;
    return this.currentEnvTexture;
  }

  public dispose(): void {
    if (this.currentEnvTexture) {
      this.currentEnvTexture.dispose();
    }
    this.pmremGenerator.dispose();
  }
}
