import { defineConfig, devices } from '@playwright/test'

// Web build e2e: `npm run web:e2e` (builds, serves dist-web with vite preview, runs Chromium).
export default defineConfig({
  testDir: 'e2e-web',
  workers: 1,
  timeout: 300_000, // in-browser ffmpeg export is slow
  reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4173', viewport: { width: 1440, height: 900 }, acceptDownloads: true },
  webServer: { command: 'npx vite preview --config vite.web.config.ts', url: 'http://localhost:4173', reuseExistingServer: false }
})
