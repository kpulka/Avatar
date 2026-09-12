import { isWebGLAvailable, handleWebGLFailure } from './ui/webgl-fallback';
import { createApp } from './app/container';

/**
 * Bootstrap aplikacji (Faza 11): cała kompozycja w `src/app/container.ts`,
 * tu tylko sprawdzenie WebGL i start.
 */
function initApp(): void {
  if (!isWebGLAvailable()) {
    handleWebGLFailure();
    return;
  }

  const canvas = document.getElementById('avatar-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    console.error('Nie znaleziono canvas elementu #avatar-canvas');
    return;
  }

  const app = createApp(canvas);
  app.start();
}

window.addEventListener('DOMContentLoaded', initApp);
