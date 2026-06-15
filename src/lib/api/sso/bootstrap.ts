import { createAuthHeaders, refreshTokenFromResponse } from './set-headers';
import { getLogoutUrl, setLogoutUrl } from './session';

const TOKEN_KEY = 'sso_token';

function removeToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

function findLogoutUrl(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.logoutUrl === 'string') {
    return record.logoutUrl;
  }

  for (const nestedValue of Object.values(record)) {
    const found = findLogoutUrl(nestedValue);
    if (found) {
      return found;
    }
  }

  return null;
}

async function extractLogoutUrlFromBody(response: Response): Promise<string | null> {
  try {
    const body = await response.clone().json();
    return findLogoutUrl(body);
  } catch {
    return null;
  }
}

export async function bootstrapRequest(url: string, init?: RequestInit): Promise<Response> {
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
