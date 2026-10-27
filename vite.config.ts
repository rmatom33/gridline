import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` keeps asset paths relative so the build can be hosted anywhere
// (a CDN, a sub-folder, or the sample-data preview).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8787' }
  }
});
