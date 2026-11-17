import { isUnauthorizedResponse, SessionRefreshedError } from './sso/errors';
import {
  HttpError,
  setTransportMiddlewares,
  type TransportMiddleware
} from '@oig/react-query-generator/core';

import { assertSessionActive, SessionExpiredError } from './sso/session-expiry';
import { getAuthExpiresAt, getAuthHeader, handleUnauthorized } from './sso/session';
import { createAuthHeaders, refreshTokenFromResponse } from './sso/set-headers';
import { HTTP_STATUS_UNAUTHORIZED } from '../http-status';
import { getLoginInfoQueryKey, getLoginInfoQueryOptions } from './sso/queries';
import { getQueryClient } from '../query-client';
import { env } from '@/config';

const DEV_SESSION_REFRESH_MARGIN_MS = 120_000;

async function ensureDevSession(force = false) {
  const queryClient = getQueryClient();
  const expiresAt = getAuthExpiresAt();
  const expiringSoon =
    expiresAt !== null && expiresAt <= Date.now() + DEV_SESSION_REFRESH_MARGIN_MS;
  const staleTime = expiresAt === null ? 60_000 : Infinity;
  await queryClient.fetchQuery({
    ...getLoginInfoQueryOptions(),
    staleTime:
      force ||
      expiringSoon ||
      !getAuthHeader() ||
      queryClient.isFetching({ queryKey: getLoginInfoQueryKey })
        ? 0
        : staleTime
  });
  assertSessionActive();
}

async function handleRequestUnauthorized(authorization: string | null) {
  if (!env.devSsoSessionEnabled) {
    handleUnauthorized();
    return;
  }
  assertSessionActive();
  // 旧请求的 401 不再次刷新已更新的会话，也不自动重放业务操作。
  if (authorization === getAuthHeader()) await ensureDevSession(true);
  throw new SessionRefreshedError();
}

const authHeadersMiddleware: TransportMiddleware = async (context, next) => {
  assertSessionActive();
  if (env.devSsoSessionEnabled) await ensureDevSession();
  return next({
    ...context,
    options: {
      ...context.options,
      headers: createAuthHeaders(context.options.headers)
    }
  });
};

const sessionMiddleware: TransportMiddleware = async (context, next) => {
  const authorization = new Headers(context.options.headers).get('authorization');
  try {
    const response = await next(context);
    assertSessionActive();
    if (isUnauthorizedResponse(response.data)) {
      await handleRequestUnauthorized(authorization);
      throw new SessionExpiredError();
    }
    if (!env.devSsoSessionEnabled || authorization === getAuthHeader()) {
      refreshTokenFromResponse(response);
    }
    return response;
  } catch (error) {
    if (error instanceof HttpError && error.status === HTTP_STATUS_UNAUTHORIZED) {
      await handleRequestUnauthorized(authorization);
    }
    throw error;
  }
};

export function configureApiTransport() {
  setTransportMiddlewares([authHeadersMiddleware, sessionMiddleware]);
}
