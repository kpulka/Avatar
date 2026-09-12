import * as THREE from 'three';

/**
 * Konfiguracja 3-punktowego oświetlenia studyjnego PoC wg docs/5
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

    // 1. Key Light (Główne ciepłe światło rysujące)
    this.keyLight = new THREE.DirectionalLight(0xfff2e0, 2.2);
    this.keyLight.position.set(1.5, 2.0, 2.0);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 1024;
    this.keyLight.shadow.mapSize.height = 1024;
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 10.0;
    this.keyLight.shadow.bias = -0.0001;
    this.keyLight.shadow.radius = 2.0; // Miękki cień twarzy

    // Zacieśnienie frustum cienia pod popiersie/twarz
    const d = 1.0;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;

    // 2. Fill Light (Chłodne światło wypełniające cienie)
    this.fillLight = new THREE.DirectionalLight(0xdbe9ff, 0.7);
    this.fillLight.position.set(-2.0, 1.0, 1.5);

    // 3. Rim Light (Światło kontrowe — akcentuje krawędzie głowy i uszu)
    this.rimLight = new THREE.DirectionalLight(0xffe8d6, 2.6);
    this.rimLight.position.set(0.0, 2.5, -2.5);

    // 4. Subtelny ambient zapobiegający absolutnej czerni
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.15);

    this.group.add(this.keyLight);
    this.group.add(this.fillLight);
    this.group.add(this.rimLight);
    this.group.add(this.ambientLight);
  }

  public addToScene(scene: THREE.Scene): void {
    scene.add(this.group);
  }
}
