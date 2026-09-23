import { ssoStorageKeys } from './storage-keys';
import { sessionExpiryStore } from './session-expiry';

const BEARER_PREFIX = 'bearer ';

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
  } catch {}
}

export function clearAuth() {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(ssoStorageKeys.token);
    localStorage.removeItem(ssoStorageKeys.logoutUrl);
    localStorage.removeItem(ssoStorageKeys.userId);
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
  sessionExpiryStore.setState({ expired: true, logoutUrl });
  clearAuth();
}

export function confirmSessionExpired() {
  const state = sessionExpiryStore.getState();
  if (!state.expired || state.redirecting) return;
  sessionExpiryStore.setState({ redirecting: true });
  logout(state.logoutUrl);
}

export function logout(redirectUrl?: string | null) {
  const url = redirectUrl || getLogoutUrl();
  clearAuth();
  if (url) {
    window.location.href = url;
    return;
  }
  const fallback = new URL(window.location.href);
  fallback.searchParams.delete('token');
  window.location.href = fallback.toString();
}
