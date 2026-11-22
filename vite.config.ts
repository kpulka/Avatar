import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [{
    name: 'production-content-security-policy',
    apply: 'build',
    transformIndexHtml() {
      return [{
        tag: 'meta',
        attrs: {
          'http-equiv': 'Content-Security-Policy',
          content: "default-src 'self'; connect-src 'self' blob: wss://api.elevenlabs.io; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; worker-src 'self' blob:",
        },
        injectTo: 'head-prepend',
      }];
    },
  }],
  server: {
    // Port 3000 is taken by AI Heritage (img2life) — Avatar uses its own, to avoid a clash.
    port: 5310,
    strictPort: true,
    open: false,
    host: true,
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        // Vendor chunking: three (~596 kB) separate from the app code (~154 kB), so that changes
        // in the code do not invalidate the cache of the 3D engine.
        // NOTE: the largest chunk in the project is NOT three but the dictionary
        // `cmu-pronouncing-dictionary` (~3.92 MB / 961 kB gzip) — deliberately loaded
        // via a dynamic import in `src/lipsync/g2p/g2p-en.ts` (lazy, outside the first render).
        manualChunks: (id: string) => (id.includes('node_modules/three') ? 'three' : undefined),
      },
    },
    // The dictionary chunk (`cmu-pronouncing-dictionary`, ~3.92 MB) is deliberate and lazy —
    // the 4000 kB limit silences the noise, while still catching real growth of the app code (~750 kB).
    chunkSizeWarningLimit: 4000,
  },
});
