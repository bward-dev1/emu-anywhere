import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Game Emulator - Nintendo DS & Game Boy Advance',
        short_name: 'Emulator',
        description: 'Emulate Nintendo DS and Game Boy Advance entirely in your browser. Bring your own game files - nothing is uploaded, and no games are included.',
        theme_color: '#65c3c8',
        background_color: '#faf7f5',
        display: 'standalone',
        // No orientation lock: the DS's native layout is two vertically
        // stacked screens (portrait-shaped), while GBA and side-by-side DS
        // layouts favor landscape. The UI now supports and adapts to both,
        // so let the OS/user pick rather than force one on an installed PWA.
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // Precache everything, including the emulator wasm/js in static/, so the
        // app fully works offline once installed.
        globPatterns: ['**/*.{js,css,html,wasm,png,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024
      }
    })
  ],
  base: './'
})
