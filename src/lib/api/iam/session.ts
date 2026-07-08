import { HttpError } from '@oig/react-query-generator/core';
import { getQueryClient } from '@/lib/query-client';
import { HTTP_STATUS_UNAUTHORIZED } from '@/lib/http-status';
import { buildSignInHref, getCurrentInternalHref } from '@/lib/router/safe-redirect';
import { iamRequest } from './request';
import { IAM_QUERY_KEYS } from './constants';
import { AuthRequiredError } from './errors';
import type {
  IamLoginReq,
  IamLoginResult,
  IamLogoutReq,
  IamPasswordChangeReq,
  IamPasswordChangeRsp,
  IamRefreshReq,
  IamTokenPair
} from './types';

const REFRESH_TOKEN_KEY = 'iam_refresh_token';
const ACCESS_TOKEN_EXPIRES_AT_KEY = 'iam_access_token_expires_at';
const TOKEN_VERSION_KEY = 'iam_token_version';
const BEARER_PREFIX = 'bearer ';
const REFRESH_SKEW_MS = 30_000;

let accessToken: string | null = null;
let refreshPromise: Promise<IamTokenPair> | null = null;

function isBrowser() {
  return typeof window !== 'undefined';
}

function normalizeBearerToken(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase().startsWith(BEARER_PREFIX)) {
    return trimmed.slice(BEARER_PREFIX.length).trim() || null;
  }
  return trimmed;
}

function getStoredRefreshToken(): string | null {
  if (!isBrowser()) return null;
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function getAccessTokenExpiresAt(): number | null {
  if (!isBrowser()) return null;
  try {
    const value = localStorage.getItem(ACCESS_TOKEN_EXPIRES_AT_KEY);
    if (!value) return null;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

function nextTokenVersion(): string {
  return String(Date.now());
}

function isRefreshUnauthorized(error: unknown): boolean {
  return error instanceof HttpError && error.status === HTTP_STATUS_UNAUTHORIZED;
}

export function hasRefreshToken(): boolean {
  return !!getStoredRefreshToken();
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getAuthHeader(): string | null {
  return accessToken ? `Bearer ${accessToken}` : null;
}

export function isAccessTokenExpiringSoon(): boolean {
  const expiresAt = getAccessTokenExpiresAt();
  if (!accessToken || !expiresAt) return true;
  return expiresAt - Date.now() <= REFRESH_SKEW_MS;
}

export function setIamTokens(tokens: IamTokenPair): void {
  accessToken = normalizeBearerToken(tokens.accessToken);
  if (!isBrowser()) return;

  try {
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    localStorage.setItem(ACCESS_TOKEN_EXPIRES_AT_KEY, tokens.accessTokenExpiresAt);
    localStorage.setItem(TOKEN_VERSION_KEY, nextTokenVersion());
  } catch {}
}

export function clearIamSession(): void {
  accessToken = null;
  refreshPromise = null;
  if (!isBrowser()) return;

  try {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(ACCESS_TOKEN_EXPIRES_AT_KEY);
    localStorage.removeItem(TOKEN_VERSION_KEY);
  } catch {}

  try {
    getQueryClient().removeQueries({ queryKey: IAM_QUERY_KEYS.me });
  } catch {}
}

export async function refreshIamSession(): Promise<IamTokenPair> {
  if (refreshPromise) return refreshPromise;

  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    clearIamSession();
    throw new Error('No refresh token available.');
  }

  refreshPromise = iamRequest<IamTokenPair>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken } satisfies IamRefreshReq)
  })
    .then((result) => {
      setIamTokens(result);
      return result;
    })
    .catch((error) => {
      clearIamSession();
      if (isRefreshUnauthorized(error)) {
        handleUnauthorized();
        throw new AuthRequiredError();
      }
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export async function ensureFreshAccessToken(): Promise<string | null> {
  if (!hasRefreshToken()) return accessToken;
  if (!isAccessTokenExpiringSoon()) return accessToken;
  await refreshIamSession();
  return accessToken;
}

export async function loginWithPassword(req: IamLoginReq): Promise<IamLoginResult> {
  const result = await iamRequest<IamLoginResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(req)
  });
  setIamTokens(result);
  return result;
}

export async function changeCurrentPassword(
  req: IamPasswordChangeReq
): Promise<IamPasswordChangeRsp> {
  const authHeader = getAuthHeader();
  const result = await iamRequest<IamPasswordChangeRsp>('/auth/password/change', {
    method: 'POST',
    headers: authHeader ? { Authorization: authHeader } : undefined,
    body: JSON.stringify(req)
  });
  setIamTokens(result);
  return result;
}

export async function requestLogout(): Promise<void> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return;

  await iamRequest<void>('/auth/logout', {
    method: 'POST',
    headers: getAuthHeader() ? { Authorization: getAuthHeader()! } : undefined,
    body: JSON.stringify({ refreshToken } satisfies IamLogoutReq)
  }).catch(() => undefined);
}

export async function logout(redirect = true): Promise<void> {
  await requestLogout();
  clearIamSession();
  if (redirect && isBrowser()) {
    window.location.href = buildSignInHref('/dashboard/overview');
  }
}

export function handleUnauthorized(redirect = getCurrentInternalHref()): void {
  clearIamSession();
  if (!isBrowser()) return;
  if (window.location.pathname.startsWith('/auth/sign-in')) return;
  window.location.href = buildSignInHref(redirect);
}
