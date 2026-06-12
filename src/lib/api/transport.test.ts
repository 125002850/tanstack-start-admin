// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTransport, HttpError } from '@oig/react-query-generator/core';

describe('transport 401 behavior characterization', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('characterizes current 401 middleware behavior', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('{"error":"Unauthorized"}', {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const transport = createTransport();
    let postNextCodeRan = false;
    let caughtError: unknown = null;

    transport.registerMiddleware(async (_context, next) => {
      try {
        const result = await next();
        postNextCodeRan = true;
        return result;
      } catch (error) {
        caughtError = error;
        throw error;
      }
    });

    await expect(
      transport.customInstance('http://test/api', { method: 'GET' })
    ).rejects.toThrow();

    expect(postNextCodeRan).toBe(false);
    expect(caughtError).toBeInstanceOf(HttpError);
    expect((caughtError as HttpError).status).toBe(401);
  });

  it('2xx response does reach post-next middleware code', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('{"ok":true}', {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const transport = createTransport();
    let postNextCodeRan = false;

    transport.registerMiddleware(async (_context, next) => {
      const result = await next();
      postNextCodeRan = true;
      return result;
    });

    await transport.customInstance('http://test/api', { method: 'GET' });

    expect(postNextCodeRan).toBe(true);
  });
});
