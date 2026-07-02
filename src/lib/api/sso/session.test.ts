// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function createMockLocation(token?: string, search?: string): Location {
  const parsedUrl = new URL('https://example.com/dashboard');
  const searchParams = new URLSearchParams(search);

  for (const [key, value] of searchParams) {
    parsedUrl.searchParams.append(key, value);
  }

  if (token !== undefined) {
    parsedUrl.searchParams.set('token', token);
  }

  const url = parsedUrl.toString();

  return {
    href: url,
    search: parsedUrl.search,
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

function setupBrowserMocks(token?: string, search?: string) {
  const store: Record<string, string> = {};
  const sessionStore: Record<string, string> = {};

  const mockLocation = createMockLocation(token, search);
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

  vi.stubGlobal('sessionStorage', {
    getItem: vi.fn((key: string) => sessionStore[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      sessionStore[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete sessionStore[key];
    }),
    clear: vi.fn(() => {
      Object.keys(sessionStore).forEach((k) => delete sessionStore[k]);
    }),
    length: 0,
    key: vi.fn(() => null)
  });

  vi.stubGlobal('location', mockLocation);
  vi.stubGlobal('history', mockHistory);
  vi.stubGlobal('window', { location: mockLocation, history: mockHistory });

  Object.defineProperty(store, 'sessionStore', {
    value: sessionStore
  });

  return store as Record<string, string> & { sessionStore: Record<string, string> };
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

      expect(getAuthHeader()).toBe('raw-token-value');
      expect(store['sso_token']).toBe('raw-token-value');
    });

    it('preserves Bearer prefix if already present', async () => {
      setupBrowserMocks('Bearer existing-token');
      const { hydrateFromUrl, getAuthHeader } = await import('./session');

      hydrateFromUrl();

      expect(getAuthHeader()).toBe('existing-token');
    });

    it('keeps token param in URL after hydration', async () => {
      setupBrowserMocks('some-token');
      const { hydrateFromUrl } = await import('./session');

      hydrateFromUrl();

      expect(history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        'https://example.com/dashboard?token=some-token'
      );
    });

    it('keeps existing callback query params when hydrating token', async () => {
      setupBrowserMocks('some-token', 'customerCode=C001&tab=follow');
      const { hydrateFromUrl } = await import('./session');

      hydrateFromUrl();

      expect(history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        'https://example.com/dashboard?customerCode=C001&tab=follow&token=some-token'
      );
    });

    it('restores query params captured before SSO login callback', async () => {
      const store = setupBrowserMocks('some-token');
      store.sessionStore['sso_login_return_search'] = 'customerCode=C001&tab=follow';
      const { hydrateFromUrl } = await import('./session');

      hydrateFromUrl();

      expect(history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        'https://example.com/dashboard?token=some-token&customerCode=C001&tab=follow'
      );
      expect(store.sessionStore['sso_login_return_search']).toBeUndefined();
    });

    it('does not override callback query params when restoring preserved login query', async () => {
      const store = setupBrowserMocks('some-token', 'tab=current');
      store.sessionStore['sso_login_return_search'] = 'tab=follow&customerCode=C001';
      const { hydrateFromUrl } = await import('./session');

      hydrateFromUrl();

      expect(history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        'https://example.com/dashboard?tab=current&token=some-token&customerCode=C001'
      );
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

    it('stores current query before redirecting to SSO login', async () => {
      const store = setupBrowserMocks(undefined, 'customerCode=C001&tab=follow&token=stale');
      const { preserveLoginQueryFromCurrentUrl } = await import('./session');

      preserveLoginQueryFromCurrentUrl();

      expect(store.sessionStore['sso_login_return_search']).toBe(
        'customerCode=C001&tab=follow&token=stale'
      );
    });

    it('clears preserved login query when current URL has no non-token query', async () => {
      const store = setupBrowserMocks();
      store.sessionStore['sso_login_return_search'] = 'customerCode=C001';
      const { preserveLoginQueryFromCurrentUrl } = await import('./session');

      preserveLoginQueryFromCurrentUrl();

      expect(store.sessionStore['sso_login_return_search']).toBeUndefined();
    });
  });

  describe('getAuthHeader / setAuthHeader', () => {
    it('writes and reads auth header', async () => {
      const store = setupBrowserMocks();
      const { setAuthHeader, getAuthHeader } = await import('./session');

      setAuthHeader('Bearer my-token');

      expect(getAuthHeader()).toBe('my-token');
      expect(store['sso_token']).toBe('my-token');
    });

    it('normalizes bare token by adding Bearer prefix', async () => {
      const store = setupBrowserMocks();
      const { setAuthHeader, getAuthHeader } = await import('./session');

      setAuthHeader('bare-token');

      expect(getAuthHeader()).toBe('bare-token');
      expect(store['sso_token']).toBe('bare-token');
    });

    it('normalizes lowercase bearer prefix', async () => {
      const store = setupBrowserMocks();
      const { setAuthHeader, getAuthHeader } = await import('./session');

      setAuthHeader('bearer lowercase-token');

      expect(getAuthHeader()).toBe('lowercase-token');
      expect(store['sso_token']).toBe('lowercase-token');
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

    it('prefers explicit redirect url over cached logout url', async () => {
      setupBrowserMocks();
      const { setAuthHeader, setLogoutUrl, logout, getAuthHeader, getLogoutUrl } =
        await import('./session');

      setAuthHeader('Bearer token');
      setLogoutUrl('https://sso/cached-logout');

      logout('https://sso/forbidden-logout');

      expect(getAuthHeader()).toBeNull();
      expect(getLogoutUrl()).toBeNull();
      expect(window.location.href).toBe('https://sso/forbidden-logout');
    });
  });

  describe('clearAuth', () => {
    it('removes token, logout metadata, and login user id', async () => {
      const store = setupBrowserMocks();
      const {
        setAuthHeader,
        setLoginUserId,
        setLogoutUrl,
        clearAuth,
        getAuthHeader,
        getLoginUserId,
        getLogoutUrl
      } = await import('./session');

      setAuthHeader('Bearer token');
      setLoginUserId('10086');
      setLogoutUrl('https://sso/logout');

      clearAuth();

      expect(getAuthHeader()).toBeNull();
      expect(getLoginUserId()).toBeNull();
      expect(getLogoutUrl()).toBeNull();
      expect(store['sso_token']).toBeUndefined();
      expect(store['sso_user_id']).toBeUndefined();
      expect(store['sso_logout_url']).toBeUndefined();
    });
  });

  describe('getLoginUserId / setLoginUserId', () => {
    it('writes and reads login user id', async () => {
      const store = setupBrowserMocks();
      const { setLoginUserId, getLoginUserId } = await import('./session');

      setLoginUserId(' 10086 ');

      expect(getLoginUserId()).toBe('10086');
      expect(store['sso_user_id']).toBe('10086');
    });

    it('rejects empty login user id', async () => {
      const store = setupBrowserMocks();
      const { setLoginUserId, getLoginUserId } = await import('./session');

      setLoginUserId('   ');

      expect(getLoginUserId()).toBeNull();
      expect(store['sso_user_id']).toBeUndefined();
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
