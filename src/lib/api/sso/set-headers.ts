import { env } from '@/config/env';
import { getAuthHeader, getLoginUserId, setAuthHeader } from './session';

const H_SERVICE_ID = 'service-id';
const H_CLIENT_ID = 'client-id';
const H_SERVICE_CODE = 'service-code';
const H_USER_ID = 'X-User-Id';

function buildHeaders(headers?: HeadersInit): Headers {
  const merged = new Headers(headers);

  if (env.ssoServiceID) {
    merged.set(H_SERVICE_ID, env.ssoServiceID);
  }

  if (env.ssoClientID) {
    merged.set(H_CLIENT_ID, env.ssoClientID);
  }

  if (env.ssoServiceCode) {
    merged.set(H_SERVICE_CODE, env.ssoServiceCode);
  }

  return merged;
}

export function setHeader(headers?: HeadersInit): Headers {
  return buildHeaders(headers);
}

export function createAuthHeaders(init?: HeadersInit): Headers {
  const headers = buildHeaders(init);
  const token = getAuthHeader();
  const userId = getLoginUserId();
  if (token) {
    headers.set('Authorization', token);
  }
  if (userId) {
    headers.set(H_USER_ID, userId);
  }
  return headers;
}

export function extractAuthHeader(response: unknown): string | null {
  const headers = (response as Record<string, unknown>)?.headers;
  if (!headers) return null;

  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get('authorization');
  }

  const obj = headers as Record<string, string>;
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === 'authorization') {
      return obj[key];
    }
  }
  return null;
}

export function refreshTokenFromResponse(response: unknown) {
  const newToken = extractAuthHeader(response);
  if (newToken) {
    setAuthHeader(newToken);
  }
}
