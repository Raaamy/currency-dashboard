/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const API_HOSTS = [
  'https://open.er-api.com/',
  'https://api.coingecko.com/',
  'https://api.coinbase.com/',
  'https://api.gold-api.com/',
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api',
];

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Wissel',
        short_name: 'Wissel',
        description: 'Valuta omrekenen met live bitcoin-, goud- en zilverprijzen',
        lang: 'nl',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        background_color: '#F6F3EE',
        theme_color: '#F6F3EE',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        runtimeCaching: API_HOSTS.map((host) => ({
          urlPattern: ({ url }: { url: URL }) => url.href.startsWith(host),
          handler: 'NetworkFirst' as const,
          options: {
            cacheName: 'wissel-api',
            networkTimeoutSeconds: 8,
            expiration: { maxEntries: 16, maxAgeSeconds: 86400 },
            cacheableResponse: { statuses: [0, 200] },
          },
        })),
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
