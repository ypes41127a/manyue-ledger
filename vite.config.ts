import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { mockDrive } from './mock-drive';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  // 相對路徑：GitHub Pages 的 repo 取任何名稱都能正常載入
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    tailwindcss(),
    mockDrive(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '滿月記帳',
        short_name: '滿月記帳',
        description: '每月一次的滿月記帳表，資料只存在你的裝置',
        lang: 'zh-Hant',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f7f6f2',
        theme_color: '#1f3a5f',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // 股票清單較大，用到時才下載；下載過一次後離線也能搜尋
        runtimeCaching: [{ urlPattern: /\/data\/securities\.json$/, handler: 'StaleWhileRevalidate', options: { cacheName: 'securities' } }],
      },
    }),
  ],
  server: { host: '127.0.0.1', port: 5174 },
  test: { include: ['tests/**/*.test.ts'] },
});
