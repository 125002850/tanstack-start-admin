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

const iamBackendBaseUrl = process.env.IAM_BACKEND_BASE_URL?.trim() || 'http://127.0.0.1:8080';

export default defineConfig({
  testDir: './e2e',
  testMatch: /iam-backend-smoke\.spec\.ts$/,
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: iamBackendBaseUrl
  }
});
