import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// MediaPipe (wasm y modelos) NO se empaqueta: se descarga de los CDN de jsDelivr
// y Google. Así cada visitante nuevo no gasta ~25 MB de la transferencia de Vercel.
export default defineConfig({
  plugins: [react()],
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
  server: { port: 5180 },
});
