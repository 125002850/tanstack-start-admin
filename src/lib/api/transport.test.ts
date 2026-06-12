// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTransport, HttpError } from '@oig/react-query-generator/core';

const mockSession = {
  getAuthHeader: vi.fn<() => string | null>(),
  setAuthHeader: vi.fn<(token: string) => void>(),
  handleUnauthorized: vi.fn<() => void>()
};

vi.mock('./sso/session', () => ({
  getAuthHeader: () => mockSession.getAuthHeader(),
  setAuthHeader: (token: string) => mockSession.setAuthHeader(token),
  handleUnauthorized: () => mockSession.handleUnauthorized()
}));

vi.mock('./sso/set-headers', () => ({
  setHeader: (headers?: HeadersInit) => new Headers(headers)
}));

describe('transport auth pipeline', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function createAuthTransport() {
    const transport = createTransport();

    transport.registerMiddleware(async (context, next) => {
      const headers = new Headers(context.options.headers);
      const token = mockSession.getAuthHeader();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return next({
        ...context,
        options: { ...context.options, headers }
      });
    });

    transport.registerMiddleware(async (context, next) => {
      try {
        const response = await next(context);
        const newToken = extractAuthHeader(response);
        if (newToken) {
          mockSession.setAuthHeader(newToken);
        }
        return response;
      } catch (error) {
        if (error instanceof HttpError && error.status === 401) {
          mockSession.handleUnauthorized();
        }
        throw error;
      }
    });

    return transport;
  }

  it('injects auth header from session into requests', async () => {
    mockSession.getAuthHeader.mockReturnValue('jwt-token-value');

    let capturedHeaders: Headers | undefined;
    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      capturedHeaders = new Headers((init as RequestInit)?.headers);
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const transport = createAuthTransport();
    await transport.customInstance('http://test/api', { method: 'GET' });

    expect(mockSession.getAuthHeader).toHaveBeenCalled();
    expect(capturedHeaders?.get('Authorization')).toBe('Bearer jwt-token-value');
  });

  it('skips auth header injection when no token stored', async () => {
    mockSession.getAuthHeader.mockReturnValue(null);

    let capturedHeaders: Headers | undefined;
    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      capturedHeaders = new Headers((init as RequestInit)?.headers);
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const transport = createAuthTransport();
    await transport.customInstance('http://test/api', { method: 'GET' });

    expect(capturedHeaders?.has('Authorization')).toBe(false);
  });

  it('refreshes auth header from successful response', async () => {
    mockSession.getAuthHeader.mockReturnValue(null);

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { Authorization: 'Bearer refreshed-token' }
      })
    );

    const transport = createAuthTransport();
    await transport.customInstance('http://test/api', { method: 'GET' });

    expect(mockSession.setAuthHeader).toHaveBeenCalledWith('Bearer refreshed-token');
  });

  it('calls handleUnauthorized on 401 and re-throws', async () => {
    mockSession.getAuthHeader.mockReturnValue('Bearer expired-token');

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' })
    );

    const transport = createAuthTransport();

    const error = await transport.customInstance('http://test/api', { method: 'GET' })
      .then(() => null, (e) => e);

    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(401);
    expect(mockSession.handleUnauthorized).toHaveBeenCalledOnce();
  });

  it('re-throws non-401 errors without calling handleUnauthorized', async () => {
    mockSession.getAuthHeader.mockReturnValue('Bearer valid-token');

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('Server Error', { status: 500, statusText: 'Internal Server Error' })
    );

    const transport = createAuthTransport();

    const error = await transport.customInstance('http://test/api', { method: 'GET' })
      .then(() => null, (e) => e);

    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(500);
    expect(mockSession.handleUnauthorized).not.toHaveBeenCalled();
  });
});

describe('production transport module integration', () => {
  let capturedHeaders: Headers | undefined;

  it('exports a working factory that injects token from session', async () => {
    mockSession.getAuthHeader.mockReturnValue('jwt-from-production');

    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      capturedHeaders = new Headers((init as RequestInit)?.headers);
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const { createApiClientCustomInstance } = await import('./transport');
    const client = createApiClientCustomInstance('/test-base', { credentials: 'same-origin' });

    await client('/api/endpoint');

    expect(capturedHeaders?.get('Authorization')).toBe('Bearer jwt-from-production');
  });
});

  function extractAuthHeader(response: unknown): string | null {
    const headers = (response as Record<string, unknown>)?.headers;
    if (!headers) return null;
    if (typeof (headers as Headers).get === 'function') {
      return (headers as Headers).get('authorization');
    }
    const obj = headers as Record<string, string>;
    for (const key of Object.keys(obj)) {
      if (key.toLowerCase() === 'authorization') return obj[key];
    }
    return null;
  }

