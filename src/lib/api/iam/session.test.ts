// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getQueryClient } from '@/lib/query-client';
import { listQuerySchemesQueryKey, getQuerySceneMetadataQueryKey } from '@/lib/api/clients/service';
import { clearIamSession, ensureFreshAccessToken, setIamTokens } from './session';

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

function createMockLocation(pathname = '/overview', search = '?tab=active') {
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
    clearIamSession();
  });

  afterEach(() => {
    clearIamSession();
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
    expect(location.href).toBe('/auth/sign-in?redirect=%2Foverview%3Ftab%3Dactive');
  });
  it('clears personal query schemes across scenes when the session ends', () => {
    setupBrowserMocks();
    const client = getQueryClient();
    const first = listQuerySchemesQueryKey({ sceneCode: 'mdm.global.dict.item.page' });
    const second = listQuerySchemesQueryKey({ sceneCode: 'system.schedule.job.page' });
    const metadata = getQuerySceneMetadataQueryKey();
    try {
      client.setQueryData(first, [{ id: 1 }]);
      client.setQueryData(second, [{ id: 2 }]);
      client.setQueryData(metadata, {});
      clearIamSession();
      expect(client.getQueryData(first)).toBeUndefined();
      expect(client.getQueryData(second)).toBeUndefined();
      expect(client.getQueryData(metadata)).toEqual({});
    } finally {
      client.clear();
    }
  });
});
