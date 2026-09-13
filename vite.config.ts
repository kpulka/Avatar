import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: false,
    host: true,
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        // Vendorzy per pakiet (review A1 / P2 — cold start warstwy usera):
        // three (~582 kB), livekit-client (WebRTC do ElevenLabs) i rxjs to osobne chunki,
        // dzięki czemu pierwszy render nie parsuje całego klienta RTC.
        manualChunks: (id: string) => {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/livekit')) return 'livekit';
          if (id.includes('node_modules/rxjs')) return 'rxjs';
          return undefined;
        },
      },
    },
    // Chunk `three` to vendor (~3,2 MB) — limit ustawiony tak, by ostrzeżenie łapało
    // realny wzrost kodu aplikacji, a nie znany rozmiar biblioteki.
    chunkSizeWarningLimit: 3500,
  },
});
