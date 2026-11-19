import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { disposeObject3D } from '../src/core/dispose';
import { AppScene } from '../src/core/scene';
import { SceneController, type SceneControllerDeps } from '../src/features/scene-controller';
import { TypedEventBus } from '../src/app/events';
import type { AppEvents } from '../src/app/app-types';

describe('SceneController avatar loading', () => {
  it('updates avatar info before emitting avatar:loaded', () => {
    const events = new TypedEventBus<AppEvents>();
    const deps = {
      events,
      renderer: { instance: { capabilities: { getMaxAnisotropy: () => 1 } } },
      scene: { setAvatar: vi.fn() },
      camera: { instance: { position: new THREE.Vector3() }, controls: { target: new THREE.Vector3(), update: vi.fn() } },
      headMicro: { reset: vi.fn() },
    } as unknown as SceneControllerDeps;
    const controller = new SceneController(deps);
    let infoDuringEvent: ReturnType<SceneController['getAvatarInfo']> = null;
    events.on('avatar:loaded', () => { infoDuringEvent = controller.getAvatarInfo(); });

    controller.loadDemo();

    expect(infoDuringEvent).toMatchObject({ name: 'Demo ARKit Avatar (52 shapes)' });
  });
});

function makeAvatar() {
  const tex = new THREE.Texture();
  const normal = new THREE.Texture();
  const env = new THREE.Texture();
  const mat = new THREE.MeshPhysicalMaterial({ map: tex, normalMap: normal, envMap: env });
  const geo = new THREE.BufferGeometry();
  const mesh = new THREE.Mesh(geo, [mat, mat]);
  const root = new THREE.Group();
  root.add(new THREE.Group().add(mesh));
  return { root, tex, normal, env, mat, geo };
}

describe('disposeObject3D', () => {
  it('disposes resources once and preserves the environment map', () => {
    const a = makeAvatar();
    const spies = [a.tex, a.normal, a.env, a.mat, a.geo].map((resource) => vi.spyOn(resource, 'dispose'));
    disposeObject3D(a.root);
    expect(spies[0]).toHaveBeenCalledTimes(1);
    expect(spies[1]).toHaveBeenCalledTimes(1);
    expect(spies[2]).not.toHaveBeenCalled();
    expect(spies[3]).toHaveBeenCalledTimes(1);
    expect(spies[4]).toHaveBeenCalledTimes(1);
  });

  it('disposes shared skeletons once', () => {
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.MeshBasicMaterial();
    const skeleton = new THREE.Skeleton([new THREE.Bone()]);
    const first = new THREE.SkinnedMesh(geometry, material);
    const second = new THREE.SkinnedMesh(geometry, material);
    first.bind(skeleton);
    second.bind(skeleton);
    const dispose = vi.spyOn(skeleton, 'dispose');
    disposeObject3D(new THREE.Group().add(first, second));
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});

describe('AppScene.clearAvatar', () => {
  it('disposes and removes the previous avatar on replacement', () => {
    const scene = new AppScene();
    const a = makeAvatar();
    const geometryDispose = vi.spyOn(a.geo, 'dispose');
    scene.instance.environment = a.env;
    const environmentDispose = vi.spyOn(a.env, 'dispose');
    scene.setAvatar(a.root);
    scene.setAvatar(new THREE.Group());
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(environmentDispose).not.toHaveBeenCalled();
    expect(scene.avatarContainer.children).not.toContain(a.root);
  });
});

