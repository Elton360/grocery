import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Dev: http://localhost:5173 with /api proxied to the backend. Prod: `vite build`, served by the backend.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://127.0.0.1:8765' },
    fs: { allow: ['.', '../shared'] },
  },
})
