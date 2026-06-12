import { createAuthHeaders, refreshTokenFromResponse } from './set-headers';
import { getLogoutUrl, setLogoutUrl } from './session';

const TOKEN_KEY = 'sso_token';

function removeToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

async function extractLogoutUrlFromBody(response: Response): Promise<string | null> {
  try {
    const body = await response.clone().json();
    const crawl = (obj: unknown): string | null => {
      if (!obj || typeof obj !== 'object') return null;
      if ('logoutUrl' in obj && typeof (obj as Record<string, unknown>).logoutUrl === 'string') {
        return (obj as Record<string, unknown>).logoutUrl as string;
      }
      for (const value of Object.values(obj as Record<string, unknown>)) {
        const found = crawl(value);
        if (found) return found;
      }
      return null;
    };
    return crawl(body);
  } catch {
    return null;
  }
}

export async function bootstrapRequest(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: createAuthHeaders(init?.headers)
  });

  if (response.status === 401) {
    removeToken();

    let redirectUrl = getLogoutUrl();

    if (!redirectUrl) {
      redirectUrl = await extractLogoutUrlFromBody(response);
      if (redirectUrl) {
        setLogoutUrl(redirectUrl);
      }
    }

    if (redirectUrl) {
      window.location.href = redirectUrl;
    }

    return response;
  }

  refreshTokenFromResponse(response);
  return response;
}
