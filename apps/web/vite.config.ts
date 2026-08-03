import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    // Three.js is isolated behind the asset-detail route and loaded only when a preview is opened.
    chunkSizeWarningLimit: 650,
  },
});
