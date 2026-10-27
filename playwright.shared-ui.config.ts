import { defineConfig } from '@playwright/test';

const bypass = new Set(
  `${process.env.NO_PROXY ?? ''},${process.env.no_proxy ?? ''},127.0.0.1,localhost`
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
);
process.env.NO_PROXY = process.env.no_proxy = [...bypass].join(',');

const port = Number(process.env.SHARED_UI_TEST_PORT ?? 34127);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: 'shared-ui.smoke.spec.ts',
  workers: 1,
  timeout: 30_000,
  webServer: {
    command: `pnpm exec vite dev --host 127.0.0.1 --port ${port} --strictPort`,
    url: `${baseURL}/src/test/fixtures/shared-ui-preview.html`,
    reuseExistingServer: false
  },
  use: {
    baseURL,
    browserName: 'chromium',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ['--no-proxy-server']
    }
  }
});
