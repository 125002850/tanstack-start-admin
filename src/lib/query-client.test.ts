// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

type RetryError = Error & {
  response?: { status?: number };
  status?: number;
};

async function getRetryStrategy() {
  vi.resetModules();

  const { getQueryClient } = await import('./query-client');
  const retry = getQueryClient().getDefaultOptions().queries?.retry;

  if (typeof retry !== 'function') {
    throw new Error('Expected query retry strategy to be configured.');
  }

  return retry;
}

function createRetryError(status: number, source: 'status' | 'response' = 'status'): RetryError {
  const error = new Error('request failed') as RetryError;

  if (source === 'response') {
    error.response = { status };
  } else {
    error.status = status;
  }

  return error;
}

describe('query client retry strategy', () => {
  it('does not retry 401 and 404 responses', async () => {
    const retry = await getRetryStrategy();

    expect(retry(0, createRetryError(401))).toBe(false);
    expect(retry(0, createRetryError(401, 'response'))).toBe(false);
    expect(retry(0, createRetryError(404))).toBe(false);
    expect(retry(0, createRetryError(404, 'response'))).toBe(false);
  });

  it('retries other errors up to three attempts', async () => {
    const retry = await getRetryStrategy();

    expect(retry(0, createRetryError(500))).toBe(true);
    expect(retry(2, createRetryError(500))).toBe(true);
    expect(retry(3, createRetryError(500))).toBe(false);
  });
});
