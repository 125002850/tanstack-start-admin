// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSession = {
  getAuthHeader: vi.fn<() => string | null>(),
  setAuthHeader: vi.fn<(token: string) => void>(),
  setLogoutUrl: vi.fn<(url: string) => void>(),
  getLogoutUrl: vi.fn<() => string | null>()
};

vi.mock('./session', () => ({
  getAuthHeader: () => mockSession.getAuthHeader(),
  setAuthHeader: (token: string) => mockSession.setAuthHeader(token),
  setLogoutUrl: (url: string) => mockSession.setLogoutUrl(url),
  getLogoutUrl: () => mockSession.getLogoutUrl(),
  clearAuth: () => {}
}));

vi.mock('./set-headers', () => ({
  createAuthHeaders: (init?: HeadersInit) => new Headers(init),
  refreshTokenFromResponse: () => {}
}));

describe('login info query', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  async function importQueryOptions() {
    const mod = await import('./queries');
    return mod.getLoginInfoQueryOptions();
  }

  it('writes logoutUrl to session on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          rspCode: '200',
          msg: 'ok',
          success: true,
          data: {
            userId: '1',
            phone: '13800138000',
            userName: 'admin',
            realName: 'Admin',
            menuData: [],
            loginUrl: 'https://sso/login',
            logoutUrl: 'https://sso/logout'
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const options = await importQueryOptions();
    const data = await options.queryFn!({ signal: new AbortController().signal } as any);

    expect(data.userName).toBe('admin');
    expect(mockSession.setLogoutUrl).toHaveBeenCalledWith('https://sso/logout');
  });

  it('does not set logoutUrl on failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ rspCode: '500', msg: 'error', success: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const options = await importQueryOptions();

    await expect(
      options.queryFn!({ signal: new AbortController().signal } as any)
    ).rejects.toThrow('error');

    expect(mockSession.setLogoutUrl).not.toHaveBeenCalled();
  });

  it('throws on non-ok HTTP response with status code on error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('Server Error', { status: 500 })
    );

    const options = await importQueryOptions();

    let caught: any;
    try {
      await options.queryFn!({ signal: new AbortController().signal } as any);
    } catch (e) {
      caught = e;
    }

    expect(caught.message).toBe('Failed to fetch login info: 500');
    expect(caught.status).toBe(500);
    expect(mockSession.setLogoutUrl).not.toHaveBeenCalled();
  });

  it('exposes 401 status on error so retry handler can skip', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('Unauthorized', { status: 401 })
    );

    const options = await importQueryOptions();

    let caught: any;
    try {
      await options.queryFn!({ signal: new AbortController().signal } as any);
    } catch (e) {
      caught = e;
    }

    expect(caught.status).toBe(401);
  });
});
