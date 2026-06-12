// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSession = {
  getAuthHeader: vi.fn<() => string | null>(),
  setAuthHeader: vi.fn<(token: string) => void>(),
  setLogoutUrl: vi.fn<(url: string) => void>()
};

vi.mock('./session', () => ({
  getAuthHeader: () => mockSession.getAuthHeader(),
  setAuthHeader: (token: string) => mockSession.setAuthHeader(token),
  setLogoutUrl: (url: string) => mockSession.setLogoutUrl(url)
}));

vi.mock('./set-headers', () => ({
  setHeader: (headers?: HeadersInit) => new Headers(headers)
}));

describe('bootstrap', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('injects auth header from session', async () => {
    mockSession.getAuthHeader.mockReturnValue('Bearer bootstrap-token');

    let capturedHeaders: Headers | undefined;
    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      capturedHeaders = new Headers((init as RequestInit)?.headers);
      return new Response('{}', { status: 200 });
    });

    const { bootstrapRequest } = await import('./bootstrap');
    await bootstrapRequest('/api/getLoginInfo');

    expect(capturedHeaders?.get('Authorization')).toBe('Bearer bootstrap-token');
  });

  it('refreshes token from response', async () => {
    mockSession.getAuthHeader.mockReturnValue(null);

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { Authorization: 'Bearer refreshed-from-bootstrap' }
      })
    );

    const { bootstrapRequest } = await import('./bootstrap');
    await bootstrapRequest('/api/getLoginInfo');

    expect(mockSession.setAuthHeader).toHaveBeenCalledWith('Bearer refreshed-from-bootstrap');
  });

  it('does not redirect on 401 (returns response as-is)', async () => {
    mockSession.getAuthHeader.mockReturnValue('Bearer expired');

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('Unauthorized', { status: 401 })
    );

    const { bootstrapRequest } = await import('./bootstrap');
    const resp = await bootstrapRequest('/api/getLoginInfo');

    expect(resp.status).toBe(401);
  });
});
