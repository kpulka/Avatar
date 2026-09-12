import * as THREE from 'three';

export interface RendererOptions {
  canvas: HTMLCanvasElement;
}

export class AppRenderer {
  public readonly instance: THREE.WebGLRenderer;

  constructor(options: RendererOptions) {
    this.instance = new THREE.WebGLRenderer({
      canvas: options.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });

    // PBR & Color Management zgodne z docs/5
    this.instance.outputColorSpace = THREE.SRGBColorSpace;
    this.instance.toneMapping = THREE.ACESFilmicToneMapping;
    this.instance.toneMappingExposure = 1.0;

    // Miękkie cienie studyjne (1024x1024 PCFSoft)
    this.instance.shadowMap.enabled = true;
    this.instance.shadowMap.type = THREE.PCFSoftShadowMap;

    // Budżet wydajności: max 2x DPR
    this.instance.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.setSize(window.innerWidth, window.innerHeight);
  }

  public setSize(width: number, height: number): void {
    this.instance.setSize(width, height, false);
  }

  public render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.instance.render(scene, camera);
  }

  public getDomElement(): HTMLCanvasElement {
    return this.instance.domElement;
  }

  public getGlContext(): WebGLRenderingContext | WebGL2RenderingContext {
    return this.instance.getContext();
  }

  public dispose(): void {
    this.instance.dispose();
  }
}
