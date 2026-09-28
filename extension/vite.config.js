import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Build into dist/ and load that folder unpacked in chrome://extensions.
// public/ (manifest, service worker, grabbers) is copied as-is; the side panel is bundled.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: { input: 'sidepanel.html' },
  },
})
