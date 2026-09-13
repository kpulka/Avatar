import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Port 3000 zajmuje AI Heritage (img2life) — Avatar ma własny, żeby nie kolidować.
    port: 5310,
    strictPort: true,
    open: false,
    host: true,
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        // Vendor chunking: three (~596 kB) osobno od kodu aplikacji (~154 kB), żeby zmiany
        // w kodzie nie unieważniały cache'u silnika 3D.
        // UWAGA: największy chunk w projekcie to NIE three, lecz słownik
        // `cmu-pronouncing-dictionary` (~3,92 MB / 961 kB gzip) — celowo ładowany
        // dynamicznym importem w `src/lipsync/g2p/g2p-en.ts` (lazy, poza pierwszym renderem).
        manualChunks: (id: string) => (id.includes('node_modules/three') ? 'three' : undefined),
      },
    },
    // Chunk słownika (`cmu-pronouncing-dictionary`, ~3,92 MB) jest celowy i lazy —
    // limit 4000 kB wycisza szum, a nadal łapie realny wzrost kodu aplikacji (~750 kB).
    chunkSizeWarningLimit: 4000,
  },
});
