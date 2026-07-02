// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function setupBrowserMocks() {
  const store: Record<string, string> = {};

  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((key) => delete store[key]);
    }),
    length: 0,
    key: vi.fn(() => null)
  });

  vi.stubGlobal('window', {});

  return store;
}

describe('createAuthHeaders', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('injects X-User-Id when login user id exists in session', async () => {
    setupBrowserMocks();
    const { setAuthHeader, setLoginUserId } = await import('./session');
    const { createAuthHeaders } = await import('./set-headers');

    setAuthHeader('Bearer token-value');
    setLoginUserId('10086');

    const headers = createAuthHeaders();

    expect(headers.get('Authorization')).toBe('token-value');
    expect(headers.get('X-User-Id')).toBe('10086');
  });

  it('skips X-User-Id when login user id is unavailable', async () => {
    setupBrowserMocks();
    const { setAuthHeader } = await import('./session');
    const { createAuthHeaders } = await import('./set-headers');

    setAuthHeader('Bearer token-value');

    const headers = createAuthHeaders();

    expect(headers.get('Authorization')).toBe('token-value');
    expect(headers.has('X-User-Id')).toBe(false);
  });
});
