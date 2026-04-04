import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

const isMobile = process.env.VITE_BUILD_TARGET === 'mobile';

export default defineConfig({
  // For mobile (Capacitor), base must be '/' since it serves from local files
  // For web (GitHub Pages), base is '/babybloom/'
  base: isMobile ? '/' : '/babybloom/',
  plugins: [
    react(),
    // Only include PWA plugin for web builds — native apps don't need service workers
    ...(!isMobile
      ? [
          VitePWA({
            registerType: 'autoUpdate',
            srcDir: 'src',
            manifest: {
              name: 'BabyBloom',
              short_name: 'BabyBloom',
              description: 'Baby care Progressive Web App',
              theme_color: '#FF6B8A',
              background_color: '#FFF8F0',
              display: 'standalone',
              orientation: 'portrait',
              start_url: '/babybloom/',
              scope: '/babybloom/',
              icons: [
                {
                  src: 'logo-192.png',
                  sizes: '192x192',
                  type: 'image/png',
                  purpose: 'any',
                },
                {
                  src: 'logo-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'any',
                },
                {
                  src: 'logo.svg',
                  sizes: 'any',
                  type: 'image/svg+xml',
                  purpose: 'any',
                },
              ],
            },
            workbox: {
              cacheId: 'babybloom-v2',
              globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
              navigateFallback: '/babybloom/index.html',
              navigateFallbackAllowlist: [/^(?!\/__)/],
              cleanupOutdatedCaches: true,
              skipWaiting: true,
              clientsClaim: true,
              runtimeCaching: [
                {
                  urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/.*/i,
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'cdnjs-cache',
                    expiration: {
                      maxEntries: 200,
                      maxAgeSeconds: 30 * 24 * 60 * 60,
                    },
                  },
                },
              ],
            },
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
});
