// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function createStorageMock() {
  const store: Record<string, string> = {};
  return {
    store,
    storage: {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach((key) => {
          delete store[key];
        });
      }),
      length: 0,
      key: vi.fn(() => null)
    } satisfies Partial<Storage> as Storage
  };
}

function createMockLocation(pathname = '/dashboard/overview', search = '?tab=active') {
  const href = `https://example.com${pathname}${search}`;
  return {
    href,
    search,
    protocol: 'https:',
    host: 'example.com',
    hostname: 'example.com',
    port: '',
    pathname,
    hash: '',
    origin: 'https://example.com',
    ancestorOrigins: {} as DOMStringList,
    assign: vi.fn(),
    reload: vi.fn(),
    replace: vi.fn(),
    toString() {
      return href;
    }
  } as unknown as Location;
}

function setupBrowserMocks() {
  const { store, storage } = createStorageMock();
  const location = createMockLocation();

  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', {
    location
  });

  return { location, store };
}

describe('IAM session', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllGlobals();
  });

  it('turns refresh 401 into an auth-required redirect and clears local session state', async () => {
    const { location, store } = setupBrowserMocks();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 401, msg: 'Unauthorized', data: null }), {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const { ensureFreshAccessToken, setIamTokens } = await import('./session');
    setIamTokens({
      accessToken: 'old-access-token',
      refreshToken: 'stale-refresh-token',
      accessTokenExpiresAt: '2026-07-08T00:00:00.000Z',
      tokenType: 'Bearer'
    });

    await expect(ensureFreshAccessToken()).rejects.toMatchObject({
      name: 'AuthRequiredError'
    });
    expect(store.iam_refresh_token).toBeUndefined();
    expect(store.iam_access_token_expires_at).toBeUndefined();
    expect(location.href).toBe('/auth/sign-in?redirect=%2Fdashboard%2Foverview%3Ftab%3Dactive');
  });
});
