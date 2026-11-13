import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// El backend (Nginx + PHP-FPM) escucha en :8080. En desarrollo el frontend se
// sirve desde :5173 y proxya la API para que todo sea same-origin y las cookies
// de sesión de Sanctum funcionen sin CORS.
const backend = 'http://localhost:8080'

const proxy = {
  '/api': { target: backend, changeOrigin: false },
  '/sanctum': { target: backend, changeOrigin: false },
  // Regex exacta: un prefijo `/up` capturaría también la ruta `/upload`.
  '^/up$': { target: backend, changeOrigin: false },
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Service worker propio: la caché de audio necesita control explícito
      // (qué se descarga, cuánto cabe y cómo se borra), y Workbox en modo
      // generateSW solo permite reglas por URL.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
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
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      // En desarrollo el service worker también se activa: sin él no se puede
      // probar la descarga offline ni el arranque sin red.
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy,
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
    // El build de producción se sirve contra el mismo backend para poder
    // probar el modo offline con el service worker real.
    proxy,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    // Los tests de lógica pura no necesitan DOM, pero los de componentes sí
    // (confirmaciones en línea, reproductor, gestor de descargas offline).
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
