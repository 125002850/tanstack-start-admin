// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSession = {
  getAuthHeader: vi.fn<() => string | null>(),
  setAuthHeader: vi.fn<(token: string) => void>(),
  getLogoutUrl: vi.fn<() => string | null>(),
  setLogoutUrl: vi.fn<(url: string) => void>(),
  preserveLoginQueryFromCurrentUrl: vi.fn<() => void>()
};

vi.mock('./session', () => ({
  getAuthHeader: () => mockSession.getAuthHeader(),
  setAuthHeader: (token: string) => mockSession.setAuthHeader(token),
  getLogoutUrl: () => mockSession.getLogoutUrl(),
  setLogoutUrl: (url: string) => mockSession.setLogoutUrl(url),
  preserveLoginQueryFromCurrentUrl: () => mockSession.preserveLoginQueryFromCurrentUrl(),
  clearAuth: () => {}
}));

vi.mock('./set-headers', () => ({
  createAuthHeaders: (init?: HeadersInit) => {
    const headers = new Headers(init);
    const token = mockSession.getAuthHeader();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
  refreshTokenFromResponse: (response: unknown) => {
    const h = (response as Record<string, unknown>)?.headers;
    if (h && typeof (h as Headers).get === 'function') {
      const newToken = (h as Headers).get('authorization');
      if (newToken) mockSession.setAuthHeader(newToken);
    }
  }
}));

const mockLocation = { href: '' };

describe('bootstrap', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockLocation.href = 'https://example.com/dashboard';
    vi.stubGlobal('window', { location: mockLocation });
    vi.stubGlobal('localStorage', { removeItem: vi.fn() });
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllGlobals();
  });

  it('injects auth header from session', async () => {
    mockSession.getAuthHeader.mockReturnValue('jwt-bootstrap-token');

    let capturedHeaders: Headers | undefined;
    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      capturedHeaders = new Headers((init as RequestInit)?.headers);
      return new Response('{}', { status: 200 });
    });

    const { bootstrapRequest } = await import('./bootstrap');
    await bootstrapRequest('/api/getLoginInfo');

    expect(capturedHeaders?.get('Authorization')).toBe('Bearer jwt-bootstrap-token');
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

  it('redirects to loginUrl on first-entry 401 when no auth token exists', async () => {
    mockSession.getAuthHeader.mockReturnValue(null);
    mockSession.getLogoutUrl.mockReturnValue('https://sso/cached-logout');

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            loginUrl: 'https://sso/login',
            logoutUrl: 'https://sso/logout'
          }
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const { bootstrapRequest } = await import('./bootstrap');
    const resp = await bootstrapRequest('/api/getLoginInfo');

    expect(resp.status).toBe(401);
    expect(mockSession.setLogoutUrl).toHaveBeenCalledWith('https://sso/logout');
    expect(mockSession.preserveLoginQueryFromCurrentUrl).toHaveBeenCalledOnce();
    expect(mockLocation.href).toBe('https://sso/login');
  });

  it('redirects to logoutUrl on expired-token 401 when url is cached', async () => {
    mockSession.getAuthHeader.mockReturnValue('Bearer expired');
    mockSession.getLogoutUrl.mockReturnValue('https://sso/logout');

    globalThis.fetch = vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 }));

    const { bootstrapRequest } = await import('./bootstrap');
    const resp = await bootstrapRequest('/api/getLoginInfo');

    expect(resp.status).toBe(401);
    expect(mockSession.preserveLoginQueryFromCurrentUrl).not.toHaveBeenCalled();
    expect(mockLocation.href).toBe('https://sso/logout');
  });

  it('extracts logoutUrl from response body for expired-token 401 when not cached', async () => {
    mockSession.getAuthHeader.mockReturnValue('Bearer expired');
    mockSession.getLogoutUrl.mockReturnValue(null);

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            loginUrl: 'https://sso/login-from-body',
            logoutUrl: 'https://sso/logout-from-body'
          }
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const { bootstrapRequest } = await import('./bootstrap');
    const resp = await bootstrapRequest('/api/getLoginInfo');

    expect(resp.status).toBe(401);
    expect(mockSession.setLogoutUrl).toHaveBeenCalledWith('https://sso/logout-from-body');
    expect(mockLocation.href).toBe('https://sso/logout-from-body');
  });

  it('skips redirect on 401 when no logoutUrl available anywhere', async () => {
    mockSession.getAuthHeader.mockReturnValue('Bearer expired');
    mockSession.getLogoutUrl.mockReturnValue(null);

    globalThis.fetch = vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 }));

    const { bootstrapRequest } = await import('./bootstrap');
    const resp = await bootstrapRequest('/api/getLoginInfo');

    expect(resp.status).toBe(401);
    expect(mockLocation.href).toBe('https://example.com/dashboard');
  });
});
