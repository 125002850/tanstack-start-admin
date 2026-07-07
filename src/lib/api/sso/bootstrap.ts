import { createAuthHeaders, refreshTokenFromResponse } from './set-headers';
import { getLogoutUrl, preserveLoginQueryFromCurrentUrl, setLogoutUrl } from './session';
import { HTTP_STATUS_UNAUTHORIZED } from '../../http-status';

const TOKEN_KEY = 'sso_token';

function removeToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export interface SsoRedirectUrls {
  loginUrl?: string;
  logoutUrl?: string;
}

export function collectSsoRedirectUrls(
  value: unknown,
  urls: SsoRedirectUrls = {}
): SsoRedirectUrls {
  if (!value || typeof value !== 'object') {
    return urls;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.loginUrl === 'string') {
    urls.loginUrl = record.loginUrl;
  }
  if (typeof record.logoutUrl === 'string') {
    urls.logoutUrl = record.logoutUrl;
  }

  for (const nestedValue of Object.values(record)) {
    collectSsoRedirectUrls(nestedValue, urls);
  }

  return urls;
}

async function extractSsoRedirectUrlsFromBody(response: Response): Promise<SsoRedirectUrls> {
  try {
    const body = await response.clone().json();
    return collectSsoRedirectUrls(body);
  } catch {
    return {};
  }
}

export async function bootstrapRequest(url: string, init?: RequestInit): Promise<Response> {
  const headers = createAuthHeaders(init?.headers);
  const hasAuthHeader = !!headers.get('authorization');
  const response = await fetch(url, {
    ...init,
    headers
  });

  if (response.status === HTTP_STATUS_UNAUTHORIZED) {
    removeToken();

    const cachedLogoutUrl = getLogoutUrl();
    const redirectUrls = await extractSsoRedirectUrlsFromBody(response);

    if (redirectUrls.logoutUrl) {
      setLogoutUrl(redirectUrls.logoutUrl);
    }

    const redirectUrl = hasAuthHeader
      ? (redirectUrls.logoutUrl ?? cachedLogoutUrl)
      : (redirectUrls.loginUrl ?? redirectUrls.logoutUrl ?? cachedLogoutUrl);

    if (redirectUrl) {
      if (!hasAuthHeader) {
        preserveLoginQueryFromCurrentUrl();
      }
      window.location.href = redirectUrl;
    }

    return response;
  }

  refreshTokenFromResponse(response);
  return response;
}
