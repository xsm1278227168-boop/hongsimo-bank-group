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
        // Matches --bg in the light palette so the standalone chrome and the
        // launch splash blend into the page instead of framing it.
        theme_color: '#f5f5f6',
        background_color: '#f5f5f6',
        display: 'standalone',
        orientation: 'portrait',
        start_url: `/${REPO_NAME}/`,
        scope: `/${REPO_NAME}/`,
        lang: 'zh-CN',
        categories: ['finance', 'productivity'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        // Long-press the home-screen icon to jump straight to a page.
        shortcuts: [
          {
            name: '记一笔',
            short_name: '记一笔',
            url: `/${REPO_NAME}/#/`,
            icons: [{ src: 'icon-192.png', sizes: '192x192' }]
          },
          {
            name: '流水',
            short_name: '流水',
            url: `/${REPO_NAME}/#/ledger`,
            icons: [{ src: 'icon-192.png', sizes: '192x192' }]
          },
          {
            name: '月度汇总',
            short_name: '汇总',
            url: `/${REPO_NAME}/#/summary`,
            icons: [{ src: 'icon-192.png', sizes: '192x192' }]
          }
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
