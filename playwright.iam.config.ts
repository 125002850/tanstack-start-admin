import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:8081',
    launchOptions: { args: ['--no-proxy-server'] }
  }
})
