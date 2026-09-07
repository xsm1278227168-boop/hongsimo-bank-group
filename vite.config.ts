import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the app from https://<user>.github.io/<repo>/.
// If you rename the repository, change this one string (and nothing else).
const REPO_NAME = 'hongsimo-bank-group';

export default defineConfig({
  base: `/${REPO_NAME}/`,
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: '洪撕膜之银行集团',
        short_name: '洪撕膜银行',
        description: '两人共享记账',
        theme_color: '#111827',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: `/${REPO_NAME}/`,
        scope: `/${REPO_NAME}/`,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Cache the app shell only. No API responses are precached: the ledger
        // must never be served stale, and offline writes are out of scope for v1.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        navigateFallback: `/${REPO_NAME}/index.html`,
        cleanupOutdatedCaches: true
      },
      devOptions: { enabled: false }
    })
  ]
});
