import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// El backend (Nginx + PHP-FPM) escucha en :8080. En desarrollo el frontend se
// sirve desde :5173 y proxya la API para que todo sea same-origin y las cookies
// de sesión de Sanctum funcionen sin CORS.
const backend = 'http://localhost:8080'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Sonora — tu música',
        short_name: 'Sonora',
        description: 'Catálogo comunitario de música en streaming, con playlists propias.',
        lang: 'es',
        theme_color: '#07070b',
        background_color: '#07070b',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['music', 'entertainment'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/sanctum\//],
        runtimeCaching: [
          {
            // El audio se sirve por URL firmada con soporte Range: no se cachea.
            urlPattern: /\/api\/v1\/media\//,
            handler: 'NetworkOnly',
          },
          // Las respuestas de la API no se cachean: pueden contener datos de la
          // sesión. El offline real se hará con almacenamiento por usuario
          // (IndexedDB) en la fase 5, no con la caché HTTP de Workbox.
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: backend, changeOrigin: false },
      '/sanctum': { target: backend, changeOrigin: false },
      // Regex exacta: un prefijo `/up` capturaría también la ruta `/upload`.
      '^/up$': { target: backend, changeOrigin: false },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
})
