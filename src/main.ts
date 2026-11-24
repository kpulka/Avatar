import { isWebGLAvailable, handleWebGLFailure } from './ui/webgl-fallback';
import { createApp } from './app/container';

/**
 * Application bootstrap (Phase 11): the whole composition lives in `src/app/container.ts`,
 * only the WebGL check and start happen here.
 */
function initApp(): void {
  if (!isWebGLAvailable()) {
    handleWebGLFailure();
    return;
  }

  const canvas = document.getElementById('avatar-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    console.error('Could not find the #avatar-canvas canvas element');
    return;
  }

  const app = createApp(canvas);
  app.start();
}

window.addEventListener('DOMContentLoaded', initApp);
