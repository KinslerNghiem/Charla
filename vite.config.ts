import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

const DAY = 24 * 60 * 60

// One build, two shells: this is the PWA, and installed from Safari it is the iOS app.
export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      // 'prompt', not 'autoUpdate': a learner mid-conversation should not have
      // the page swapped out under them. main.tsx shows a one-line bar instead.
      registerType: 'prompt',
      injectRegister: null,
      manifest: {
        id: '/',
        name: 'Charla',
        short_name: 'Charla',
        description: 'Practice the conversation. Then go have it.',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        background_color: '#EEF1F4',
        theme_color: '#1E5FAE',
        categories: ['education'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
        shortcuts: [
          {
            name: 'Go Card · Tu tarjeta',
            short_name: 'Go Card',
            url: '/#/card',
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Places · Lugares',
            short_name: 'Places',
            url: '/#/places',
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
        // From `npm run walk`. Every narrow shot shares one size, as the spec asks.
        screenshots: [
          { src: 'screenshots/card.png', sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'Go Card · Tu tarjeta' },
          { src: 'screenshots/table.png', sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'Table mode · Modo mesa' },
          { src: 'screenshots/kids.png', sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'Charlita (kid mode)' },
          { src: 'screenshots/desktop.png', sizes: '2560x1600', type: 'image/png', form_factor: 'wide', label: 'Rehearse · Ensayar' },
        ],
      },
      workbox: {
        // Cache the shell, scenes, strings and the venue file so practice, the Go Card
        // and kid mode open with no signal. Speaking needs internet; typing does not.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json,geojson,webmanifest}'],
        // The MapLibre chunk is 1 MB and only the Places tab needs it: it is
        // cached the first time it is actually fetched (runtimeCaching below),
        // not up front, so kid mode never downloads it. The store screenshots
        // are for the install sheet, not the app.
        globIgnores: ['**/node_modules/**/*', '**/assets/map-*', '**/assets/maplibre-gl-*', '**/screenshots/**'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === self.location.origin && (url.pathname.startsWith('/assets/map-') || url.pathname.startsWith('/assets/maplibre-gl-')),
            handler: 'CacheFirst',
            options: { cacheName: 'charla-map-code', expiration: { maxEntries: 4 } },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://tiles.openfreemap.org',
            handler: 'CacheFirst',
            options: {
              cacheName: 'charla-tiles',
              expiration: { maxEntries: 400, maxAgeSeconds: 30 * DAY },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url, request }) => request.method === 'GET' && url.pathname === '/api/places',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'charla-places', expiration: { maxAgeSeconds: DAY } },
          },
        ],
      },
    }),
  ],
  build: {
    // The one big chunk is MapLibre, split off on purpose and loaded only when
    // the Places tab opens. Everything else is well under 100 KB.
    chunkSizeWarningLimit: 1200,
  },
  server: {
    // `npm run worker:dev` serves the API on 8787; the app proxies /api there in dev.
    proxy: { '/api': 'http://localhost:8787' },
  },
})
