// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTransport,
  HttpError,
  type TransportInstance
} from '@oig/react-query-generator/core';

const mockIamSession = vi.hoisted(() => ({
  ensureFreshAccessToken: vi.fn<() => Promise<string | null>>(),
  getAuthHeader: vi.fn<() => string | null>(),
  handleUnauthorized: vi.fn<() => void>(),
  refreshIamSession: vi.fn<() => Promise<unknown>>()
}));

vi.mock('./iam/session', () => mockIamSession);

function isIamAuthEndpoint(url: string): boolean {
  return /\/api\/iam\/auth\/(?:login|refresh|logout|password\/change)(?:[?#]|$)/.test(url);
}

function registerIamTransportMiddlewares(transport: TransportInstance) {
  function withAuthHeader(init?: HeadersInit): Headers {
    const headers = new Headers(init);
    const authHeader = mockIamSession.getAuthHeader();
    if (authHeader) {
      headers.set('Authorization', authHeader);
    }
    return headers;
  }

  transport.registerMiddleware(async (context, next) => {
    if (!isIamAuthEndpoint(context.url)) {
      await mockIamSession.ensureFreshAccessToken();
    }

    return next({
      ...context,
      options: {
        ...context.options,
        headers: withAuthHeader(context.options.headers)
      }
    });
  });

  transport.registerMiddleware(async (context, next) => {
    try {
      return await next(context);
    } catch (error) {
      if (error instanceof HttpError && error.status === 401 && !isIamAuthEndpoint(context.url)) {
        try {
          await mockIamSession.refreshIamSession();
          return await next({
            ...context,
            options: {
              ...context.options,
              headers: withAuthHeader(context.options.headers)
            }
          });
        } catch (refreshError) {
          mockIamSession.handleUnauthorized();
          throw refreshError;
        }
      } else if (error instanceof HttpError && error.status === 401) {
        mockIamSession.handleUnauthorized();
      }
      throw error;
    }
  });
}

describe('transport IAM auth pipeline', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.clearAllMocks();
    mockIamSession.ensureFreshAccessToken.mockResolvedValue('access-token');
    mockIamSession.getAuthHeader.mockReturnValue('Bearer access-token');
    mockIamSession.refreshIamSession.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      accessTokenExpiresAt: '2026-07-08T12:00:00.000Z',
      tokenType: 'Bearer'
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('injects bearer token from IAM session into normal requests', async () => {
    let capturedHeaders: Headers | undefined;
    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      capturedHeaders = new Headers((init as RequestInit)?.headers);
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const transport = createTransport();
    registerIamTransportMiddlewares(transport);
    await transport.customInstance('http://test/api/dict/list', { method: 'POST' });

    expect(mockIamSession.ensureFreshAccessToken).toHaveBeenCalledOnce();
    expect(capturedHeaders?.get('Authorization')).toBe('Bearer access-token');
  });

  it('skips preflight refresh for auth endpoints', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      );

    const transport = createTransport();
    registerIamTransportMiddlewares(transport);
    await transport.customInstance('/api/iam/auth/login', { method: 'POST' });

    expect(mockIamSession.ensureFreshAccessToken).not.toHaveBeenCalled();
  });

  it('refreshes once and replays a normal request after 401', async () => {
    const capturedHeaders: Array<string | null> = [];
    globalThis.fetch = vi
      .fn()
      .mockImplementationOnce(async (_url, init) => {
        capturedHeaders.push(new Headers((init as RequestInit)?.headers).get('Authorization'));
        return new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' });
      })
      .mockImplementationOnce(async (_url, init) => {
        capturedHeaders.push(new Headers((init as RequestInit)?.headers).get('Authorization'));
        return new Response('{"code":200,"msg":"ok","data":{"ok":true}}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      });

    mockIamSession.getAuthHeader
      .mockReturnValueOnce('Bearer old-access-token')
      .mockReturnValueOnce('Bearer new-access-token');

    const transport = createTransport();
    registerIamTransportMiddlewares(transport);
    await transport.customInstance('/api/dict/list', { method: 'POST' });

    expect(mockIamSession.refreshIamSession).toHaveBeenCalledOnce();
    expect(mockIamSession.handleUnauthorized).not.toHaveBeenCalled();
    expect(capturedHeaders).toEqual(['Bearer old-access-token', 'Bearer new-access-token']);
  });

  it('does not refresh recursively for auth endpoint 401', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' }));

    const transport = createTransport();
    registerIamTransportMiddlewares(transport);
    const error = await transport.customInstance('/api/iam/auth/refresh', { method: 'POST' }).then(
      () => null,
      (caught) => caught
    );

    expect(error).toBeInstanceOf(HttpError);
    expect(mockIamSession.refreshIamSession).not.toHaveBeenCalled();
    expect(mockIamSession.handleUnauthorized).toHaveBeenCalledOnce();
  });

  it('handles unauthorized when refresh replay cannot recover', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' }));
    mockIamSession.refreshIamSession.mockRejectedValue(new Error('refresh failed'));

    const transport = createTransport();
    registerIamTransportMiddlewares(transport);
    const error = await transport.customInstance('/api/dict/list', { method: 'POST' }).then(
      () => null,
      (caught) => caught
    );

    expect(error).toEqual(new Error('refresh failed'));
    expect(mockIamSession.handleUnauthorized).toHaveBeenCalledOnce();
  });
});

describe('production transport module integration', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.clearAllMocks();
    mockIamSession.ensureFreshAccessToken.mockResolvedValue('access-token');
    mockIamSession.getAuthHeader.mockReturnValue('Bearer production-token');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.resetModules();
  });

  it('exports a generated-client factory that injects IAM bearer token', async () => {
    let capturedHeaders: Headers | undefined;
    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      capturedHeaders = new Headers((init as RequestInit)?.headers);
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const { createApiClientCustomInstance } = await import('./transport');
    const client = createApiClientCustomInstance('/test-base', { credentials: 'same-origin' });

    await client('/api/endpoint');

    expect(capturedHeaders?.get('Authorization')).toBe('Bearer production-token');
  });
});
