import { LoginRequiredError, isUnauthorizedResponse } from './errors';
import { createAuthHeaders, refreshTokenFromResponse } from './set-headers';
import {
  clearAuth,
  getLogoutUrl,
  handleUnauthorized,
  preserveLoginQueryFromCurrentUrl,
  setLogoutUrl
} from './session';
import { assertSessionActive, sessionExpiryStore, SessionExpiredError } from './session-expiry';
import { HTTP_STATUS_UNAUTHORIZED } from '../../http-status';

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

async function readResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.clone().json();
  } catch {
    return {};
  }
}

export async function bootstrapRequest(url: string, init?: RequestInit): Promise<Response> {
  assertSessionActive();
  const headers = createAuthHeaders(init?.headers);
  const hasAuthHeader = !!headers.get('authorization');
  const response = await fetch(url, {
    ...init,
    headers
  });

  const body =
    response.status === HTTP_STATUS_UNAUTHORIZED || response.ok
      ? await readResponseBody(response)
      : null;
  if (
    response.status === HTTP_STATUS_UNAUTHORIZED ||
    (response.ok && isUnauthorizedResponse(body))
  ) {
    const cachedLogoutUrl = getLogoutUrl();
    const redirectUrls = collectSsoRedirectUrls(body);

    if (hasAuthHeader) {
      handleUnauthorized(redirectUrls.logoutUrl ?? cachedLogoutUrl);
      throw new SessionExpiredError();
    }
    // 其他并发请求已判定会话失效时，不绕过确认框自动跳转。
    if (sessionExpiryStore.getState().expired) throw new SessionExpiredError();
    clearAuth();
    if (redirectUrls.logoutUrl) setLogoutUrl(redirectUrls.logoutUrl);
    const redirectUrl = redirectUrls.loginUrl ?? redirectUrls.logoutUrl ?? cachedLogoutUrl;
    if (redirectUrl) {
      preserveLoginQueryFromCurrentUrl();
      window.location.href = redirectUrl;
    }

    throw new LoginRequiredError(redirectUrl || undefined);
  }

  assertSessionActive();
  refreshTokenFromResponse(response);
  return response;
}
