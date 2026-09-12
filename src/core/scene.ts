import * as THREE from 'three';

export class AppScene {
  public readonly instance: THREE.Scene;
  public readonly avatarContainer: THREE.Group;
  private pedestal: THREE.Mesh | null = null;
  private gradientTexture: THREE.CanvasTexture | null = null;

  constructor() {
    this.instance = new THREE.Scene();
    this.instance.background = new THREE.Color(0x0e1117);

    this.avatarContainer = new THREE.Group();
    this.avatarContainer.name = 'AvatarContainer';
    this.instance.add(this.avatarContainer);

    this.createGroundPedestal();
  }

  private createGroundPedestal(): void {
    // Dysk podestu z delikatnym gradientem i cieniem kontaktowym
    const geometry = new THREE.CylinderGeometry(0.8, 0.8, 0.02, 64);
    const material = new THREE.MeshStandardMaterial({
      color: 0x181c24,
      roughness: 0.8,
      metalness: 0.1,
    });
    this.pedestal = new THREE.Mesh(geometry, material);
    this.pedestal.position.y = -0.01;
    this.pedestal.receiveShadow = true;
    this.instance.add(this.pedestal);
  }

  /** Widoczność podestu (presety sceny, F11). */
  public setPedestal(visible: boolean): void {
    if (this.pedestal) this.pedestal.visible = visible;
  }

  /** Tło jednolite (F11). */
  public setBackgroundColor(hex: number): void {
    this.disposeGradient();
    this.instance.background = new THREE.Color(hex);
  }

  /** Tło gradientowe (CanvasTexture, sRGB) z cache i dispose poprzedniej (F11). */
  public setGradientBackground(from: number, to: number): void {
    if (typeof document === 'undefined') {
      this.setBackgroundColor(from);
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.setBackgroundColor(from);
      return;
    }
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, `#${from.toString(16).padStart(6, '0')}`);
    gradient.addColorStop(1, `#${to.toString(16).padStart(6, '0')}`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 256);

    this.disposeGradient();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.gradientTexture = texture;
    this.instance.background = texture;
  }

  private disposeGradient(): void {
    if (this.gradientTexture) {
      this.gradientTexture.dispose();
      this.gradientTexture = null;
    }
  }

  public setAvatar(avatarRoot: THREE.Object3D): void {
    this.clearAvatar();
    this.avatarContainer.add(avatarRoot);
  }

  public clearAvatar(): void {
    while (this.avatarContainer.children.length > 0) {
      const child = this.avatarContainer.children[0];
      this.avatarContainer.remove(child);
    }
  }
}
