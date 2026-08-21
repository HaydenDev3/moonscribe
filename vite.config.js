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
        theme_color: '#7BA3C9',
        background_color: '#F9F6F1',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}']
      }
    })
  ],
  server: {
    port: 5173,
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
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 900
  },
  test: {
    environment: 'happy-dom'
  }
})
