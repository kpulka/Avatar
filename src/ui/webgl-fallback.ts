import { el } from './shared/dom';
import { t } from '../app/copy';

/**
 * Checks whether the browser supports WebGL2 or WebGL.
 */
export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

/**
 * Shows the fallback card when WebGL is unavailable. The card is rendered into the
 * `#webgl-fallback` mount (an empty, initially hidden overlay in index.html).
 */
export function handleWebGLFailure(): void {
  const fallbackElement = document.getElementById('webgl-fallback');
  if (fallbackElement) {
    fallbackElement.replaceChildren(
      el('div', { className: 'card error-card', attrs: { role: 'alert', 'aria-labelledby': 'webgl-fallback-title' } }, [
        el('h2', { id: 'webgl-fallback-title', text: t('webgl.title') }),
        el('p', { text: t('webgl.body') }),
        el('p', { className: 'subtext', text: t('webgl.subtext') }),
        el('p', { className: 'subtext', text: t('webgl.browserHint') }),
      ])
    );
    fallbackElement.classList.remove('hidden');
  }
  console.warn('[WebGL Fallback] WebGL is not supported in this browser. Graceful degradation activated.');
}
