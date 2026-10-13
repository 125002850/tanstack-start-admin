import { getQueryClient } from '@/lib/query-client';
import { listQuerySchemesQueryKey } from '@/lib/api/clients/service';
import { ssoStorageKeys } from './storage-keys';
import { sessionExpiryStore } from './session-expiry';

const BEARER_PREFIX = 'bearer ';
export const SSO_SESSION_INVALIDATED_KEY = 'sso:session-invalidated';

function clearQuerySchemes() {
  if (!isBrowser()) return;
  getQueryClient().removeQueries({
    queryKey: listQuerySchemesQueryKey({ sceneCode: '' }).slice(0, -1)
  });
}

/** 清理登录凭据及个人方案缓存，保留共享元数据和各应用的登录返回参数。 */
function clearAllAuth() {
  clearQuerySchemes();
  if (!isBrowser()) return;
  try {
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key && /^sso:[^:]+:(token|user_id|user_code|logout_url)$/.test(key)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {}
}

function removeUrlToken() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('token')) return;
    url.searchParams.delete('token');
    window.history.replaceState(window.history.state, '', url.toString());
  } catch {}
}

/** 同源应用共用此通知；接收方只标记失效，不再次广播。 */
export function subscribeToSsoSessionInvalidation() {
  const onStorage = (event: StorageEvent) => {
    if (
      event.storageArea !== localStorage ||
      event.key !== SSO_SESSION_INVALIDATED_KEY ||
      !event.newValue
    )
      return;
    try {
      const notification: unknown = JSON.parse(event.newValue);
      if (!notification || typeof notification !== 'object' || !('logoutUrl' in notification))
        return;
      const logoutUrl = notification.logoutUrl;
      if (logoutUrl !== null && typeof logoutUrl !== 'string') return;
      if (sessionExpiryStore.getState().expired) return;
      sessionExpiryStore.setState({ expired: true, logoutUrl: getLogoutUrl() || logoutUrl });
      clearAuth();
      removeUrlToken();
    } catch {}
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

function invalidateAllSessions(logoutUrl: string | null, redirecting = false) {
  sessionExpiryStore.setState({ expired: true, logoutUrl, redirecting });
  clearAllAuth();
  removeUrlToken();
  try {
    localStorage.setItem(
      SSO_SESSION_INVALIDATED_KEY,
      JSON.stringify({
        id: `${Date.now()}-${Math.random()}`,
        logoutUrl
      })
    );
  } catch {}
}

function isBrowser() {
  return typeof window !== 'undefined';
}

function normalizeToken(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return '';
  const lowered = trimmed.toLowerCase();
  if (lowered.startsWith(BEARER_PREFIX)) {
    return trimmed.slice(BEARER_PREFIX.length);
  }
  return trimmed;
}

function getSearch(url: URL): string {
  const params = new URLSearchParams(url.searchParams);
  params.delete('token');
  return params.toString();
}

function restorePreservedLoginQuery(url: URL) {
  try {
    const preservedSearch = sessionStorage.getItem(ssoStorageKeys.loginReturnSearch);
    if (!preservedSearch) return;

    sessionStorage.removeItem(ssoStorageKeys.loginReturnSearch);

    const currentKeys = new Set(url.searchParams.keys());
    const preservedSearchParams = new URLSearchParams(preservedSearch);

    for (const [key, value] of preservedSearchParams) {
      if (key === 'token' || currentKeys.has(key)) continue;
      url.searchParams.append(key, value);
    }
  } catch {}
}

export function preserveLoginQueryFromCurrentUrl() {
  if (!isBrowser()) return;
  try {
    const url = new URL(window.location.href);
    const search = getSearch(url);

    if (search) {
      sessionStorage.setItem(ssoStorageKeys.loginReturnSearch, search);
    } else {
      sessionStorage.removeItem(ssoStorageKeys.loginReturnSearch);
    }
  } catch {}
}

export function hydrateFromUrl() {
  if (!isBrowser()) return;
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');
    if (token && token.trim().length > 0) {
      setAuthHeader(token);
      restorePreservedLoginQuery(url);
      window.history.replaceState({}, '', url.toString());
    }
  } catch {}
}

function parseJwtClaims(rawToken: string): Record<string, unknown> | null {
  try {
    const token = normalizeToken(rawToken) ?? rawToken;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function getAuthHeader(): string | null {
  if (!isBrowser()) return null;
  try {
    return localStorage.getItem(ssoStorageKeys.token);
  } catch {
    return null;
  }
}

export function setAuthHeader(value: string) {
  if (!isBrowser() || sessionExpiryStore.getState().expired) return;
  const normalized = normalizeToken(value);
  if (!normalized) return;
  try {
    localStorage.setItem(ssoStorageKeys.token, normalized);
    const claims = parseJwtClaims(normalized);
    if (typeof claims?.userCode === 'string' && claims.userCode.trim()) {
      setLoginUserCode(claims.userCode);
    }
  } catch {}
}

export function clearAuth() {
  clearQuerySchemes();
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(ssoStorageKeys.token);
    localStorage.removeItem(ssoStorageKeys.logoutUrl);
    localStorage.removeItem(ssoStorageKeys.userId);
    localStorage.removeItem(ssoStorageKeys.userCode);
  } catch {}
}

export function getLoginUserId(): string | null {
  if (!isBrowser()) return null;
  try {
    return localStorage.getItem(ssoStorageKeys.userId);
  } catch {
    return null;
  }
}

export function setLoginUserId(value: string) {
  if (!isBrowser() || sessionExpiryStore.getState().expired) return;
  const normalized = value.trim();
  if (!normalized) return;
  try {
    localStorage.setItem(ssoStorageKeys.userId, normalized);
  } catch {}
}

export function getLoginUserCode(): string | null {
  if (!isBrowser()) return null;
  try {
    const cached = localStorage.getItem(ssoStorageKeys.userCode);
    if (cached && cached.trim()) return cached.trim();
    const token = getAuthHeader();
    if (token) {
      const claims = parseJwtClaims(token);
      if (claims && typeof claims.userCode === 'string' && claims.userCode.trim()) {
        const code = claims.userCode.trim();
        setLoginUserCode(code);
        return code;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function setLoginUserCode(value: string) {
  if (!isBrowser() || sessionExpiryStore.getState().expired) return;
  const normalized = value.trim();
  if (!normalized) return;
  try {
    localStorage.setItem(ssoStorageKeys.userCode, normalized);
  } catch {}
}

export function getLogoutUrl(): string | null {
  if (!isBrowser()) return null;
  try {
    return localStorage.getItem(ssoStorageKeys.logoutUrl);
  } catch {
    return null;
  }
}

export function setLogoutUrl(url: string) {
  if (!isBrowser() || sessionExpiryStore.getState().expired) return;
  try {
    localStorage.setItem(ssoStorageKeys.logoutUrl, url);
  } catch {}
}

/** 并发 401 共用一次失效提示；退出地址必须在清理缓存前保存。 */
export function handleUnauthorized(redirectUrl?: string | null) {
  const state = sessionExpiryStore.getState();
  if (state.expired) {
    if (!state.logoutUrl && redirectUrl) sessionExpiryStore.setState({ logoutUrl: redirectUrl });
    return;
  }
  const logoutUrl = redirectUrl || getLogoutUrl();
  invalidateAllSessions(logoutUrl);
}

export function confirmSessionExpired() {
  const state = sessionExpiryStore.getState();
  if (!state.expired || state.redirecting) return;
  logout(state.logoutUrl);
}

export function logout(redirectUrl?: string | null) {
  const state = sessionExpiryStore.getState();
  const url = redirectUrl || state.logoutUrl || getLogoutUrl();
  // 主动退出同时进入失效与跳转状态，避免跳转前短暂弹出失效确认框。
  if (!state.expired) invalidateAllSessions(url, true);
  else sessionExpiryStore.setState({ redirecting: true });
  if (url) {
    window.location.href = url;
    return;
  }
  const fallback = new URL(window.location.href);
  fallback.searchParams.delete('token');
  window.location.href = fallback.toString();
}
