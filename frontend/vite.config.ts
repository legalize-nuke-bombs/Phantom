import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// Phantom backend (LAN). Dev server proxies API + websockets here so the
// SPA can use same-origin relative paths (/api, /ws) with no CORS.
const BACKEND = 'http://192.168.1.11:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true, // expose on LAN so phone can hit the dev server too
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/v3': { target: BACKEND, changeOrigin: true },
      '/ws': { target: BACKEND.replace('http', 'ws'), ws: true, changeOrigin: true },
    },
  },
})
