import { defineConfig } from '@playwright/test';

const ensureLoopbackBypassesProxy = () => {
  const current = process.env.NO_PROXY ?? process.env.no_proxy ?? '';
  const entries = current
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const host of ['127.0.0.1', 'localhost']) {
    if (!entries.includes(host)) {
      entries.push(host);
    }
  }

  const next = entries.join(',');
  process.env.NO_PROXY = next;
  process.env.no_proxy = next;
};

ensureLoopbackBypassesProxy();

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  webServer: {
    command: 'bash scripts/playwright-workspace-tabs-servers.sh',
    timeout: 240_000,
    url: 'http://127.0.0.1:3099/dashboard/product',
    reuseExistingServer: false,
  },
  use: {
    browserName: 'chromium',
    launchOptions: {
      args: ['--no-proxy-server'],
    },
  },
  projects: [
    {
      name: 'default',
      grep: /@workspace-v2(?!-)/,
      use: { baseURL: 'http://127.0.0.1:3099' },
    },
    {
      name: 'rollback',
      grep: /@workspace-v2-rollback/,
      use: { baseURL: 'http://127.0.0.1:3100' },
    },
  ],
});
