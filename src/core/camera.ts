import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class AppCamera {
  public readonly instance: THREE.PerspectiveCamera;
  public readonly controls: OrbitControls;

  constructor(domElement: HTMLElement) {
    // 35° FOV odpowiada obiektywowi portretowemu (~85mm) — zapobiega zniekształceniom nosa/twarzy
    this.instance = new THREE.PerspectiveCamera(
      35,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );

    // Kadr popiersia/głowy (kamera na wysokości wzroku awatara)
    this.instance.position.set(0, 1.5, 1.3);

    this.controls = new OrbitControls(this.instance, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 1.45, 0); // cel: twarz

    // Blokujemy interakcję OrbitControls myszką — kamera portretowa jest sztywno zablokowana na twarzy,
    // co zapobiega obracaniu sceny, zmianie kąta i przypadkowemu skalowaniu/zoomowi głowy przy ruchach myszką
    this.controls.enabled = false;
    this.controls.enableZoom = false;
    this.controls.enableRotate = false;
    this.controls.enablePan = false;

    this.controls.update();
  }

  public setControlsEnabled(enabled: boolean): void {
    this.controls.enabled = enabled;
  }

  public onResize(width: number, height: number): void {
    this.instance.aspect = width / height;
    this.instance.updateProjectionMatrix();
  }

  /** Kadr portretowy (presety sceny, F11): bust z=1.22, head z=0.9. */
  public setFraming(framing: 'bust' | 'head', faceY?: number): void {
    this.instance.position.z = framing === 'head' ? 0.9 : 1.22;
    if (faceY !== undefined) {
      this.instance.position.y = faceY + 0.03;
      this.controls.target.set(0, faceY, 0);
    }
    this.controls.update();
  }

  public update(): void {
    this.controls.update();
  }
}
