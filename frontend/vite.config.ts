import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const emittedAssets = new Set<string>();

export default defineConfig({
  plugins: [react(), {
    name: 'current-offline-assets',
    buildStart() { emittedAssets.clear(); },
    writeBundle(_options, bundle) { Object.keys(bundle).forEach(file => emittedAssets.add(file)); },
  }, VitePWA({
    registerType: 'prompt',
    injectRegister: false,
    manifest: {
      name: 'ChordVault', short_name: 'ChordVault', start_url: '/', scope: '/', display: 'standalone',
      theme_color: '#efece6', background_color: '#faf8f4',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    },
    workbox: {
      skipWaiting: false, clientsClaim: false,
      navigateFallback: 'index.html', navigateFallbackDenylist: [/^\/api\//],
      maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      globPatterns: ['**/*.{js,css,html,woff,woff2,ttf,json,svg,png}'],
      globIgnores: ['**/*.map'],
      manifestTransforms: [async entries => ({
        manifest: entries.filter(entry => emittedAssets.has(entry.url) || entry.url === 'index.html' ||
          entry.url === 'favicon.svg' || /^icon-(180|192|512)\.png$/.test(entry.url) || entry.url === 'manifest.webmanifest' || /^locales\/[^/]+\.json$/.test(entry.url)),
        warnings: [],
      })],
    },
  })],
  build: {
    outDir: '../public',
    emptyOutDir: false,
    // CSP permits local font files, not inline data URLs.
    assetsInlineLimit: (filePath) => /\.(woff2?|ttf|otf)$/i.test(filePath) ? false : undefined,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3100',
      '/locales': 'http://localhost:3100',
    },
  },
});
