import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal('window', {
    location: {
      href: 'https://example.com/b/dashboard?tab=orders&token=stale',
      origin: 'https://example.com'
    },
    history: { replaceState: vi.fn() }
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function project(code: string) {
  vi.stubEnv('VITE_APP_SSO_SERVICE_CODE', code);
  vi.resetModules();
  return import('./session');
}

describe('project session isolation', () => {
  it('ignores legacy and other project credentials and clears only its own session', async () => {
    localStorage.setItem('sso_token', 'legacy');
    localStorage.setItem('sso_user_id', 'legacy-user');
    const a = await project('project-a');
    a.setAuthHeader('a-token');
    a.setLoginUserId('a-user');
    a.setLogoutUrl('https://sso/a');
    a.preserveLoginQueryFromCurrentUrl();
    const b = await project('project-b');
    expect(b.getAuthHeader()).toBeNull();
    expect(b.getLoginUserId()).toBeNull();
    b.setAuthHeader('b-token');
    b.setLoginUserId('b-user');
    b.setLogoutUrl('https://sso/b');
    expect(a.getAuthHeader()).toBe('a-token');
    expect(b.getAuthHeader()).toBe('b-token');
    b.clearAuth();
    expect(a.getLoginUserId()).toBe('a-user');
    expect(a.getLogoutUrl()).toBe('https://sso/a');
    expect(localStorage.getItem('sso_token')).toBe('legacy');
    expect(sessionStorage.getItem('sso:project-a:login_return_search')).toBe('tab=orders');
  });

  it('restores only this project business query and discards preserved token', async () => {
    const b = await project('project-b');
    sessionStorage.setItem('sso:project-a:login_return_search', 'customer=a');
    sessionStorage.setItem('sso:project-b:login_return_search', 'customer=b&token=old&tab=old');
    window.location.href = 'https://example.com/b/dashboard?token=new&tab=current';
    b.hydrateFromUrl();
    expect(b.getAuthHeader()).toBe('new');
    const url = new URL(vi.mocked(window.history.replaceState).mock.calls[0][2] as string);
    expect(url.searchParams.getAll('token')).toEqual(['new']);
    expect(url.searchParams.get('customer')).toBe('b');
    expect(url.searchParams.get('tab')).toBe('current');
    expect(sessionStorage.getItem('sso:project-b:login_return_search')).toBeNull();
    expect(sessionStorage.getItem('sso:project-a:login_return_search')).toBe('customer=a');
  });

  it('rejects empty service code and encodes separators', async () => {
    const { createSsoStorageKeys } = await import('./storage-keys');
    expect(() => createSsoStorageKeys('  ')).toThrow('VITE_APP_SSO_SERVICE_CODE');
    expect(createSsoStorageKeys(' a:b ').token).toBe('sso:a%3Ab:token');
    await expect(project('')).rejects.toThrow('VITE_APP_SSO_SERVICE_CODE');
  });

  it('coalesces unauthorized events, blocks late refresh and redirects once after confirmation', async () => {
    const session = await project('project-b');
    const { sessionExpiryStore, assertSessionActive } = await import('./session-expiry');
    session.setAuthHeader('expired');
    session.setLogoutUrl('https://sso/logout');
    const listener = vi.fn();
    const unsubscribe = sessionExpiryStore.subscribe(listener);
    session.handleUnauthorized();
    session.handleUnauthorized();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(session.getAuthHeader()).toBeNull();
    expect(window.location.href).toContain('/b/dashboard');
    expect(() => assertSessionActive()).toThrow('登录状态已失效');
    session.setAuthHeader('late-response');
    session.setLoginUserId('late-user');
    expect(session.getAuthHeader()).toBeNull();
    expect(session.getLoginUserId()).toBeNull();
    const navigate = vi.fn();
    Object.defineProperty(window.location, 'href', { set: navigate, configurable: true });
    session.confirmSessionExpired();
    session.confirmSessionExpired();
    expect(navigate).toHaveBeenCalledExactlyOnceWith('https://sso/logout');
    unsubscribe();
  });

  it('without logout URL confirms to the current business URL without stale token', async () => {
    const session = await project('project-b');
    session.handleUnauthorized();
    expect(window.location.href).toContain('token=stale');
    session.confirmSessionExpired();
    expect(window.location.href).toBe('https://example.com/b/dashboard?tab=orders');
  });
});
