/**
 * Sprawdza czy przeglądarka wspiera WebGL2 lub WebGL
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
 * Pokazuje planszę awaryjną w przypadku braku WebGL
 */
export function handleWebGLFailure(onFallbackAudio?: () => void): void {
  const fallbackElement = document.getElementById('webgl-fallback');
  if (fallbackElement) {
    fallbackElement.classList.remove('hidden');

    const btnFallbackAudio = document.getElementById('btn-fallback-audio');
    btnFallbackAudio?.addEventListener('click', () => {
      fallbackElement.classList.add('hidden');
      const canvas = document.getElementById('avatar-canvas');
      if (canvas) {
        canvas.style.display = 'none';
      }
      onFallbackAudio?.();
    });
  }
  console.warn('[WebGL Fallback] Brak wsparcia WebGL w przeglądarce. Aktywowano graceful degradation.');
}
