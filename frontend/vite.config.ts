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
      // Disk uploads can be multi-GB and take minutes; the default http-proxy
      // socket/proxy timeouts would abort a long upload mid-stream (this was the
      // dev-only cause of the 5 GB upload failing). 0 = no timeout.
      // NOTE (prod): nginx in front of the backend needs the same treatment —
      //   client_max_body_size 11g; proxy_read_timeout / proxy_send_timeout (e.g. 1h);
      //   proxy_request_buffering off; — otherwise large uploads fail in production.
      '/api': { target: BACKEND, changeOrigin: true, timeout: 0, proxyTimeout: 0 },
      '/v3': { target: BACKEND, changeOrigin: true },
      '/ws': { target: BACKEND.replace('http', 'ws'), ws: true, changeOrigin: true },
    },
  },
})
