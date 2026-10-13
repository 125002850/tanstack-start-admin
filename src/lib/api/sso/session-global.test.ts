import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let unsubscribe: (() => void) | undefined;

function storageEvent({ storageArea, ...init }: StorageEventInit) {
  const event = new StorageEvent('storage', init);
  Object.defineProperty(event, 'storageArea', { value: storageArea });
  return event;
}

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/overview?tab=orders&token=stale#details');
});

afterEach(() => {
  unsubscribe?.();
  unsubscribe = undefined;
});

function seedSessions() {
  for (const code of ['test-service', 'other-app', 'encoded%3Aapp']) {
    for (const field of ['token', 'user_id', 'user_code', 'logout_url']) {
      localStorage.setItem(`sso:${code}:${field}`, `${code}-${field}`);
    }
  }
  localStorage.setItem('sso:test-service:logout_url', 'https://sso.example/logout');
  localStorage.setItem('sso:other-app:preferences', 'keep');
  localStorage.setItem('sso_token', 'legacy');
  localStorage.setItem('business-draft', 'keep');
  sessionStorage.setItem('sso:other-app:login_return_search', 'tab=orders');
}

describe('同源 SSO 会话统一失效', () => {
  it.each(['handleUnauthorized', 'logout'] as const)(
    '%s 清理所有应用凭据并保留非认证数据',
    async (action) => {
      const session = await import('./session');
      const { sessionExpiryStore } = await import('./session-expiry');
      seedSessions();
      // 测试关注清理与失效状态；导航由既有 session 测试覆盖。
      if (action === 'logout') localStorage.removeItem('sso:test-service:logout_url');
      const showExpiryDialog = vi.fn();
      const stopObserving = sessionExpiryStore.subscribe((state) => {
        if (state.expired && !state.redirecting) showExpiryDialog();
      });
      session[action]();
      stopObserving();
      expect(showExpiryDialog).toHaveBeenCalledTimes(action === 'logout' ? 0 : 1);
      for (const code of ['test-service', 'other-app', 'encoded%3Aapp']) {
        for (const field of ['token', 'user_id', 'user_code', 'logout_url']) {
          expect(localStorage.getItem(`sso:${code}:${field}`)).toBeNull();
        }
      }
      expect(localStorage.getItem('business-draft')).toBe('keep');
      expect(localStorage.getItem('sso:other-app:preferences')).toBe('keep');
      expect(localStorage.getItem('sso_token')).toBe('legacy');
      expect(sessionStorage.getItem('sso:other-app:login_return_search')).toBe('tab=orders');
      expect(sessionExpiryStore.getState().expired).toBe(true);
      expect(sessionExpiryStore.getState().redirecting).toBe(action === 'logout');
      expect(window.location.search).toBe('?tab=orders');
      expect(window.location.hash).toBe('#details');
      session.setAuthHeader('late-response');
      expect(session.getAuthHeader()).toBeNull();
    }
  );

  it('并发 401 只广播一次，并在清理前保存退出地址', async () => {
    const session = await import('./session');
    const { sessionExpiryStore } = await import('./session-expiry');
    seedSessions();
    session.handleUnauthorized();
    const notification = localStorage.getItem(session.SSO_SESSION_INVALIDATED_KEY);
    session.handleUnauthorized();
    expect(localStorage.getItem(session.SSO_SESSION_INVALIDATED_KEY)).toBe(notification);
    expect(JSON.parse(notification!)).toMatchObject({ logoutUrl: 'https://sso.example/logout' });
    expect(sessionExpiryStore.getState().logoutUrl).toBe('https://sso.example/logout');
  });

  it('其他页面接收通知后阻止请求和迟到响应，不重复广播', async () => {
    const session = await import('./session');
    const { sessionExpiryStore, assertSessionActive } = await import('./session-expiry');
    session.setAuthHeader('old');
    unsubscribe = session.subscribeToSsoSessionInvalidation();
    const notification = JSON.stringify({
      id: 'other-page',
      logoutUrl: 'https://sso.example/logout'
    });
    // 模拟另一个页面先清除共享凭据，再发送 storage 通知。
    localStorage.clear();
    localStorage.setItem(session.SSO_SESSION_INVALIDATED_KEY, notification);
    const dispatch = () =>
      window.dispatchEvent(
        storageEvent({
          storageArea: localStorage,
          key: session.SSO_SESSION_INVALIDATED_KEY,
          newValue: notification
        })
      );
    dispatch();
    dispatch();
    expect(sessionExpiryStore.getState()).toMatchObject({
      expired: true,
      logoutUrl: 'https://sso.example/logout'
    });
    expect(() => assertSessionActive()).toThrow('登录状态已失效');
    session.setAuthHeader('late');
    session.setLoginUserId('late-user');
    session.hydrateFromUrl();
    expect(session.getAuthHeader()).toBeNull();
    expect(session.getLoginUserId()).toBeNull();
    expect(window.location.search).toBe('?tab=orders');
    expect(localStorage.getItem(session.SSO_SESSION_INVALIDATED_KEY)).toBe(notification);
  });

  it('忽略无关或无效通知，卸载后不再监听', async () => {
    const session = await import('./session');
    const { sessionExpiryStore } = await import('./session-expiry');
    unsubscribe = session.subscribeToSsoSessionInvalidation();
    for (const [key, newValue, storageArea] of [
      ['business-draft', '{"logoutUrl":null}', localStorage],
      [session.SSO_SESSION_INVALIDATED_KEY, 'invalid', localStorage],
      [session.SSO_SESSION_INVALIDATED_KEY, '{"logoutUrl":123}', localStorage],
      [session.SSO_SESSION_INVALIDATED_KEY, '{"logoutUrl":null}', sessionStorage]
    ] as const) {
      window.dispatchEvent(storageEvent({ key, newValue, storageArea }));
    }
    expect(sessionExpiryStore.getState().expired).toBe(false);
    unsubscribe();
    window.dispatchEvent(
      storageEvent({
        key: session.SSO_SESSION_INVALIDATED_KEY,
        newValue: '{"logoutUrl":null}',
        storageArea: localStorage
      })
    );
    expect(sessionExpiryStore.getState().expired).toBe(false);
  });
});
