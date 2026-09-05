import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'MoonScribe',
        short_name: 'MoonScribe',
        description: 'A quiet, private place to write — made for two.',
        // Match the reference-led mobile shell during launch/install. The
        // in-app theme system still controls the surface after hydration.
        theme_color: '#0B0B0F',
        background_color: '#0B0B0F',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
        // WOFF2 is the browser-preferred format and is already included above.
        // Omitting legacy WOFF files keeps the precache manifest smaller while
        // retaining offline app code, images, and modern typography.
        globIgnores: ['**/*.woff'],
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//]
      }
    })
  ],
  server: {
    port: 5173,
    watch: {
      // Rust/installer outputs are large, frequently replaced, and can be
      // exclusively locked by the Windows linker. They are never web inputs.
      ignored: ['**/src-tauri/target/**', '**/data/**', '**/dist/**']
    },
    allowedHosts: [
      '.loca.lt',
      '.ngrok-free.app',
      '.ngrok-free.dev',
      '.ngrok.io',
    ],
    proxy: {
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:3001',
        changeOrigin: true,
        ws: true,
        configure(proxy) {
          // Browsers and the collaboration client intentionally close sockets
          // during HMR, API restarts, tab changes, and reconnect backoff. These
          // are normal lifecycle events rather than proxy failures.
          proxy.on('error', (error) => {
            const code = error?.code
            if (code === 'ECONNRESET' || code === 'ECONNABORTED' || code === 'EPIPE') return
            console.error('[vite] websocket proxy error:', error)
          })
        }
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 900
  },
  test: {
    environment: 'happy-dom',
    // UI integration suites share the fake IndexedDB and DOM globals. Running
    // files serially prevents one suite clearing another suite's fixture data.
    fileParallelism: false
  }
})
