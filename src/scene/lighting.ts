import * as THREE from 'three';
import { updateSkinLightUniforms } from './skin-shader';

/** Key light offset from the head target (direction is fixed, only the anchor moves). */
const KEY_OFFSET = new THREE.Vector3(1.5, 2.0, 2.0);

/**
 * PoC 3-point studio lighting configuration per docs/5
 */
export class StudioLighting {
  public readonly keyLight: THREE.DirectionalLight;
  public readonly fillLight: THREE.DirectionalLight;
  public readonly rimLight: THREE.DirectionalLight;
  public readonly ambientLight: THREE.AmbientLight;
  public readonly group: THREE.Group;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'StudioLighting';

    // 1. Key Light (the main warm modelling light)
    this.keyLight = new THREE.DirectionalLight(0xfff2e0, 2.2);
    this.keyLight.position.copy(KEY_OFFSET);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 1024;
    this.keyLight.shadow.mapSize.height = 1024;
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 6.0;
    this.keyLight.shadow.bias = -0.0001;
    this.keyLight.shadow.normalBias = 0.01;

    // Tight orthographic frustum around the head (re-centred by focusOn)
    const d = 0.35;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;

    // 2. Fill Light (a cool light filling the shadows)
    this.fillLight = new THREE.DirectionalLight(0xdbe9ff, 0.7);
    this.fillLight.position.set(-2.0, 1.0, 1.5);

    // 3. Rim Light (a back light — accents the edges of the head and ears)
    this.rimLight = new THREE.DirectionalLight(0xffe8d6, 2.6);
    this.rimLight.position.set(0.0, 2.5, -2.5);

    // 4. A subtle ambient preventing absolute black
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.15);

    this.group.add(this.keyLight);
    this.group.add(this.keyLight.target); // target must be in the scene graph for world matrices
    this.group.add(this.fillLight);
    this.group.add(this.rimLight);
    this.group.add(this.ambientLight);
  }

  /** Re-centres the key light (direction unchanged) and its shadow frustum on the given head point. */
  public focusOn(head: THREE.Vector3): void {
    this.keyLight.target.position.copy(head);
    this.keyLight.position.copy(head).add(KEY_OFFSET);
    this.keyLight.target.updateMatrixWorld();
    this.keyLight.updateMatrixWorld();
    this.keyLight.shadow.camera.updateProjectionMatrix();
  }

  public addToScene(scene: THREE.Scene): void {
    scene.add(this.group);
    // three calls Scene.onBeforeRender once per render; keeps the skin SSS uniforms on the key light.
    scene.onBeforeRender = (_renderer, _scene, camera) => updateSkinLightUniforms(this.keyLight, camera);

    if (import.meta.env?.DEV && new URLSearchParams(globalThis.location?.search ?? '').get('debugShadow') === '1') {
      scene.add(new THREE.CameraHelper(this.keyLight.shadow.camera));
    }
  }
}
