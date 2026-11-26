import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// TEMPORARY: builds only the P3 verification harness so it can be served as a
// static bundle (fast first paint). Removed after verification.
export default defineConfig({
  root: __dirname,
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '/tmp/p3dist',
    emptyOutDir: true,
    rollupOptions: {
      input: { harness: path.resolve(__dirname, 'verify3d.html') },
    },
  },
});
