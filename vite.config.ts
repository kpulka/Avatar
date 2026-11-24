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
        // The EN G2P lexicon (`src/lipsync/g2p/dict-en-pruned.json`, pruned by `npm run build:dict`) is
        // a separate lazy chunk loaded via a dynamic import in `g2p-en.ts` (outside the first render).
        manualChunks: (id: string) => (id.includes('node_modules/three') ? 'three' : undefined),
      },
    },
    // three is the largest chunk (~596 kB); the 700 kB limit still flags real growth of the app code
    // or an accidental return of the full CMU dictionary (it was 3.92 MB before Phase 17).
    chunkSizeWarningLimit: 700,
  },
});
