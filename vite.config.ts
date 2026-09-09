import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

// One build, two shells: this is the PWA, and installed from Safari it is the iOS app.
export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'venues.geojson'],
      manifest: {
        name: 'Charla',
        short_name: 'Charla',
        description: 'Practice the conversation. Then go have it.',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        background_color: '#F7F6F1',
        theme_color: '#24476B',
        icons: [{ src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // Cache the shell, scenes, strings and the venue file so practice, the Go Card
        // and kid mode open with no signal. Speaking needs internet; typing does not.
        globPatterns: ['**/*.{js,css,html,svg,json,geojson,webmanifest}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  server: {
    // `npm run worker:dev` serves the API on 8787; the app proxies /api there in dev.
    proxy: { '/api': 'http://localhost:8787' },
  },
})
