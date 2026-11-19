import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  workers: 1, // one app instance; specs share it in order
  timeout: 120_000,
  reporter: 'list'
})
