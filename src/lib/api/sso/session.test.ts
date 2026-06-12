// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function createMockLocation(token?: string): Location {
  const url = token
    ? `https://example.com/dashboard?token=${encodeURIComponent(token)}`
    : 'https://example.com/dashboard';

  return {
    href: url,
    search: token ? `?token=${encodeURIComponent(token)}` : '',
    protocol: 'https:',
    host: 'example.com',
    hostname: 'example.com',
    port: '',
    pathname: '/dashboard',
    hash: '',
    origin: 'https://example.com',
    ancestorOrigins: {} as DOMStringList,
    assign: vi.fn(),
    reload: vi.fn(),
    replace: vi.fn(),
    toString: () => url
  } as unknown as Location;
}

function createMockHistory() {
  return {
    state: {},
    replaceState: vi.fn(),
    pushState: vi.fn(),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    length: 1,
    scrollRestoration: 'auto' as ScrollRestoration
  };
}

function setupBrowserMocks(token?: string) {
  const store: Record<string, string> = {};

  const mockLocation = createMockLocation(token);
  const mockHistory = createMockHistory();

  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((k) => delete store[k]);
    }),
    length: 0,
    key: vi.fn(() => null)
  });

  vi.stubGlobal('location', mockLocation);
  vi.stubGlobal('history', mockHistory);
  vi.stubGlobal('window', { location: mockLocation, history: mockHistory });

  return store;
}

describe('session', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('hydrateFromUrl', () => {
    it('extracts token from URL query and stores it', async () => {
      const store = setupBrowserMocks('raw-token-value');
      const { hydrateFromUrl, getAuthHeader } = await import('./session');

      hydrateFromUrl();

      expect(getAuthHeader()).toBe('Bearer raw-token-value');
      expect(store['sso_token']).toBe('Bearer raw-token-value');
    });

    it('preserves Bearer prefix if already present', async () => {
      setupBrowserMocks('Bearer existing-token');
      const { hydrateFromUrl, getAuthHeader } = await import('./session');

      hydrateFromUrl();

      expect(getAuthHeader()).toBe('Bearer existing-token');
    });

    it('cleans token param from URL after hydration', async () => {
      setupBrowserMocks('some-token');
      const { hydrateFromUrl } = await import('./session');

      hydrateFromUrl();

      expect(history.replaceState).toHaveBeenCalledWith({}, '', 'https://example.com/dashboard');
    });

    it('does nothing if no token in URL', async () => {
      setupBrowserMocks();
      const { hydrateFromUrl, getAuthHeader } = await import('./session');

      hydrateFromUrl();

      expect(getAuthHeader()).toBeNull();
    });

    it('does not store empty token values', async () => {
      setupBrowserMocks('');
      const { hydrateFromUrl, getAuthHeader } = await import('./session');

      hydrateFromUrl();

      expect(getAuthHeader()).toBeNull();
    });
  });

  describe('getAuthHeader / setAuthHeader', () => {
    it('writes and reads auth header', async () => {
      const store = setupBrowserMocks();
      const { setAuthHeader, getAuthHeader } = await import('./session');

      setAuthHeader('Bearer my-token');

      expect(getAuthHeader()).toBe('Bearer my-token');
      expect(store['sso_token']).toBe('Bearer my-token');
    });

    it('normalizes bare token by adding Bearer prefix', async () => {
      const store = setupBrowserMocks();
      const { setAuthHeader, getAuthHeader } = await import('./session');

      setAuthHeader('bare-token');

      expect(getAuthHeader()).toBe('Bearer bare-token');
      expect(store['sso_token']).toBe('Bearer bare-token');
    });

    it('normalizes lowercase bearer prefix', async () => {
      const store = setupBrowserMocks();
      const { setAuthHeader, getAuthHeader } = await import('./session');

      setAuthHeader('bearer lowercase-token');

      expect(getAuthHeader()).toBe('Bearer lowercase-token');
      expect(store['sso_token']).toBe('Bearer lowercase-token');
    });

    it('rejects empty string', async () => {
      const store = setupBrowserMocks();
      const { setAuthHeader, getAuthHeader } = await import('./session');

      setAuthHeader('');

      expect(getAuthHeader()).toBeNull();
      expect(store['sso_token']).toBeUndefined();
    });

    it('rejects whitespace-only string', async () => {
      const store = setupBrowserMocks();
      const { setAuthHeader, getAuthHeader } = await import('./session');

      setAuthHeader('   ');

      expect(getAuthHeader()).toBeNull();
      expect(store['sso_token']).toBeUndefined();
    });

    it('returns null when no token stored', async () => {
      setupBrowserMocks();
      const { getAuthHeader } = await import('./session');

      expect(getAuthHeader()).toBeNull();
    });
  });

  describe('logout', () => {
    it('clears auth and redirects to logout url when available', async () => {
      setupBrowserMocks();
      const { setAuthHeader, setLogoutUrl, logout, getAuthHeader, getLogoutUrl } =
        await import('./session');

      setAuthHeader('Bearer token');
      setLogoutUrl('https://sso/logout');

      logout();

      expect(getAuthHeader()).toBeNull();
      expect(getLogoutUrl()).toBeNull();
      expect(window.location.href).toBe('https://sso/logout');
    });

    it('clears auth and redirects to origin when logout url is unavailable', async () => {
      setupBrowserMocks();
      const { logout, getAuthHeader, getLogoutUrl } = await import('./session');

      logout();

      expect(getAuthHeader()).toBeNull();
      expect(getLogoutUrl()).toBeNull();
      expect(window.location.href).toBe('https://example.com');
    });
  });

  describe('clearAuth', () => {
    it('removes token and logout metadata', async () => {
      const store = setupBrowserMocks();
      const { setAuthHeader, setLogoutUrl, clearAuth, getAuthHeader, getLogoutUrl } =
        await import('./session');

      setAuthHeader('Bearer token');
      setLogoutUrl('https://sso/logout');

      clearAuth();

      expect(getAuthHeader()).toBeNull();
      expect(getLogoutUrl()).toBeNull();
      expect(store['sso_token']).toBeUndefined();
      expect(store['sso_logout_url']).toBeUndefined();
    });
  });

  describe('getLogoutUrl / setLogoutUrl', () => {
    it('writes and reads logout url', async () => {
      setupBrowserMocks();
      const { setLogoutUrl, getLogoutUrl } = await import('./session');

      setLogoutUrl('https://sso.example.com/logout');

      expect(getLogoutUrl()).toBe('https://sso.example.com/logout');
    });

    it('returns null when no logout url stored', async () => {
      setupBrowserMocks();
      const { getLogoutUrl } = await import('./session');

      expect(getLogoutUrl()).toBeNull();
    });
  });

  describe('handleUnauthorized', () => {
    it('clears auth and redirects to logout url if available', async () => {
      setupBrowserMocks();
      const { setAuthHeader, setLogoutUrl, handleUnauthorized, getAuthHeader, getLogoutUrl } =
        await import('./session');

      setAuthHeader('Bearer token');
      setLogoutUrl('https://sso/logout');

      handleUnauthorized();

      expect(getAuthHeader()).toBeNull();
      expect(getLogoutUrl()).toBeNull();
      expect(window.location.href).toBe('https://sso/logout');
    });

    it('skips redirect if logout url is not available', async () => {
      setupBrowserMocks();
      const { handleUnauthorized } = await import('./session');

      handleUnauthorized();

      expect(window.location.href).toBe('https://example.com/dashboard');
    });
  });
});
