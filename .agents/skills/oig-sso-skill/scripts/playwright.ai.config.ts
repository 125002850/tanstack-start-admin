import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseURL = process.env.PLAYWRIGHT_AI_BASE_URL ?? 'http://localhost:3000';
const baseUrl = new URL(baseURL);
const port = baseUrl.port || (baseUrl.protocol === 'https:' ? '443' : '80');
const storageStatePath = process.env.PLAYWRIGHT_AUTH_STORAGE ?? 'playwright/.auth/user.json';
const storageState = existsSync(storageStatePath) ? storageStatePath : undefined;
const browserProxy = process.env.PLAYWRIGHT_BROWSER_PROXY;
const useExternalServer = process.env.PLAYWRIGHT_EXTERNAL_SERVER === '1';
const grep = process.env.PLAYWRIGHT_AI_GREP
  ? new RegExp(process.env.PLAYWRIGHT_AI_GREP)
  : /@ai-sso/;

export default defineConfig({
  testDir: path.join(skillRoot, 'tests'),
  timeout: 30_000,
  retries: 0,
  ...(useExternalServer
    ? {}
    : {
        webServer: {
          command: `pnpm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
          timeout: 120_000,
          url: `${baseURL}/dashboard/overview`,
          reuseExistingServer: true
        }
      }),
  use: {
    baseURL,
    browserName: 'chromium',
    ...(storageState ? { storageState } : {}),
    ...(browserProxy
      ? {
          proxy: {
            server: browserProxy,
            bypass: '127.0.0.1,localhost'
          }
        }
      : {}),
    launchOptions: browserProxy ? undefined : { args: ['--no-proxy-server'] }
  },
  projects: [
    {
      name: 'ai-local-3000',
      grep
    }
  ]
});
