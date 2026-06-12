const TOKEN_KEY = 'sso_token';
const LOGOUT_URL_KEY = 'sso_logout_url';

function isBrowser() {
  return typeof window !== 'undefined';
}

function normalizeToken(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('Bearer ')) return trimmed;
  return `Bearer ${trimmed}`;
}

export function hydrateFromUrl() {
  if (!isBrowser()) return;
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');
    if (token && token.trim().length > 0) {
      setAuthHeader(token);
      url.searchParams.delete('token');
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
  try {
    localStorage.setItem(TOKEN_KEY, normalizeToken(value));
  } catch {}
}

export function clearAuth() {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LOGOUT_URL_KEY);
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
