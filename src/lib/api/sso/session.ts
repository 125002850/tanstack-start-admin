const TOKEN_KEY = 'sso_token';
const LOGOUT_URL_KEY = 'sso_logout_url';
const USER_ID_KEY = 'sso_user_id';
const LOGIN_RETURN_SEARCH_KEY = 'sso_login_return_search';

function isBrowser() {
  return typeof window !== 'undefined';
}

function normalizeToken(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return '';
  const lowered = trimmed.toLowerCase();
  if (lowered.startsWith('bearer ')) {
    return trimmed.slice(7);
  }
  return trimmed;
}

function getSearch(url: URL): string {
  return url.searchParams.toString();
}

function restorePreservedLoginQuery(url: URL) {
  try {
    const preservedSearch = sessionStorage.getItem(LOGIN_RETURN_SEARCH_KEY);
    if (!preservedSearch) return;

    sessionStorage.removeItem(LOGIN_RETURN_SEARCH_KEY);

    const currentKeys = new Set(url.searchParams.keys());
    const preservedSearchParams = new URLSearchParams(preservedSearch);

    for (const [key, value] of preservedSearchParams) {
      if (currentKeys.has(key)) continue;
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
      sessionStorage.setItem(LOGIN_RETURN_SEARCH_KEY, search);
    } else {
      sessionStorage.removeItem(LOGIN_RETURN_SEARCH_KEY);
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
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthHeader(value: string) {
  if (!isBrowser()) return;
  const normalized = normalizeToken(value);
  if (!normalized) return;
  try {
    localStorage.setItem(TOKEN_KEY, normalized);
  } catch {}
}

export function clearAuth() {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LOGOUT_URL_KEY);
    localStorage.removeItem(USER_ID_KEY);
  } catch {}
}

export function getLoginUserId(): string | null {
  if (!isBrowser()) return null;
  try {
    return localStorage.getItem(USER_ID_KEY);
  } catch {
    return null;
  }
}

export function setLoginUserId(value: string) {
  if (!isBrowser()) return;
  const normalized = value.trim();
  if (!normalized) return;
  try {
    localStorage.setItem(USER_ID_KEY, normalized);
  } catch {}
}

export function getLogoutUrl(): string | null {
  if (!isBrowser()) return null;
  try {
    return localStorage.getItem(LOGOUT_URL_KEY);
  } catch {
    return null;
  }
}

export function setLogoutUrl(url: string) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(LOGOUT_URL_KEY, url);
  } catch {}
}

export function handleUnauthorized() {
  const logoutUrl = getLogoutUrl();
  clearAuth();
  if (logoutUrl) {
    window.location.href = logoutUrl;
  }
}

export function logout(redirectUrl?: string | null) {
  const url = redirectUrl || getLogoutUrl();
  clearAuth();
  window.location.href = url || window.location.origin;
}
