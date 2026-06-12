import { setHeader } from './set-headers';
import { clearAuth, getAuthHeader, getLogoutUrl, setAuthHeader } from './session';

const TOKEN_KEY = 'sso_token';

function removeToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export async function bootstrapRequest(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const headers = setHeader(init?.headers);
  const token = getAuthHeader();
  if (token) {
    headers.set('Authorization', token);
  }

  const response = await fetch(url, {
    ...init,
    headers
  });

  if (response.status === 401) {
    removeToken();
    const logoutUrl = getLogoutUrl();
    if (logoutUrl) {
      window.location.href = logoutUrl;
    }
    return response;
  }

  const newToken = response.headers.get('authorization');
  if (newToken) {
    setAuthHeader(newToken);
  }

  return response;
}
